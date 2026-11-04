let assetBase = '/';
/** Set before constructing plants; point to a directory containing textures/ and models/. */
export function setAssetBasePath(base: string) {
  assetBase = `${base.replace(/\/+$/, '')}/`;
}
export function assetUrl(path: string) {
  return `${assetBase}${path.replace(/^\/+/, '')}`;
}
