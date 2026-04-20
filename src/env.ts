import { z } from 'zod';

// Edge-safe: this module must NOT call any Node-only APIs (process.cwd, fs, etc.) —
// middleware runs in the Edge runtime and imports this transitively via domain-gate.
// The dotenv-with-override side effect lives in `src/instrumentation.ts` which only
// runs in the Node runtime and fires before any route code evaluates.

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  AUTH_SECRET: z.string().min(32),
  AUTH_URL: z.string().url().optional(),
  RESEND_API_KEY: z.string().startsWith('re_'),
  EMAIL_FROM: z.string(),
  TURSO_DATABASE_URL: z.string().url(),
  TURSO_AUTH_TOKEN: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().startsWith('sk-ant-').optional(),
  ALLOWED_EMAIL_DOMAIN: z.string().default('liverpool.ac.uk'),
  MAX_CONCURRENT_SCANS: z.coerce.number().int().positive().default(3),
  RESULTS_DIR: z.string().default('./results'),
});

type Env = z.infer<typeof schema>;

// Lazy-parsed env. Next.js evaluates page modules during `next build` to collect
// route segment config, which means env.ts gets imported at build time. At that
// point Railway has NOT injected our runtime env vars yet — if we called
// `schema.parse(process.env)` at module load, zod would throw and the build dies.
//
// Instead we parse on first actual access. At runtime every env var is present,
// so validation still happens and bad prod configs still fail loudly on first use.
let cached: Env | undefined;

function isBuild(): boolean {
  // Next.js sets NEXT_PHASE during build/export; we also honor an explicit skip flag.
  return (
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.SKIP_ENV_VALIDATION === '1'
  );
}

function parseEnv(): Env {
  if (cached) return cached;
  if (isBuild()) {
    // Don't fail the build on missing runtime secrets. Return a permissive view —
    // every read during build resolves to `process.env[key]` (possibly undefined).
    // Callers that need strict validation must access env at request time.
    return new Proxy({} as Env, {
      get(_t, prop: string) {
        return process.env[prop];
      },
    });
  }
  cached = schema.parse(process.env);
  return cached;
}

export const env = new Proxy({} as Env, {
  get(_target, prop: string) {
    return parseEnv()[prop as keyof Env];
  },
});
