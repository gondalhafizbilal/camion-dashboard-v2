const DEFAULT_OLD_ASSETS_HOST = 'https://dev-assets-167781471441-eu-north-1.s3.eu-north-1.amazonaws.com';
const DEFAULT_DEV_ASSETS_HOST = 'https://assets.dev.camiontrading.com';
const DEFAULT_PROD_ASSETS_HOST = 'https://assets.camiontrading.com';

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function getDefaultAssetsHost() {
  const apiUrl = String(process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '').trim().toLowerCase();
  if (apiUrl.includes('api.dev.camiontrading.com')) {
    return DEFAULT_DEV_ASSETS_HOST;
  }
  return DEFAULT_PROD_ASSETS_HOST;
}

export function getAssetsHost() {
  const configured =
    process.env.NEXT_PUBLIC_ASSETS_HOST ||
    process.env.ASSETS_HOST ||
    process.env.NEXT_PUBLIC_API_ASSETS_HOST ||
    '';
  const host = trimTrailingSlash(configured || getDefaultAssetsHost());
  return host;
}

export function getTransformedImageUrl(imageUrl, assetsHost = getAssetsHost()) {
  if (!imageUrl || !assetsHost) {
    return '';
  }

  const source = String(imageUrl).trim();
  const host = trimTrailingSlash(assetsHost);

  if (source.startsWith('https://')) {
    if (source.startsWith(DEFAULT_OLD_ASSETS_HOST)) {
      return source.replace(DEFAULT_OLD_ASSETS_HOST, host);
    }
    return source;
  }

  if (source.startsWith('s3://')) {
    const normalizedPath = source.replace(/^s3:\/\//, '');
    return `${host}/${normalizedPath}`;
  }

  if (source.startsWith('s3:/')) {
    const normalizedPath = source.replace(/^s3:\//, '');
    return `${host}/${normalizedPath}`;
  }

  return source;
}

export function getProxyImageUrl(imageUrl) {
  const url = String(imageUrl || '').trim();
  if (!url) return '';
  return `/api/image-proxy?url=${encodeURIComponent(url)}`;
}

export function proxyHtmlImageSources(html) {
  const source = String(html || '');
  if (!source) return '';

  return source.replace(/(<img[^>]*\ssrc=["'])([^"']+)(["'][^>]*>)/gi, (_, prefix, src, suffix) => {
    const transformed = getTransformedImageUrl(src);
    const proxied = getProxyImageUrl(transformed || src);
    return `${prefix}${proxied}${suffix}`;
  });
}
