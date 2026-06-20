import { Router } from 'express';
import { harnesses, getHarnessById } from '../../client/data/harnesses.js';

const router = Router();

router.get('/api/catalog', async (_req, res) => {
  const summaries = harnesses.map((h) => ({
    id: h.id,
    name: h.name,
    description: h.description,
    tags: h.tags,
    icon: h.icon,
    license: h.license,
    documentationUrl: h.documentationUrl,
  }));
  res.json(summaries);
});

router.get('/api/catalog/:id', async (req, res) => {
  const harness = getHarnessById(req.params.id);
  if (!harness) {
    res.status(404).json({ error: 'Harness not found' });
    return;
  }
  res.json(harness);
});

export default router;
