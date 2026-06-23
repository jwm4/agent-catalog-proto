import { assembleInstructions } from '@server/services/instruction-assembler.js';

describe('assembleInstructions', () => {
  it('includes harness context for opencode', () => {
    const result = assembleInstructions('opencode');
    expect(result).toContain('Current Harness: OpenCode');
    expect(result).toContain('container-customizer skill');
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

  it('does not include full system prompt or security guidance', () => {
    const result = assembleInstructions('opencode');
    expect(result).not.toContain('Container Customization Assistant');
    expect(result).not.toContain('Container Security Posture');
  });

  it('separates sections with dividers', () => {
    const result = assembleInstructions('opencode');
    const dividerCount = (result.match(/\n\n---\n\n/g) || []).length;
    expect(dividerCount).toBeGreaterThanOrEqual(1);
  });

  it('references the harness resource file', () => {
    const result = assembleInstructions('opencode');
    expect(result).toContain('resources/opencode.md');
  });
});
