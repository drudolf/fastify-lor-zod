import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8')) as { version: string };
const isPreRelease = /-(beta|alpha|rc)/.test(version);

execSync(
  `pnpm publish${isPreRelease ? ' --tag beta' : ''} --access public --no-git-checks --provenance`,
  { stdio: 'inherit' },
);
