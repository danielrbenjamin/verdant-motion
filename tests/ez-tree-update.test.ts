import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareUpdate, applyUpdate, discardUpdate } from '../scripts/ez-tree-update.mjs';

const temporary: string[] = [];
afterEach(() => {
  for (const directory of temporary.splice(0)) rmSync(directory, { recursive: true, force: true });
});
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'verdant-update-test-'));
  temporary.push(root);
  const source = join(root, 'upstream'),
    project = join(root, 'project'),
    directory = join(project, 'packages/ez-tree');
  mkdirSync(join(source, 'src/lib'), { recursive: true });
  mkdirSync(join(directory, 'src'), { recursive: true });
  const git = (...args: string[]) =>
    execFileSync(
      'git',
      [
        '-C',
        source,
        '-c',
        'core.autocrlf=false',
        '-c',
        'core.excludesFile=',
        '-c',
        'user.name=Test',
        '-c',
        'user.email=test@example.invalid',
        ...args,
      ],
      { windowsHide: true },
    )
      .toString()
      .trim();
  git('init', '-q');
  const original = 'export const base = 1;\n\n// spacer\n\nexport const end = 1;\n';
  writeFileSync(join(source, 'src/lib/index.js'), original);
  writeFileSync(join(source, 'LICENSE'), 'MIT fixture\n');
  git('add', '.');
  git('commit', '-qm', 'base');
  const base = git('rev-parse', 'HEAD');
  writeFileSync(join(directory, 'src/index.js'), original.replace('base = 1', 'base = 2'));
  writeFileSync(join(directory, 'LICENSE'), 'MIT fixture\n');
  writeFileSync(join(directory, 'UPSTREAM.md'), `Base: ${base}\n`);
  writeFileSync(
    join(directory, 'upstream.json'),
    JSON.stringify({ revision: base, sourcePath: 'src/lib', defaultRef: 'HEAD' }),
  );
  return { source, project, directory, git, original, base };
}
describe('EZ Tree update workflow', () => {
  it('three-way merges upstream changes while preserving local extensions, then applies', () => {
    const f = fixture();
    writeFileSync(join(f.source, 'src/lib/index.js'), f.original.replace('end = 1', 'end = 3'));
    f.git('add', '.');
    f.git('commit', '-qm', 'upstream change');
    const report = prepareUpdate({ root: f.project, source: f.source, ref: 'HEAD' });
    expect(report.conflicts).toEqual([]);
    expect(readFileSync(join(f.directory, 'src/index.js'), 'utf8')).toContain('end = 1');
    const candidate = readFileSync(
      join(f.project, '.ez-tree-update/candidate/src/index.js'),
      'utf8',
    );
    expect(candidate).toContain('base = 2');
    expect(candidate).toContain('end = 3');
    let validated = false;
    applyUpdate({
      root: f.project,
      validate: () => {
        validated = true;
      },
    });
    expect(validated).toBe(true);
    expect(readFileSync(join(f.directory, 'src/index.js'), 'utf8')).toBe(candidate);
    expect(JSON.parse(readFileSync(join(f.directory, 'upstream.json'), 'utf8')).revision).toBe(
      report.to,
    );
    expect(existsSync(join(f.project, '.ez-tree-update'))).toBe(false);
  });
  it('stages conflicts without changing the working generator and refuses to apply', () => {
    const f = fixture();
    writeFileSync(join(f.source, 'src/lib/index.js'), f.original.replace('base = 1', 'base = 9'));
    f.git('add', '.');
    f.git('commit', '-qm', 'conflicting upstream change');
    const report = prepareUpdate({ root: f.project, source: f.source, ref: 'HEAD' });
    expect(report.conflicts).toContain('src/index.js');
    expect(() => applyUpdate({ root: f.project, validate: () => {} })).toThrow(
      'Unresolved conflict',
    );
    expect(readFileSync(join(f.directory, 'src/index.js'), 'utf8')).toContain('base = 2');
    discardUpdate(f.project);
  });
  it('refuses stale candidates when local changes were made after staging', () => {
    const f = fixture();
    prepareUpdate({ root: f.project, source: f.source, ref: 'HEAD' });
    writeFileSync(join(f.directory, 'src/custom.js'), '// new local code\n');
    expect(() => applyUpdate({ root: f.project, validate: () => {} })).toThrow(
      'changed since staging',
    );
    expect(readFileSync(join(f.directory, 'src/custom.js'), 'utf8')).toContain('new local code');
  });
  it('rolls back source and revision when validation fails', () => {
    const f = fixture();
    writeFileSync(join(f.source, 'src/lib/index.js'), f.original.replace('end = 1', 'end = 3'));
    f.git('add', '.');
    f.git('commit', '-qm', 'upstream change');
    prepareUpdate({ root: f.project, source: f.source, ref: 'HEAD' });
    expect(() =>
      applyUpdate({
        root: f.project,
        validate: () => {
          throw new Error('compatibility check failed');
        },
      }),
    ).toThrow('original generator restored');
    expect(readFileSync(join(f.directory, 'src/index.js'), 'utf8')).toContain('end = 1');
    expect(readFileSync(join(f.directory, 'src/index.js'), 'utf8')).toContain('base = 2');
    expect(JSON.parse(readFileSync(join(f.directory, 'upstream.json'), 'utf8')).revision).toBe(
      f.base,
    );
  });
});

it('requires resolved conflicts to be marker-free before applying', () => {
  const f = fixture();
  writeFileSync(join(f.source, 'src/lib/index.js'), f.original.replace('base = 1', 'base = 9'));
  f.git('add', '.');
  f.git('commit', '-qm', 'conflict');
  prepareUpdate({ root: f.project, source: f.source, ref: 'HEAD' });
  writeFileSync(join(f.project, '.ez-tree-update/resolved.json'), '["src/index.js"]');
  expect(() => applyUpdate({ root: f.project, validate: () => {} })).toThrow('Conflict markers');
  writeFileSync(
    join(f.project, '.ez-tree-update/candidate/src/index.js'),
    'export const resolved = 3;\n',
  );
  applyUpdate({ root: f.project, validate: () => {} });
  expect(readFileSync(join(f.directory, 'src/index.js'), 'utf8')).toContain('resolved = 3');
});

it('preserves local-only files while accepting upstream file additions', () => {
  const f = fixture();
  writeFileSync(join(f.directory, 'src/local-extension.js'), '// local\n');
  writeFileSync(join(f.source, 'src/lib/upstream-feature.js'), '// upstream\n');
  f.git('add', '.');
  f.git('commit', '-qm', 'new upstream file');
  const report = prepareUpdate({ root: f.project, source: f.source, ref: 'HEAD' });
  expect(report.conflicts).toEqual([]);
  applyUpdate({ root: f.project, validate: () => {} });
  expect(readFileSync(join(f.directory, 'src/local-extension.js'), 'utf8')).toBe('// local\n');
  expect(readFileSync(join(f.directory, 'src/upstream-feature.js'), 'utf8')).toBe('// upstream\n');
});
