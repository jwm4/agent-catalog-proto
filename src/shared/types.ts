export interface ContainerSpec {
  harnessId: string;
  baseImage: string;
  buildArgs: Record<string, string>;
  setupCommands: string[];
  runCommands: string[];
  envVars: EnvVarSpec[];
  secrets: SecretSpec[];
  files: FileSpec[];
  volumes: VolumeSpec[];
  entrypoint: string[];
  labels: Record<string, string>;
  exposedPorts: number[];
}

export interface EnvVarSpec {
  name: string;
  value: string;
}

export interface SecretSpec {
  name: string;
  description: string;
}

export interface FileSpec {
  sourcePath: string;
  destPath: string;
  sourceType: 'local' | 'url' | 'inline';
  content?: string;
  mountType: 'copy' | 'configmap';
}

export interface VolumeSpec {
  name: string;
  mountPath: string;
  size: string;
  accessMode: string;
  storageClass?: string;
}

export type BuildPhase = 'pending' | 'running' | 'complete' | 'failed';
export type DeployPhase = 'pending' | 'applying' | 'waiting' | 'running' | 'failed';

export interface BuildStatus {
  buildName: string;
  phase: BuildPhase;
  imageRef?: string;
  logLines: string[];
  error?: string;
}

export interface DeploymentInfo {
  sessionId: string;
  deploymentName: string;
  namespace: string;
  phase: DeployPhase;
  imageRef: string;
  podName?: string;
  connectCommand?: string;
  routeUrl?: string;
  portForwardCommand?: string;
  error?: string;
}

export interface BackendOption {
  id: string;
  name: string;
  description: string;
  requiredEnvVars: string[];
}

export interface HarnessDefinition {
  id: string;
  name: string;
  description: string;
  longDescription: string;
  icon: string;
  tags: string[];
  license: 'open-source' | 'proprietary';
  hasBaseImage: boolean;
  baseConfig: ContainerSpec;
  systemPrompt: string;
  documentationUrl: string;
  readme: string;
  backends: BackendOption[];
}
