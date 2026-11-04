# Updating EZ Tree without losing local changes

The generator is a private npm workspace, not a nested clone. Edit `packages/ez-tree/src` normally; your committed source is the local side of each update. `upstream.json` records the exact upstream commit used as the merge base. No separate patch file needs to be maintained.

Install Node.js 24, npm dependencies, and Git. From the repository root:

```sh
# Stage an update from upstream main (or use a tag / full commit SHA).
npm run ez-tree:update

# Or pin the requested update to a tag / full commit SHA.
npm run ez-tree:update -- TAG_OR_COMMIT

# After reviewing the staged candidate, apply and validate it.
npm run ez-tree:apply
```

The first command fetches the base and target commits into a temporary Git object store, then removes that store. It merges **your current source + old upstream + new upstream** with Git's three-way merge tool. It does not overwrite the installed generator or touch the demo, public assets, root lockfile, or dependencies.

Review `.ez-tree-update/report.json` and `.ez-tree-update/candidate/`. `base/`, `local/`, and `upstream/` contain the three versions for comparison. New/deleted upstream files and local-only files participate in the merge. Text line endings are normalized to LF. The staging directory is ignored by Git and the formatter.

`--apply` refuses a candidate if the working generator has changed since staging. It backs up the original source, updates the pinned revision and provenance, then runs type checks, all tests, and both builds. A failed check restores the original source and revision and retains the candidate for inspection. Successful validation removes the staging directory. Review your normal Git diff and commit the generator, `upstream.json`, and `UPSTREAM.md` together.

## Conflicts

Unresolved merges never replace the working generator.

1. Inspect `report.json` and edit the corresponding files in `candidate/`. Text conflicts include `local`, `base`, and `upstream` markers. For add/add or delete/modify conflicts, compare the three directories; delete the candidate file if deletion is the correct resolution.
2. Create `.ez-tree-update/resolved.json` as an array of the conflict paths you resolved, for example:

   ```json
   ["src/tree.js", "src/options.js"]
   ```

3. Run `npm run ez-tree:apply`. The updater checks acknowledgements, rejects remaining markers, and runs validation.

If you edit the working generator while an update is staged, discard and stage again so those edits enter the merge:

```sh
npm run ez-tree:discard
npm run ez-tree:update
```

If the process is interrupted during apply, `.ez-tree-update/backup/` retains the original source and metadata. Do not delete it: preserve any newer edits, restore its `src/`, `LICENSE`, `upstream.json`, and `UPSTREAM.md` to `packages/ez-tree/`, then restage. `--discard` refuses to remove an outstanding backup.

## Offline or fork updates

Use an existing upstream Git checkout with both the pinned base and target commits available:

```sh
node scripts/ez-tree-update.mjs --source /path/to/ez-tree --ref main
```

The source checkout is read-only; it is not copied into this repository. To follow a different upstream repository by default, edit `repository` in `packages/ez-tree/upstream.json` and ensure the recorded base commit exists in that repository.

## Scope

The updater handles only the generator under the recorded `sourcePath` and the original MIT license. Texture/model refreshes and npm dependency upgrades are separate, deliberate changes. A new upstream dependency or incompatible Three.js requirement can cause validation to fail; resolve that explicitly rather than bypassing the checks.

Compatibility tests cover every shipped preset, parent/leaf ownership metadata, mesh layout, mature geometry, and seek behavior. Successful checks do not replace a browser review of growth, seasonal fading, wind, and leaf physics.
