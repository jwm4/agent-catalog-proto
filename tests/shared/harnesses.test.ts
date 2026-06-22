import { harnesses, getHarnessById } from '@shared/harnesses';

describe('harnesses data', () => {
  it('has at least one harness defined', () => {
    expect(harnesses.length).toBeGreaterThan(0);
  });

  it('has no duplicate IDs', () => {
    const ids = harnesses.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every harness has required fields', () => {
    for (const h of harnesses) {
      expect(h.id).toBeTruthy();
      expect(h.name).toBeTruthy();
      expect(h.description).toBeTruthy();
      expect(h.readme).toBeTruthy();
      expect(h.baseConfig).toBeDefined();
      expect(h.baseConfig.baseImage).toBeTruthy();
      expect(h.backends.length).toBeGreaterThan(0);
    }
  });

  it('every harness baseConfig.harnessId is not set initially', () => {
    for (const h of harnesses) {
      expect(h.baseConfig.harnessId).toBe(h.id);
    }
  });
});

describe('getHarnessById', () => {
  it('returns the correct harness for a known ID', () => {
    const result = getHarnessById('opencode');
    expect(result).toBeDefined();
    expect(result!.id).toBe('opencode');
    expect(result!.name).toBe('OpenCode');
  });

  it('returns undefined for an unknown ID', () => {
    expect(getHarnessById('nonexistent')).toBeUndefined();
  });

  it('finds every harness by its ID', () => {
    for (const h of harnesses) {
      const found = getHarnessById(h.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(h.id);
    }
  });
});
