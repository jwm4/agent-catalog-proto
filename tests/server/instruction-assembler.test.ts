import { assembleInstructions } from '@server/services/instruction-assembler.js';

describe('assembleInstructions', () => {
  it('includes system prompt content for a known harness', () => {
    const result = assembleInstructions('opencode');
    expect(result).toContain('---');
    expect(result.length).toBeGreaterThan(100);
  });

  it('includes harness context line for opencode', () => {
    const result = assembleInstructions('opencode');
    expect(result).toContain('Current Harness: OpenCode');
    expect(result).toContain('opencode-harness skill');
  });

  it('does not include full harness documentation', () => {
    const result = assembleInstructions('opencode');
    expect(result).not.toContain('LLM Provider Setup');
    expect(result).not.toContain('MCP Server Configuration');
  });

  it('uses harness ID as name for unknown harness', () => {
    const result = assembleInstructions('nonexistent-harness');
    expect(result).toContain('Current Harness: nonexistent-harness');
    expect(result).toContain('nonexistent-harness-harness skill');
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

  it('mentions skill-based knowledge in system prompt', () => {
    const result = assembleInstructions('opencode');
    expect(result).toContain('Available Knowledge');
    expect(result).toContain('skill');
  });
});
