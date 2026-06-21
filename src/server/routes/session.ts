import { Router } from 'express';
import { getHarnessById } from '../../shared/harnesses.js';
import {
  createSession,
  getSpec,
  getSession,
  updateSpec,
  setWelcomeMessage,
  getWelcomeMessage,
} from '../services/session-manager.js';
import {
  isGoosedRunning,
  startAgentSession,
  sendMessage,
  sendInstructionsAndGetGreeting,
} from '../services/goose.js';

const router = Router();

router.post('/api/session', async (req, res) => {
  const { harnessId } = req.body as { harnessId?: string };
  if (!harnessId) {
    res.status(400).json({ error: 'harnessId is required' });
    return;
  }

  const harness = getHarnessById(harnessId);
  if (!harness) {
    res.status(404).json({ error: `Harness "${harnessId}" not found` });
    return;
  }

  const sessionId = createSession(harnessId, harness.baseConfig);
  console.log(`Session created: ${sessionId} for harness ${harnessId}`);

  const FALLBACK_GREETING =
    'Hello! I can help you configure your container image. What kind of project will your agent be working on?';

  if (isGoosedRunning()) {
    try {
      await startAgentSession(
        harnessId,
        harness.baseConfig.baseImage,
        sessionId,
      );

      sendInstructionsAndGetGreeting(sessionId, harnessId)
        .then((greeting) => {
          setWelcomeMessage(sessionId, greeting || FALLBACK_GREETING);
          console.log(`Welcome message ready for session ${sessionId}`);
        })
        .catch((err) => {
          console.error(`Failed to get greeting for session ${sessionId}:`, err);
          setWelcomeMessage(sessionId, FALLBACK_GREETING);
        });
    } catch (err) {
      console.error(`Failed to start goosed agent for session ${sessionId}:`, err);
      setWelcomeMessage(sessionId, FALLBACK_GREETING);
    }
  } else {
    console.log(`[goose] goosed not running, using fallback greeting for session ${sessionId}`);
    setWelcomeMessage(sessionId, FALLBACK_GREETING);
  }

  res.json({ sessionId });
});

router.post('/api/session/:id/message', async (req, res) => {
  const session = getSession(req.params.id);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const { message } = req.body as { message?: string };
  if (!message) {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  if (!isGoosedRunning()) {
    res.json({
      content:
        'Goose is not running. Start the backend with goosed available to enable AI chat.\n\n' +
        'Install Goose: `brew install block-goose-cli`, then run `goose configure`.\n' +
        'Then restart the server.',
    });
    return;
  }

  try {
    await sendMessage(req.params.id, message, res);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[goose] Message proxy error:', errMsg);
    if (!res.headersSent) {
      res.status(502).json({ error: `Goose error: ${errMsg}` });
    } else {
      res.end();
    }
  }
});

router.get('/api/session/:id/spec', async (req, res) => {
  const spec = getSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  res.json(spec);
});

router.get('/api/session/:id/welcome', async (req, res) => {
  const session = getSession(req.params.id);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const message = getWelcomeMessage(req.params.id);
  if (message) {
    res.json({ message });
  } else {
    res.status(202).json({ status: 'generating' });
  }
});

router.post('/api/session/:id/spec', async (req, res) => {
  const session = getSession(req.params.id);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const spec = req.body;
  updateSpec(req.params.id, spec);
  res.json({ ok: true });
});

export default router;
