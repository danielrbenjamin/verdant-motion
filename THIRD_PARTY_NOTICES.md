# Third-party notices

## EZ Tree

Generator and presets: Daniel Greenheck, MIT. Source: https://github.com/dgreenheck/ez-tree, base commit `dcf309bd86bd521083d9c70f01f2de45fdc7c457`. The original license is retained at [packages/ez-tree/LICENSE](packages/ez-tree/LICENSE). Local modifications are described in [packages/ez-tree/UPSTREAM.md](packages/ez-tree/UPSTREAM.md).

## Demo assets

- `public/textures/bark`: ambientCG textures, CC0 according to the upstream attribution file. Individual source links are preserved in [public/textures/LICENSE.md](public/textures/LICENSE.md).
- `public/textures/leaves`: bundled EZ Tree leaf textures, covered by the upstream license according to that attribution file.
- `public/models`: `grass.glb` and `flower_{white,yellow,blue}.glb`, copied from the same upstream demo checkout. No separate per-model attribution was present in that checkout; these assets are retained with the upstream MIT notice. This records the available provenance, not a separate ownership verification.

Ground textures and additional bark textures are retained for future use; the demo does not render a ground mesh. Upstream demo code, audio, fonts, and the full upstream checkout are excluded.

## Dependencies

Three.js is MIT licensed. Build and development tools retain their license notices in their installed npm packages. `package-lock.json` records exact dependency versions. These dependencies are installed through npm rather than committed as `node_modules`.
