const normalizeBaseUrl = (value) => {
  if (!value) return '';
  return String(value).trim().replace(/\/$/, '');
};

const getRequestBaseUrl = (req) => {
  if (!req) return '';

  const forwardedHost = normalizeBaseUrl(req.headers?.['x-forwarded-host'] || req.headers?.host);
  if (!forwardedHost) return '';

  if (forwardedHost.startsWith('http://') || forwardedHost.startsWith('https://')) {
    return forwardedHost;
  }

  const proto = normalizeBaseUrl(req.headers?.['x-forwarded-proto']) || 'http';
  return `${proto}://${forwardedHost}`;
};

const getPublicBaseUrl = (req) => {
  const configured = normalizeBaseUrl(
    process.env.FRONTEND_PUBLIC_URL ||
    process.env.PUBLIC_BASE_URL ||
    process.env.BASE_URL
  );
  if (configured) {
    return configured;
  }

  const requestBaseUrl = getRequestBaseUrl(req);
  if (requestBaseUrl) {
    return requestBaseUrl;
  }

  const vercelUrl = normalizeBaseUrl(process.env.VERCEL_URL);
  if (vercelUrl) {
    return vercelUrl.startsWith('http') ? vercelUrl : `https://${vercelUrl}`;
  }

  return `http://localhost:${process.env.PORT || 3000}`;
};

module.exports = { getPublicBaseUrl };