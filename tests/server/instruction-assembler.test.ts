import { assembleInstructions } from '@server/services/instruction-assembler.js';

describe('assembleInstructions', () => {
  it('includes system prompt content for a known harness', () => {
    const result = assembleInstructions('opencode');
    expect(result).toContain('---');
    expect(result.length).toBeGreaterThan(100);
  });

  it('includes harness-specific content for opencode', () => {
    const result = assembleInstructions('opencode');
    expect(result.toLowerCase()).toContain('opencode');
  });

  it('uses fallback text for unknown harness', () => {
    const result = assembleInstructions('nonexistent-harness');
    expect(result).toContain('No specific harness documentation available');
    expect(result).toContain('nonexistent-harness');
  });

  it('includes config schema when available', () => {
    const result = assembleInstructions('opencode');
    expect(result).toContain('Available Configuration Options');
  });

  it('omits config schema section for harness without schema', () => {
    const result = assembleInstructions('nonexistent-harness');
    expect(result).not.toContain('Available Configuration Options');
  });

  it('ends with conversation prompt', () => {
    const result = assembleInstructions('opencode');
    expect(result).toContain('Begin the conversation');
  });

  it('includes security guidance', () => {
    const result = assembleInstructions('opencode');
    expect(result.toLowerCase()).toContain('secret');
  });

  it('separates sections with dividers', () => {
    const result = assembleInstructions('opencode');
    const dividerCount = (result.match(/\n\n---\n\n/g) || []).length;
    expect(dividerCount).toBeGreaterThanOrEqual(3);
  });
});
