// Next.js calls `register()` once at server startup, before any route or middleware
// code evaluates. We use it to load .env with override=true so the project's .env
// always takes precedence over shell-level environment variables.
//
// This only runs in the Node.js runtime; the Edge runtime doesn't support `fs`/`process.cwd`.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { config } = await import('dotenv');
    config({ path: '.env', override: true, quiet: true });
  }
}
