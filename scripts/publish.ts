import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const pkgPath = './package.json';
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as Record<string, unknown>;
const { name, version } = pkg as { name: string; version: string };

try {
  execSync(`npm view ${name}@${version} version`, { stdio: 'ignore' });
  console.log(`${name}@${version} is already published, skipping`);
  process.exit(0);
} catch {
  // Not published yet, proceed
}

// npm 11+ no longer embeds readme in per-version registry metadata.
// Inject it into package.json so npmjs.com renders it on the package page.
const readmePath = './README.md';
if (existsSync(readmePath) && !pkg.readme) {
  pkg.readme = readFileSync(readmePath, 'utf-8');
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
}

const isPreRelease = /-(beta|alpha|rc)/.test(version);

execSync(`npm publish${isPreRelease ? ' --tag beta' : ''} --access public --provenance`, {
  stdio: 'inherit',
});
