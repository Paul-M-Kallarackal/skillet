import type { Context, Next } from 'hono';
import { SkilletError } from './errors';

const SERVICE = 'SecurityMiddleware';
const ALLOWED_ORIGINS = ['http://localhost:5180', 'http://127.0.0.1:5180'];
const CLIENT_HEADER = 'x-skillet-client';
const CLIENT_VALUE = 'skillet-web';
const MUTATING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

export const REQUIRED_CLIENT_HEADER = CLIENT_HEADER;
export const REQUIRED_CLIENT_VALUE = CLIENT_VALUE;

export async function guardMutations(c: Context, next: Next): Promise<void> {
  try {
    if (!MUTATING_METHODS.includes(c.req.method)) {
      await next();
      return;
    }
    const origin = c.req.header('origin');
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      throw new SkilletError({
        message: `refusing a write from origin ${origin}`,
        method: 'guardMutations',
        service: SERVICE,
        error: null,
        code: 'FORBIDDEN_ORIGIN',
        status: 403
      });
    }
    if (c.req.header(CLIENT_HEADER) !== CLIENT_VALUE) {
      throw new SkilletError({
        message: `writes require the ${CLIENT_HEADER} header, so a page on another site cannot reach this API`,
        method: 'guardMutations',
        service: SERVICE,
        error: null,
        code: 'MISSING_CLIENT_HEADER',
        status: 403
      });
    }
    await next();
  } catch (error) {
    if (error instanceof SkilletError) {
      throw error;
    }
    throw new SkilletError({
      message: 'request guard failed',
      method: 'guardMutations',
      service: SERVICE,
      error
    });
  }
}
