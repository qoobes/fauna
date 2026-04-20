import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['playwright', 'playwright-core', '@axe-core/playwright'],
};

export default config;
