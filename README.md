# Verdant Motion

Seasonal animation and procedural growth for [EZ Tree](https://github.com/dgreenheck/ez-tree) and Three.js, with an interactive browser demo.

Grow a tree from young shoots to its preset shape, scrub through seasons, adjust wind and health, and watch detached leaves drift and settle. Optional grass and flower fields share the scene's lifecycle controls.

This is a visual animation library in development. Growth follows a generated skeleton; it is not a species-calibrated botanical simulation.

## Run locally

Use **Node.js 24** and npm. From the repository root:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. In VS Code, **Run and Debug → Demo Verdant Motion → F5** starts the same demo.

The repository includes the generator and required assets, plus the original extra bark and ground textures for future use. No upstream clone, Git submodule, or vendoring/download step is needed. npm automatically links the local generator workspace.

## Demo controls

- Choose a preset and seed; regenerate with the randomize button.
- Play, reverse, or scrub the seasonal cycle.
- Enable procedural growth and select **Grow from seedling**; growth can pause or resume independently of seasons.
- Adjust wind and health under **Wind & health**.
- Enable optional grass or wildflowers under **Grass & flowers**.

The demo has a neutral studio background, with no sky or ground mesh. It simulates up to 160 falling leaves; the remaining canopy cards fade in place. Forward playback holds at winter until all airborne leaves have landed before starting another year. An invisible plane at `y=0` catches fallen leaves.

## Library usage

Import the TypeScript entry when working within this checkout:

```ts
import * as THREE from 'three';
import { Nature, setAssetBasePath } from './src/lib';

// Directory containing textures/ and models/. Configure before creating plants.
setAssetBasePath('/');

const scene = new THREE.Scene();
const nature = new Nature();
scene.add(nature);

const tree = nature.addTree({
  preset: 'Oak Large',
  seed: 42,
  proceduralGrowth: true,
  fallingLeaves: 160,
});

nature.addGrass({ count: 3000, area: [1000, 1000], seed: 7 });
nature.addFlower({ preset: 'daisy', count: 120, area: [1000, 1000], seed: 44 });
nature.setState({ season: 0.5, growth: 1, health: 1, wind: 0.25 });

tree.growth = 0;
tree.animate({ growth: 1 }, { duration: 12000 });

const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  nature.update(clock.getDelta(), clock.elapsedTime);
  // renderer.render(scene, camera);
}
frame();

// When removing the scene's vegetation:
// scene.remove(nature);
// nature.dispose();
```

`Tree`, `Grass`, `Flower`, `Nature`, `Plant`, and `Timeline` are exported from `src/lib/index.ts`. Standalone plants support the same `setState`, `animate`, `timeline`, `update`, and `dispose` interface.

| State    | Meaning                                                               |
| -------- | --------------------------------------------------------------------- |
| `season` | Normalized year: 0/1 winter, 0.25 spring, 0.5 summer, 0.75 autumn     |
| `growth` | 0–1 development; `proceduralGrowth: false` keeps tree geometry mature |
| `health` | 0–1 vitality                                                          |
| `wind`   | 0–1 wind strength                                                     |
| `bloom`  | 0–1 flower scale multiplier                                           |

`animate()` durations are milliseconds; timeline segment durations and `update()` times are seconds:

```ts
const cycle = tree.timeline({ loop: true });
cycle.to({ season: 0.5 }, 4).to({ season: 0.94 }, 6).play();
cycle.pause().seekProgress(0.5);
cycle.reverse();
```

The demo's winter hold is separate from generic timelines. Custom players can check `tree.hasFallingLeaves` before wrapping their seasonal clock.

## Builds and checks

```sh
npm run check
npm test
npm run build
npm run format:check
```

| Command              | Output                                                                |
| -------------------- | --------------------------------------------------------------------- |
| `npm run build:lib`  | `dist/lib/verdant-motion.js`, an ES module with Three.js externalized |
| `npm run build:demo` | `dist/demo/`, a deployable static website including models/textures   |
| `npm run build`      | Type check, library build, and demo build                             |
| `npm run preview`    | Preview the production demo                                           |
| `npm run format`     | Format project-owned source and documentation                         |

To consume the built ES module in another bundler, import `dist/lib/verdant-motion.js` and install the compatible Three.js version (`0.169.x`). Copy `public/models` and `public/textures` to your application's static directory and call `setAssetBasePath` with their parent URL. Both builds include original license texts under `licenses/`. The JS build does not ship generated type declarations; use the source entry in this workspace for TypeScript development. This repository is private to npm (`private: true`); it is prepared for GitHub source publication, not an npm registry release.

## Publish the demo on GitHub Pages

1. Push this repository to GitHub.
2. In **Settings → Pages**, select **GitHub Actions** as the build source.
3. Run **Deploy demo to GitHub Pages** from the Actions tab.

The workflow sets the correct repository subpath automatically. For a manual build, set `BASE_PATH` to `/repository-name/` before `npm run build:demo`; use `/` for a root-domain site. The demo uses that base for scripts, models, and textures. Custom domains require a root-path build.

CI checks formatting, tests, and both builds on pushes and pull requests. Build output, dependencies, caches, and local environment files are ignored. No generated files or nested upstream Git repository need to be committed.

## Repository layout

```text
src/lib/              Public animation API and implementation
src/demo/             Browser demo, layout, styling, and season playback
packages/ez-tree/     Minimal modified EZ Tree generator workspace
public/               Bark/leaf/ground textures and vegetation models
tests/                Growth, physics, lifecycle, fading, and playback tests
.github/workflows/    CI and manually triggered GitHub Pages deployment
```

EZ Tree is already available as `@dgreenheck/ez-tree`. This project uses a separately named local package, `@verdant-motion/ez-tree-generator`, because growth relies on its modified skeleton ownership metadata and mesh layout. Keeping the small fork avoids patching dependencies during installation or replacing animation behavior with an incompatible upstream release. Provenance and update instructions are in [packages/ez-tree/UPSTREAM.md](packages/ez-tree/UPSTREAM.md).

## Update EZ Tree

Your changes stay in `packages/ez-tree/src`. Stage a three-way merge from upstream, review the candidate, then apply it with automatic compatibility checks and rollback:

```sh
npm run ez-tree:update
npm run ez-tree:apply
```

Use `npm run ez-tree:discard` to cancel a staged update. See [the update guide](packages/ez-tree/UPDATING.md) for conflicts, pinned versions, and offline/fork updates. Normal installs and builds never fetch or overwrite upstream source.

## Modeling and limitations

- Growth separates tip extension from later thickening; child shoots emerge after supporting internodes develop. Temporary tip foliage forms a juvenile canopy before the adult preset crown appears. Geometry still follows a predetermined skeleton, without competition, phototropism, or environmental branching decisions.
- Leaves use gravity, orientation-dependent drag, wind, aerodynamic torque, damping, and contact/friction against a flat plane. There are no branch or leaf-to-leaf collisions. Physics integrates at 120 Hz and stores compact 30 Hz snapshots for interpolated playback.
- Live release uses real seconds and continues while season playback is paused. Reverse or large seasonal seeks reconstruct flight age using an 18-second year. Wind is captured at release; growth changes rebuild trajectories. This is a visual approximation, not an exact replay of arbitrary interactive wind histories.
- Omitting `fallingLeaves` gives every leaf a physical replacement. A smaller budget fades unrepresented leaves with alpha-hashed coverage. Full physical shedding costs more CPU and memory; the demo uses 160.
- Native EZ Tree LOD is available for mature/static trees; it does not share animated mesh mappings. Use `lod: true, proceduralGrowth: false` for static LOD. Animated seasonal foliage uses the full-resolution path.
- Grass uses instanced GLTF geometry. Flowers clone the upstream models; preset names select white/yellow/blue assets rather than botanical species models. Both fields use seeded placement within a circular area fitted to the supplied dimensions.
- Automated checks verify geometry and behavior. Visual rendering and performance still need inspection on target WebGL devices.

## License and credits

Verdant Motion is [MIT licensed](LICENSE). EZ Tree is by **Daniel Greenheck**, also MIT; its original notice is preserved in [packages/ez-tree/LICENSE](packages/ez-tree/LICENSE).

Asset provenance and third-party notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and [public/textures/LICENSE.md](public/textures/LICENSE.md). See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidance.
