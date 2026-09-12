type ValidationSeverity = 'error' | 'warning';

export interface ValidationError {
  code: string;
  message: string;
  severity: ValidationSeverity;
}

export interface SkillFrontmatter {
  name: string;
  description: string;
  paths: string[];
  disableModelInvocation: boolean;
  userInvocable: boolean;
  allowedTools: string;
  disallowedTools: string;
  license: string;
  compatibility: string;
  model: string;
  agent: string;
  context: string;
  metadata: Record<string, string>;
  extras: Record<string, unknown>;
  presentKeys: string[];
}

export interface ParsedSkillFile {
  frontmatter: SkillFrontmatter;
  body: string;
  errors: ValidationError[];
}
