# EZ Tree generator workspace

This is the minimal modified generator used by Verdant Motion, not the upstream demo or a nested Git checkout. `npm ci` at the repository root links it as `@verdant-motion/ez-tree-generator`.

The public upstream package is `@dgreenheck/ez-tree`. This private workspace has a separate name because Verdant Motion needs its modified skeleton and mesh contract. Do not replace it with the upstream package without migrating and testing that contract.

See [UPSTREAM.md](UPSTREAM.md) for provenance and modifications and [LICENSE](LICENSE) for Daniel Greenheck's MIT license.

To bring in upstream changes while preserving local edits, use `npm run ez-tree:update`, review the staged merge, then `npm run ez-tree:apply`. See [UPDATING.md](UPDATING.md).
