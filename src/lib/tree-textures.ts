/**
 * Texture integration for the local EZ Tree generator workspace.
 * Mirrors upstream src/app/textures.js paths without importing its demo app.
 * Assets ship in public/textures; setAssetBasePath configures their deployment URL.
 */
import { assetUrl } from './assets';
import type { Tree as EZTree } from '@verdant-motion/ez-tree-generator';
import { SRGBColorSpace, Texture, TextureLoader } from 'three';
const loader = new TextureLoader();
const leafCache = new Map<string, Texture>();
const barkCache = new Map<string, { color: Texture; normal: Texture; roughness: Texture }>();

const BARK_TYPES = new Set([
  'Bark001',
  'Bark002',
  'Bark003',
  'Bark004',
  'Bark006',
  'Bark007',
  'Bark008',
  'Bark012',
  'Bark013',
  'Bark014',
  'Bark015',
]);
const LEAF_TYPES = new Set(['ash', 'aspen', 'oak', 'pine']);

function loadTexture(path: string, isColor = false) {
  const texture = loader.load(assetUrl(path), undefined, undefined, (error) => {
    console.error(
      `[Verdant Motion] Texture failed: ${path}. Check setAssetBasePath and the deployed texture assets.`,
      error,
    );
  });
  if (isColor) texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Apply the original EZ-Tree's bark/leaf maps BEFORE generating its geometry. */
export function applyTreeTextures(tree: EZTree) {
  const type = tree.options.bark.type as string;
  if (BARK_TYPES.has(type)) {
    let maps = barkCache.get(type);
    if (!maps) {
      const base = `/textures/bark/${type}_1K-JPG/${type}_1K-JPG`;
      maps = {
        color: loadTexture(`${base}_Color.jpg`, true),
        normal: loadTexture(`${base}_NormalGL.jpg`),
        roughness: loadTexture(`${base}_Roughness.jpg`),
      };
      barkCache.set(type, maps);
    }
    tree.options.bark.maps.color = maps.color;
    tree.options.bark.maps.normal = maps.normal;
    tree.options.bark.maps.roughness = maps.roughness;
  }
  const leafType = tree.options.leaves.type as string;
  if (LEAF_TYPES.has(leafType)) {
    let texture = leafCache.get(leafType);
    if (!texture) {
      texture = loadTexture(`/textures/leaves/${leafType}.png`, true);
      texture.premultiplyAlpha = true;
      leafCache.set(leafType, texture);
    }
    tree.options.leaves.map = texture;
  }
}
