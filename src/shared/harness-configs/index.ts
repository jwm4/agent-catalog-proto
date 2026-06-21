import type { HarnessConfigSchema } from '../types.js';
import { opencodeConfigSchema } from './opencode.js';

const schemas: Record<string, HarnessConfigSchema> = {
  opencode: opencodeConfigSchema,
};

export function getConfigSchema(
  harnessId: string,
): HarnessConfigSchema | undefined {
  return schemas[harnessId];
}

export { opencodeConfigSchema };
