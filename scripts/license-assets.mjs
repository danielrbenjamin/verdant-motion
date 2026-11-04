import { readFileSync } from 'node:fs';

/** Include original license texts in both distributable builds. */
export function licenseAssets() {
  return {
    name: 'verdant-license-assets',
    generateBundle() {
      for (const [source, fileName] of [
        ['LICENSE', 'licenses/Verdant-Motion.txt'],
        ['packages/ez-tree/LICENSE', 'licenses/EZ-Tree.txt'],
        ['THIRD_PARTY_NOTICES.md', 'licenses/THIRD_PARTY_NOTICES.md'],
      ]) {
        this.emitFile({
          type: 'asset',
          fileName,
          source: readFileSync(new URL(`../${source}`, import.meta.url), 'utf8'),
        });
      }
    },
  };
}
