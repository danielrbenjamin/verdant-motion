import { afterEach, expect, it, vi } from 'vitest';
import { assetUrl, setAssetBasePath } from '../src/lib/assets';

afterEach(() => {
  setAssetBasePath('/');
  vi.unstubAllGlobals();
});
it('resolves assets under a GitHub Pages repository path', () => {
  setAssetBasePath('/verdant-motion/');
  expect(assetUrl('/textures/leaves/oak.png')).toBe('/verdant-motion/textures/leaves/oak.png');
  expect(assetUrl('models/grass.glb')).toBe('/verdant-motion/models/grass.glb');
});
it('supports root and external static asset directories', () => {
  setAssetBasePath('/');
  expect(assetUrl('models/grass.glb')).toBe('/models/grass.glb');
  setAssetBasePath('https://example.com/nature');
  expect(assetUrl('/models/grass.glb')).toBe('https://example.com/nature/models/grass.glb');
});
it('does not fetch demo assets when importing the public library', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  const library = await import('../src/lib/index');
  expect(library.Tree).toBeTypeOf('function');
  expect(library.Grass).toBeTypeOf('function');
  expect(fetch).not.toHaveBeenCalled();
});
