import { execFileSync } from 'node:child_process';
export default function setup() {
  // Optional local CLI config supports a restrictive development environment.
  // Production and ordinary local runs use standard Prisma migrate deploy.
  const extra = process.env.TEST_PRISMA_CONFIG ? ['--config', process.env.TEST_PRISMA_CONFIG] : [];
  execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy', ...extra], {
    env: process.env, stdio: 'inherit',
  });
}
