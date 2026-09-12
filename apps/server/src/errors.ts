export interface SkilletErrorInput {
  message: string;
  method: string;
  service: string;
  error: unknown;
  code?: string;
  status?: number;
}

export class SkilletError extends Error {
  readonly method: string;
  readonly service: string;
  readonly code: string;
  readonly status: number;

  constructor(input: SkilletErrorInput) {
    super(input.message, { cause: input.error });
    this.name = 'SkilletError';
    this.method = input.method;
    this.service = input.service;
    if (input.code) {
      this.code = input.code;
    } else {
      this.code = 'SKILLET_ERROR';
    }
    if (input.status) {
      this.status = input.status;
    } else {
      this.status = 500;
    }
  }
}

export function isSkilletError(value: unknown): value is SkilletError {
  return value instanceof SkilletError;
}
