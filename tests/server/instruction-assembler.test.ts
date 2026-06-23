import { assembleInstructions } from '@server/services/instruction-assembler.js';

describe('assembleInstructions', () => {
  it('includes SKILL.md behavioral guidance', () => {
    const result = assembleInstructions('opencode');
    expect(result).toContain('Container Customization Assistant');
    expect(result).toContain('Ask ONE question at a time');
  });

  it('includes security guidance from SKILL.md', () => {
    const result = assembleInstructions('opencode');
    expect(result).toContain('Secret values must never be sent');
  });

  it('includes harness context for opencode', () => {
    const result = assembleInstructions('opencode');
    expect(result).toContain('Current Harness: OpenCode');
  });

  it('uses harness ID as name for unknown harness', () => {
    const result = assembleInstructions('nonexistent-harness');
    expect(result).toContain('Current Harness: nonexistent-harness');
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

  it('includes reference file paths for the agent', () => {
    const result = assembleInstructions('opencode');
    expect(result).toContain('.agents/skills/container-customizer/resources/');
  });

  it('separates sections with dividers', () => {
    const result = assembleInstructions('opencode');
    const dividerCount = (result.match(/\n\n---\n\n/g) || []).length;
    expect(dividerCount).toBeGreaterThanOrEqual(2);
  });

  it('includes tool documentation', () => {
    const result = assembleInstructions('opencode');
    expect(result).toContain('addPackage');
    expect(result).toContain('setEnvVar');
    expect(result).toContain('addSecret');
  });
});
