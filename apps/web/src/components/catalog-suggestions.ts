import type { CatalogSkill } from '../api/client';

export const catalogSuggestions: (CatalogSkill & { description: string })[] = [
  { source: 'kadajett/agent-nestjs-skills', slug: 'nestjs-best-practices', name: 'NestJS best practices', description: 'Build and review NestJS APIs with consistent architecture and patterns.' },
  { source: 'cloudflare/skills', slug: 'workers-best-practices', name: 'Cloudflare Workers', description: 'Build and review production Workers with Cloudflare’s best practices.' },
  { source: 'cloudflare/skills', slug: 'wrangler', name: 'Wrangler', description: 'Develop and deploy Cloudflare Workers using the Wrangler CLI.' },
  { source: 'microsoft/playwright-cli', slug: 'playwright-cli', name: 'Playwright', description: 'Automate browsers to test and inspect websites.' },
  { source: 'cloudflare/skills', slug: 'durable-objects', name: 'Durable Objects', description: 'Build stateful services and coordinate work with Cloudflare Durable Objects.' }
];
