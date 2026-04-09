/**
 * Dynamically fix asset URLs that were stored with localhost.
 * Replaces localhost:3001 with the actual host from the incoming request.
 */
function fixAssetUrl(url, request) {
  if (!url) return url;
  // Skip external URLs (YouTube thumbnails, favicons, etc.)
  if (!url.includes('localhost:3001')) return url;

  // Derive the correct origin from the request's Host header
  const host = request.headers.host || request.headers[':authority'] || '';
  // The backend port is embedded in the stored URL as :3001
  // The request host already includes the correct port (e.g. linux-mint.local:3001)
  const protocol = request.headers['x-forwarded-proto'] || 'http';

  return url.replace(/http:\/\/localhost:3001/g, `${protocol}://${host}`);
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
