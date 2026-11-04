# Upstream provenance

- Source: https://github.com/dgreenheck/ez-tree
- Base commit: `dcf309bd86bd521083d9c70f01f2de45fdc7c457`
- Original author: Daniel Greenheck
- License: MIT, preserved in [LICENSE](LICENSE)

Only the generator, presets, and license are retained. The original app, tooling, Git metadata, exports, and duplicate assets are excluded.

Local modifications include branch `parentIndex`/`parentT` and leaf `branchIndex`/`branchT` metadata, plus texture option annotations for TypeScript. The fork also retains the source checkout's skeleton/meshing split, LOD support, external texture options, growth-force handling, and shader-reference serialization behavior on which Verdant Motion depends. The metadata additions preserve RNG sampling order and mature mesh layout.

This workspace is committed with the repository. Builds do not fetch or overwrite upstream files. The pinned merge base is also recorded in `upstream.json`. Use the three-way update workflow in [UPDATING.md](UPDATING.md) to preserve local changes, review conflicts, and run validation with rollback. In particular, preserve parent/leaf ownership and the ring layout consumed by `BranchGrowth`.
