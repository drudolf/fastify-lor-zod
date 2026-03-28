#!/usr/bin/env node

/**
 * Test-spec tooling: links test-spec.md to actual test implementations.
 *
 * Usage:
 *   pnpm test:spec-check              — verify spec ↔ test alignment (runs vitest for accuracy)
 *   pnpm test:spec-check --no-run     — fast file-based check (no vitest, for pre-commit)
 *   pnpm test:spec-check --strict     — also fail on it.todo() entries (for main branch CI)
 *   pnpm test:scaffold                — generate it.todo() stubs for unimplemented spec entries
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const specPath = resolve(root, 'test-spec.md');

// --- CLI flags ---

const args = process.argv.slice(2);
const command = args[0];
const flags = new Set(args.slice(1));
const noRun = flags.has('--no-run');
const strict = flags.has('--strict');

// --- Spec parser ---

interface SpecEntry {
  name: string;
  checked: boolean;
  file: string;
  section: string;
  subsection: string;
  line: number;
}

const parseSpec = (): SpecEntry[] => {
  const content = readFileSync(specPath, 'utf-8');
  const lines = content.split('\n');
  const entries: SpecEntry[] = [];

  let currentFile = '';
  let currentSection = '';
  let currentSubsection = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // ## Section (`filename.test.ts`) — N tests
    const sectionMatch = line.match(/^## .+\(`([^)]+\.test\.ts)`\)/);
    if (sectionMatch) {
      currentFile = `src/${sectionMatch[1]}`;
      currentSection = line
        .replace(/^## /, '')
        .replace(/\s*\(.+$/, '')
        .trim();
      currentSubsection = '';
      continue;
    }

    // ### Subsection
    const subsectionMatch = line.match(/^### (.+?)(?:\s*—.*)?$/);
    if (subsectionMatch) {
      currentSubsection = subsectionMatch[1].trim();
      continue;
    }

    // - [x] or - [ ] test name
    const entryMatch = line.match(/^- \[([ x])\] (.+)$/);
    if (entryMatch && currentFile) {
      entries.push({
        name: entryMatch[2].trim(),
        checked: entryMatch[1] === 'x',
        file: currentFile,
        section: currentSection,
        subsection: currentSubsection,
        line: i + 1,
      });
    }
  }

  return entries;
};

// --- Test file parser ---

interface TestEntry {
  name: string;
  file: string;
  todo: boolean;
  line: number;
}

const parseTestsViaVitest = (): TestEntry[] => {
  const output = execSync('pnpm vitest run --reporter=json 2>/dev/null', {
    cwd: root,
    encoding: 'utf-8',
    timeout: 60_000,
  });
  const json = JSON.parse(output);
  const entries: TestEntry[] = [];

  for (const file of json.testResults) {
    const rel = file.name.replace(`${root}/`, '');
    for (const t of file.assertionResults) {
      entries.push({
        name: t.title,
        file: rel,
        todo: t.status === 'todo',
        line: 0,
      });
    }
  }

  return entries;
};

const parseTestFiles = (): TestEntry[] => {
  const entries: TestEntry[] = [];
  const testFiles = execSync('find src -name "*.test.ts"', {
    cwd: root,
    encoding: 'utf-8',
  })
    .trim()
    .split('\n')
    .filter(Boolean);

  for (const file of testFiles) {
    const content = readFileSync(resolve(root, file), 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Match it('name', ...) or it.todo('name')
      const itMatch = line.match(/\bit(\.todo)?\(\s*['"](.+?)['"]/);
      if (itMatch) {
        entries.push({
          name: itMatch[2],
          file,
          todo: itMatch[1] === '.todo',
          line: i + 1,
        });
      }
    }
  }

  return entries;
};

const parseTests = (): TestEntry[] => {
  if (noRun) return parseTestFiles();
  try {
    return parseTestsViaVitest();
  } catch {
    return parseTestFiles();
  }
};

// --- Fuzzy matching ---

const normalize = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const findMatch = (specName: string, tests: TestEntry[], file: string): TestEntry | undefined => {
  const norm = normalize(specName);
  // Exact match in same file first
  const exact = tests.find((t) => t.file === file && normalize(t.name) === norm);
  if (exact) return exact;
  // Exact match in any file
  const anyFile = tests.find((t) => normalize(t.name) === norm);
  if (anyFile) return anyFile;
  // Substring match in same file
  return tests.find(
    (t) =>
      t.file === file && (normalize(t.name).includes(norm) || norm.includes(normalize(t.name))),
  );
};

// --- Commands ---

const check = () => {
  const specEntries = parseSpec();
  const testEntries = parseTests();

  let errors = 0;
  let todos = 0;
  let matched = 0;

  // Check spec entries have matching tests
  const unmatchedSpec: SpecEntry[] = [];
  const todoSpec: SpecEntry[] = [];
  const matchedTests = new Set<string>();

  for (const spec of specEntries) {
    const match = findMatch(spec.name, testEntries, spec.file);
    if (!match) {
      unmatchedSpec.push(spec);
      errors++;
    } else if (match.todo) {
      todoSpec.push(spec);
      todos++;
      matchedTests.add(`${match.file}:${normalize(match.name)}`);
    } else {
      matched++;
      matchedTests.add(`${match.file}:${normalize(match.name)}`);
    }
  }

  // Check for orphan tests (in test files but not in spec)
  const orphanTests = testEntries.filter(
    (t) => !matchedTests.has(`${t.file}:${normalize(t.name)}`),
  );

  if (unmatchedSpec.length > 0) {
    console.log('Missing implementations:');
    for (const s of unmatchedSpec) {
      console.log(`  ✗ ${s.file} — "${s.name}" (spec line ${s.line})`);
    }
    console.log('');
  }

  if (todoSpec.length > 0) {
    console.log('Todo (stubbed but not implemented):');
    for (const s of todoSpec) {
      console.log(`  ○ ${s.file} — "${s.name}"`);
    }
    console.log('');
  }

  if (orphanTests.length > 0) {
    console.log('Orphan tests (not in spec):');
    for (const t of orphanTests) {
      console.log(`  ? ${t.file} — "${t.name}"`);
    }
    console.log('');
  }

  console.log(`Spec entries: ${specEntries.length}`);
  console.log(`  Matched:    ${matched}`);
  console.log(`  Todo:       ${todos}`);
  console.log(`  Missing:    ${unmatchedSpec.length}`);
  console.log(`  Orphans:    ${orphanTests.length}`);
  console.log('');

  if (errors > 0) {
    console.log('FAIL — spec and tests are out of sync');
    process.exit(1);
  }

  if (strict && todos > 0) {
    console.log('FAIL — it.todo() tests not allowed in strict mode');
    process.exit(1);
  }

  if (todos > 0) {
    console.log('WARN — some tests are still todo');
    process.exit(0);
  }

  console.log('OK — spec and tests are in sync');
};

const scaffold = () => {
  const specEntries = parseSpec();
  const testEntries = parseTestFiles();

  // Group spec entries by file
  const byFile = new Map<string, SpecEntry[]>();
  for (const spec of specEntries) {
    const match = findMatch(spec.name, testEntries, spec.file);
    if (!match) {
      const list = byFile.get(spec.file) ?? [];
      list.push(spec);
      byFile.set(spec.file, list);
    }
  }

  if (byFile.size === 0) {
    console.log('All spec entries already have test implementations.');
    return;
  }

  for (const [file, entries] of byFile) {
    const filePath = resolve(root, file);

    if (!existsSync(filePath)) {
      console.log(`Creating ${file} with ${entries.length} todo test(s)`);
      const content = generateNewTestFile(entries);
      writeFileSync(filePath, content);
      continue;
    }

    // Append todos before the last closing });
    const content = readFileSync(filePath, 'utf-8');
    const todoBlock = entries.map((e) => `  it.todo('${e.name}');`).join('\n');

    // Find the last }); and insert before it
    const lastClose = content.lastIndexOf('});');
    if (lastClose === -1) {
      console.log(`  ⚠ Could not find closing }); in ${file}, skipping`);
      continue;
    }

    const updated = `${content.slice(0, lastClose)}  // --- Scaffolded from test-spec.md ---\n${todoBlock}\n${content.slice(lastClose)}`;
    writeFileSync(filePath, updated);
    console.log(`Scaffolded ${entries.length} todo test(s) in ${file}`);
  }
};

const generateNewTestFile = (entries: SpecEntry[]): string => {
  const todos = entries.map((e) => `  it.todo('${e.name}');`).join('\n');
  const section = entries[0]?.section ?? 'tests';
  return `describe('${section}', () => {\n${todos}\n});\n`;
};

// --- CLI ---

if (command === 'check') {
  check();
} else if (command === 'scaffold') {
  scaffold();
} else {
  console.log('Usage: test-spec.ts <check|scaffold> [flags]');
  console.log('');
  console.log('Commands:');
  console.log('  check       verify spec ↔ test alignment');
  console.log('  scaffold    generate it.todo() stubs for unimplemented spec entries');
  console.log('');
  console.log('Flags (check only):');
  console.log('  --no-run    fast file-based check, skip vitest (for pre-commit)');
  console.log('  --strict    fail on it.todo() entries (for main branch CI)');
  process.exit(1);
}
