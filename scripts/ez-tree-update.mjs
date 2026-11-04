import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  cpSync,
  renameSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const STAGE_NAME = '.ez-tree-update';
const PACKAGE = 'packages/ez-tree';
const canonical = (content) =>
  content.includes(0) ? content : Buffer.from(content.toString('utf8').replaceAll('\r\n', '\n'));
const sha = (value) => createHash('sha256').update(value).digest('hex');
const json = (path) => JSON.parse(readFileSync(path, 'utf8'));
function write(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value);
}
function git(repo, args) {
  return execFileSync(
    'git',
    ['-c', `safe.directory=${repo.replaceAll('\\', '/')}`, '-C', repo, ...args],
    { maxBuffer: 32 * 1024 * 1024, windowsHide: true },
  );
}
function files(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      if (entry.isSymbolicLink())
        throw new Error(`Symlinks are not supported in generator source: ${entry.name}`);
      return entry.isDirectory()
        ? files(join(directory, entry.name)).map((name) => `${entry.name}/${name}`)
        : [entry.name];
    })
    .sort();
}
function snapshot(root) {
  const directory = join(root, PACKAGE);
  return Object.fromEntries(
    [
      'LICENSE',
      'upstream.json',
      'UPSTREAM.md',
      ...files(join(directory, 'src')).map((f) => `src/${f}`),
    ]
      .filter((f) => existsSync(join(directory, f)))
      .sort()
      .map((f) => [f, sha(readFileSync(join(directory, f)))]),
  );
}
function revision(repo, ref) {
  if (!ref || ref.startsWith('-') || /[\r\n\0]/.test(ref)) throw new Error('Invalid upstream ref');
  return git(repo, ['rev-parse', '--verify', `${ref}^{commit}`])
    .toString()
    .trim();
}
function upstreamFiles(repo, commit, sourcePath) {
  const result = new Map();
  const records = git(repo, ['ls-tree', '-rz', commit, '--', sourcePath, 'LICENSE'])
    .toString()
    .split('\0')
    .filter(Boolean);
  for (const record of records) {
    const [info, name] = record.split('\t');
    if (!info.startsWith('100644 blob ') && !info.startsWith('100755 blob '))
      throw new Error(`Unsupported upstream file: ${name}`);
    const target = name === 'LICENSE' ? name : `src/${name.slice(sourcePath.length + 1)}`;
    if (target.includes('..') || target.includes('\\') || target.startsWith('/'))
      throw new Error(`Unsafe source path: ${target}`);
    result.set(target, canonical(git(repo, ['show', `${commit}:${name}`])));
  }
  if (!result.has('src/index.js') || !result.has('LICENSE'))
    throw new Error('Upstream generator layout or license changed; review manually.');
  return result;
}
const equal = (a, b) => (a === undefined ? b === undefined : b !== undefined && a.equals(b));

/** Stage a three-way merge of current local files against old and new upstream commits.
 * @param {{root?: string, ref?: string, source?: string}} [options]
 */
export function prepareUpdate({ root = ROOT, ref, source } = {}) {
  root = resolve(root);
  const stage = join(root, STAGE_NAME),
    directory = join(root, PACKAGE);
  if (existsSync(stage))
    throw new Error('An update is already staged. Review it, then use --apply or --discard first.');
  const metadata = json(join(directory, 'upstream.json'));
  ref ??= metadata.defaultRef;
  mkdirSync(stage);
  const fetchRepo = join(stage, 'fetch');
  try {
    let repo;
    let target;
    if (source) {
      repo = resolve(source);
      target = revision(repo, ref);
    } else {
      mkdirSync(fetchRepo);
      git(fetchRepo, ['init', '--quiet']);
      git(fetchRepo, ['fetch', '--quiet', '--depth=1', metadata.repository, metadata.revision]);
      git(fetchRepo, ['fetch', '--quiet', '--depth=1', metadata.repository, ref]);
      repo = fetchRepo;
      target = revision(repo, 'FETCH_HEAD');
    }
    const base = upstreamFiles(repo, metadata.revision, metadata.sourcePath);
    const incoming = upstreamFiles(repo, target, metadata.sourcePath);
    const local = new Map(
      ['LICENSE', ...files(join(directory, 'src')).map((f) => `src/${f}`)].map((f) => [
        f,
        readFileSync(join(directory, f)),
      ]),
    );
    const conflicts = [],
      changes = [];
    const names = [...new Set([...base.keys(), ...incoming.keys(), ...local.keys()])].sort();
    for (const name of names) {
      const old = base.get(name),
        ours = local.get(name),
        theirs = incoming.get(name);
      let merged;
      if (equal(ours, old)) merged = theirs;
      else if (equal(theirs, old) || equal(ours, theirs)) merged = ours;
      else if (
        !old ||
        !ours ||
        !theirs ||
        [old, ours, theirs].some((content) => content.includes(0))
      ) {
        // Add/add, delete/modify, and binary conflicts require a deliberate resolution.
        conflicts.push(name);
        merged = ours ?? theirs;
      } else {
        const work = join(stage, 'merge');
        mkdirSync(work, { recursive: true });
        for (const [label, content] of [
          ['local', ours],
          ['base', old],
          ['upstream', theirs],
        ])
          write(join(work, label), content);
        const result = spawnSync(
          'git',
          [
            'merge-file',
            '--diff3',
            '-p',
            '-L',
            'local',
            '-L',
            'base',
            '-L',
            'upstream',
            join(work, 'local'),
            join(work, 'base'),
            join(work, 'upstream'),
          ],
          { maxBuffer: 32 * 1024 * 1024, windowsHide: true },
        );
        if (result.error) throw result.error;
        if (result.status === null || result.status < 0 || result.status >= 128)
          throw new Error(result.stderr?.toString() || 'Merge failed');
        if (result.status !== 0) conflicts.push(name);
        merged = result.stdout;
      }
      if (merged) write(join(stage, 'candidate', name), merged);
      if (!equal(merged, ours)) changes.push(name);
      for (const [label, content] of [
        ['base', old],
        ['local', ours],
        ['upstream', theirs],
      ]) {
        if (content) write(join(stage, label, name), content);
      }
    }
    const report = {
      from: metadata.revision,
      to: target,
      ref,
      changes,
      conflicts,
      localSnapshot: snapshot(root),
      candidateSnapshot: Object.fromEntries(
        files(join(stage, 'candidate')).map((f) => [
          f,
          sha(readFileSync(join(stage, 'candidate', f))),
        ]),
      ),
    };
    write(join(stage, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
    console.log(
      `Staged ${metadata.revision.slice(0, 12)} -> ${target.slice(0, 12)}: ${changes.length} changed files, ${conflicts.length} conflicts.`,
    );
    console.log('Local generator is unchanged. Review .ez-tree-update/report.json and candidate/.');
    return report;
  } catch (error) {
    rmSync(stage, { recursive: true, force: true });
    throw error;
  } finally {
    rmSync(fetchRepo, { recursive: true, force: true });
    rmSync(join(stage, 'merge'), { recursive: true, force: true });
  }
}
function validateProject(root) {
  if (!process.env.npm_execpath)
    throw new Error('Apply with npm run ez-tree:update -- --apply so validation can run.');
  for (const script of ['check', 'test', 'build']) {
    execFileSync(process.execPath, [process.env.npm_execpath, 'run', script], {
      cwd: root,
      stdio: 'inherit',
      windowsHide: true,
    });
  }
}
export function applyUpdate({ root = ROOT, validate = validateProject } = {}) {
  root = resolve(root);
  const stage = join(root, STAGE_NAME),
    directory = join(root, PACKAGE);
  const report = json(join(stage, 'report.json'));
  if (JSON.stringify(snapshot(root)) !== JSON.stringify(report.localSnapshot))
    throw new Error(
      'Local generator changed since staging. Discard and stage again to preserve those edits.',
    );
  if (existsSync(join(stage, 'backup')))
    throw new Error('Backup already exists; review the previous apply attempt.');
  // Conflict files may be edited in candidate/. Resolutions must explicitly be acknowledged.
  const resolution = existsSync(join(stage, 'resolved.json'))
    ? json(join(stage, 'resolved.json'))
    : [];
  for (const file of report.conflicts) {
    if (!resolution.includes(file))
      throw new Error(
        `Unresolved conflict: ${file}. Edit candidate/, then list this path in resolved.json.`,
      );
  }
  for (const name of files(join(stage, 'candidate'))) {
    const content = readFileSync(join(stage, 'candidate', name), 'utf8');
    if (/^(<<<<<<<|\|\|\|\|\|\|\||=======|>>>>>>>)/m.test(content))
      throw new Error(`Conflict markers remain in ${name}`);
  }
  if (
    !existsSync(join(stage, 'candidate/src/index.js')) ||
    !existsSync(join(stage, 'candidate/LICENSE'))
  )
    throw new Error('Candidate entry point or license is missing.');
  const backup = join(stage, 'backup');
  mkdirSync(backup);
  for (const name of ['LICENSE', 'upstream.json', 'UPSTREAM.md'])
    if (existsSync(join(directory, name))) cpSync(join(directory, name), join(backup, name));
  renameSync(join(directory, 'src'), join(backup, 'src'));
  try {
    cpSync(join(stage, 'candidate/src'), join(directory, 'src'), { recursive: true });
    cpSync(join(stage, 'candidate/LICENSE'), join(directory, 'LICENSE'));
    const metadata = json(join(directory, 'upstream.json'));
    metadata.revision = report.to;
    write(join(directory, 'upstream.json'), `${JSON.stringify(metadata, null, 2)}\n`);
    const provenance = readFileSync(join(directory, 'UPSTREAM.md'), 'utf8').replace(
      report.from,
      report.to,
    );
    write(join(directory, 'UPSTREAM.md'), provenance);
    validate(root);
  } catch (error) {
    rmSync(join(directory, 'src'), { recursive: true, force: true });
    renameSync(join(backup, 'src'), join(directory, 'src'));
    for (const name of ['LICENSE', 'upstream.json', 'UPSTREAM.md'])
      if (existsSync(join(backup, name))) cpSync(join(backup, name), join(directory, name));
    rmSync(backup, { recursive: true, force: true });
    throw new Error(
      `Update failed; original generator restored. Candidate retained for review. ${error.message}`,
    );
  }
  console.log(
    'Update applied; type checks, tests and builds passed. Review the source diff before committing.',
  );
  rmSync(stage, { recursive: true, force: true });
}
export function discardUpdate(root = ROOT) {
  const stage = join(resolve(root), STAGE_NAME);
  if (existsSync(join(stage, 'backup')))
    throw new Error('A backup exists. Recover it before discarding the update.');
  rmSync(stage, { recursive: true, force: true });
  console.log('Discarded staged update. Local generator is unchanged.');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const supported = new Set(['--ref', '--source', '--apply', '--discard', '--help']);
    let ref, source, action;
    for (let i = 0; i < args.length; i++) {
      const flag = args[i];
      if (!supported.has(flag)) {
        if (!flag.startsWith('-') && !ref) {
          ref = flag;
          continue;
        }
        throw new Error(`Unknown option: ${flag}`);
      }
      if (flag === '--ref' || flag === '--source') {
        const value = args[++i];
        if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
        if (flag === '--ref') ref = value;
        else source = value;
      } else {
        if (action) throw new Error('Choose one action');
        action = flag;
      }
    }
    if (action && (ref || source))
      throw new Error('--ref/--source are only used when staging an update.');
    if (action === '--help')
      console.log(
        'Stage: npm run ez-tree:update (or npm run ez-tree:update -- TAG_OR_COMMIT)\nReview .ez-tree-update/candidate/, then: npm run ez-tree:apply\nCancel: npm run ez-tree:discard\nOffline: node scripts/ez-tree-update.mjs --source /local/upstream --ref main',
      );
    else if (action === '--apply') applyUpdate();
    else if (action === '--discard') discardUpdate();
    else prepareUpdate({ ref, source });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
