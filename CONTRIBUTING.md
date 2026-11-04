# Contributing

Use Node.js 24 and run `npm ci` in the repository root. The local EZ Tree workspace is linked automatically; no clone or vendoring command is needed.

Before a pull request:

```sh
npm run format
npm test
npm run build
```

Keep library code in `src/lib`, demo code in `src/demo`, and generator changes in `packages/ez-tree`. Add behavioral tests for changes to growth, release timing, physics, or the canopy-to-flight handoff. Preserve the generator's RNG order and mature geometry unless the change explicitly requires a new shape.

Describe observable changes and relevant validation in the pull request. For visible demo changes, check playback, reverse, scrubbing, season wrap, preset changes, and mobile layout in a WebGL-capable browser. Automated geometry tests do not replace visual inspection.

Keep upstream license notices and document generator modifications in `packages/ez-tree/UPSTREAM.md`.

For generator upgrades, use the [EZ Tree update workflow](packages/ez-tree/UPDATING.md). It preserves local source changes through a three-way merge; do not replace the workspace by copying an upstream checkout over it.
