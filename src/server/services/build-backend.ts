import { spawn, exec, execSync } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

function ocApplyStdin(json: string, namespace: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('oc', ['apply', '-f', '-', '-n', namespace]);
    let stderr = '';
    child.stdin.write(json);
    child.stdin.end();
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `oc apply exited with code ${code}`));
    });
    child.on('error', reject);
  });
}

export interface BuildBackend {
  prepare(name: string, namespace: string): Promise<void>;
  startBuild(
    name: string,
    namespace: string,
    contextDir: string,
  ): AsyncGenerator<string, void, unknown>;
  verifyBuild(name: string, namespace: string): Promise<void>;
  getImageRef(name: string, namespace: string): Promise<string>;
  cleanup(name: string, namespace: string): Promise<void>;
}

async function oc(args: string[]): Promise<string> {
  const { stdout } = await execAsync(['oc', ...args].join(' '));
  return stdout.trim();
}

export function detectNamespace(): string {
  try {
    return execSync('oc project -q', { encoding: 'utf-8' }).trim();
  } catch {
    return 'default';
  }
}

export class BuildConfigBackend implements BuildBackend {
  async prepare(name: string, namespace: string): Promise<void> {
    const isJson = JSON.stringify({
      apiVersion: 'image.openshift.io/v1',
      kind: 'ImageStream',
      metadata: { name, namespace },
    });

    const bcJson = JSON.stringify({
      apiVersion: 'build.openshift.io/v1',
      kind: 'BuildConfig',
      metadata: { name, namespace },
      spec: {
        output: {
          to: { kind: 'ImageStreamTag', name: `${name}:latest` },
        },
        source: { type: 'Binary' },
        strategy: {
          type: 'Docker',
          dockerStrategy: { dockerfilePath: 'Containerfile' },
        },
      },
    });

    await ocApplyStdin(isJson, namespace);
    await ocApplyStdin(bcJson, namespace);
  }

  async *startBuild(
    name: string,
    namespace: string,
    contextDir: string,
  ): AsyncGenerator<string, void, unknown> {
    const child = spawn('oc', [
      'start-build',
      name,
      `--from-dir=${contextDir}`,
      '--follow',
      '-n',
      namespace,
    ]);

    let buffer = '';

    const lines = new Promise<void>((resolve, reject) => {
      child.stdout.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
      });
      child.stderr.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
      });
      child.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`oc start-build exited with code ${code}`));
      });
      child.on('error', reject);
    });

    const pollInterval = 200;
    while (true) {
      await new Promise((r) => setTimeout(r, pollInterval));

      if (buffer.length > 0) {
        const newLines = buffer.split('\n');
        buffer = '';
        for (const line of newLines) {
          if (line.trim()) yield line;
        }
      }

      const exited = await Promise.race([
        lines.then(() => true).catch(() => true),
        new Promise<false>((r) => setTimeout(() => r(false), 0)),
      ]);
      if (exited) {
        if (buffer.length > 0) {
          for (const line of buffer.split('\n')) {
            if (line.trim()) yield line;
          }
        }
        await lines;
        break;
      }
    }
  }

  async verifyBuild(name: string, namespace: string): Promise<void> {
    const maxAttempts = 6;
    const delayMs = 2000;
    let phase = '';

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      phase = await oc([
        'get', 'builds',
        '-l', `buildconfig=${name}`,
        '-n', namespace,
        '--sort-by=.metadata.creationTimestamp',
        '-o', "jsonpath={.items[-1:].status.phase}",
      ]);
      if (phase === 'Complete') return;
      if (phase === 'Failed' || phase === 'Error' || phase === 'Cancelled') break;
      await new Promise((r) => setTimeout(r, delayMs));
    }

    const message = await oc([
      'get', 'builds',
      '-l', `buildconfig=${name}`,
      '-n', namespace,
      '--sort-by=.metadata.creationTimestamp',
      '-o', "jsonpath={.items[-1:].status.message}",
    ]).catch(() => '');
    throw new Error(
      `Build failed (phase: ${phase})${message ? `. ${message}` : ''}`,
    );
  }

  async getImageRef(name: string, namespace: string): Promise<string> {
    return oc([
      'get',
      'imagestreamtag',
      `${name}:latest`,
      '-n',
      namespace,
      '-o',
      'jsonpath={.image.dockerImageReference}',
    ]);
  }

  async cleanup(name: string, namespace: string): Promise<void> {
    try {
      await oc(['delete', 'buildconfig', name, '-n', namespace, '--ignore-not-found']);
    } catch {
      // best effort
    }
  }
}
