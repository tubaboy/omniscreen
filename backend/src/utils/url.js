/**
 * Dynamically fix asset URLs that were stored with localhost.
 * Replaces localhost:3001 with the actual host from the incoming request.
 */
function fixAssetUrl(url, request) {
  if (!url) return url;
  // Skip external URLs that don't serve internal assets
  if (!url.includes('/assets/file/')) return url;

  // Derive the correct origin from the request's Host header
  const host = request.headers.host || request.headers[':authority'] || '';
  const protocol = request.headers['x-forwarded-proto'] || 'http';
  const currentOrigin = `${protocol}://${host}`;

  // Replace any absolute URL pointing to internal asset files with the current request origin.
  // This supports both normal URLs and complex JSON configurations (e.g. bgImageUrl inside widget JSON).
  return url.replace(/(https?:\/\/[^\/]+?)(?:\/api)?\/assets\/file\//g, (match) => {
    const hasApi = match.includes('/api');
    return `${currentOrigin}${hasApi ? '/api' : ''}/assets/file/`;
  });
}

/**
 * Fix all URL fields on an asset object (url + thumbnailUrl).
 */
function fixAssetUrls(asset, request) {
  if (!asset) return asset;
  return {
    ...asset,
    url: fixAssetUrl(asset.url, request),
    thumbnailUrl: fixAssetUrl(asset.thumbnailUrl, request),
  };
}

module.exports = { fixAssetUrl, fixAssetUrls };
