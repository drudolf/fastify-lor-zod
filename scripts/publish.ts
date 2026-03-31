import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const { name, version } = JSON.parse(readFileSync('./package.json', 'utf-8')) as {
  name: string;
  version: string;
};

try {
  execSync(`npm view ${name}@${version} version`, { stdio: 'ignore' });
  console.log(`${name}@${version} is already published, skipping`);
  process.exit(0);
} catch {
  // Not published yet, proceed
}

const isPreRelease = /-(beta|alpha|rc)/.test(version);

execSync(`npm publish${isPreRelease ? ' --tag beta' : ''} --access public --provenance`, {
  stdio: 'inherit',
});
