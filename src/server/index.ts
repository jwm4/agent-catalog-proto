import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { URL } from 'url';
import catalogRouter from './routes/catalog.js';
import sessionRouter from './routes/session.js';
import buildRouter from './routes/build.js';
import deployRouter from './routes/deploy.js';
import { addWsClient, removeWsClient } from './services/session-manager.js';
import { findGooseBinary, startGoosed, stopGoosed } from './services/goose.js';

const app = express();
const PORT = 3001;

app.use(express.json());

app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (_req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(catalogRouter);
app.use(sessionRouter);
app.use(buildRouter);
app.use(deployRouter);

const server = createServer(app);

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '', `http://localhost:${PORT}`);
  const sessionId = url.searchParams.get('sessionId');

  if (!sessionId) {
    ws.close(1008, 'sessionId query parameter is required');
    return;
  }

  addWsClient(sessionId, ws);
  console.log(`WebSocket client connected for session ${sessionId}`);

  ws.on('close', () => {
    removeWsClient(sessionId, ws);
    console.log(`WebSocket client disconnected for session ${sessionId}`);
  });

  ws.on('error', (err) => {
    console.error(`WebSocket error for session ${sessionId}:`, err.message);
    removeWsClient(sessionId, ws);
  });
});

server.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);

  if (findGooseBinary()) {
    console.log('[goose] Goose binary found, starting goosed...');
    startGoosed()
      .then(({ port }) => {
        console.log(`[goose] goosed running on port ${port}, ACP initialized`);
      })
      .catch((err) => {
        console.warn('[goose] Failed to start goosed:', (err as Error).message);
        console.warn('[goose] Chat will return placeholder responses.');
      });
  } else {
    console.log('[goose] Goose binary not found. Install with: brew install block-goose-cli');
    console.log('[goose] Chat will return placeholder responses until goosed is available.');
  }
});

process.on('SIGINT', () => {
  stopGoosed();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopGoosed();
  process.exit(0);
});
