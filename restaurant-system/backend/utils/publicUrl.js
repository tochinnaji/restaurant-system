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

const getBackendPublicUrl = (req) => {
  const requestBaseUrl = getRequestBaseUrl(req);
  const configured = normalizeBaseUrl(
    process.env.BACKEND_PUBLIC_URL ||
    process.env.PUBLIC_BACKEND_URL ||
    process.env.RAILWAY_PUBLIC_URL ||
    process.env.PUBLIC_BASE_URL ||
    process.env.BASE_URL
  );

  if (configured) {
    const configuredLooksFrontend = /vercel\.app|localhost:5173/i.test(configured);
    const requestLooksBackend = requestBaseUrl && !/vercel\.app|localhost:5173/i.test(requestBaseUrl);
    if (configuredLooksFrontend && requestLooksBackend) {
      return requestBaseUrl;
    }
    return configured;
  }

  if (requestBaseUrl) {
    return requestBaseUrl;
  }

  return `http://localhost:${process.env.PORT || 3000}`;
};


const getFrontendPublicUrl = (req) => {
  const configured = normalizeBaseUrl(
    process.env.FRONTEND_PUBLIC_URL ||
    process.env.PUBLIC_FRONTEND_URL
  );
  if (configured) {
    return configured;
  }

  const vercelUrl = normalizeBaseUrl(process.env.VERCEL_URL);
  if (vercelUrl) {
    return vercelUrl.startsWith('http') ? vercelUrl : `https://${vercelUrl}`;
  }

  const requestBaseUrl = getRequestBaseUrl(req);
  if (requestBaseUrl) {
    return requestBaseUrl;
  }

  return `http://localhost:${process.env.PORT || 3000}`;
};

module.exports = { getBackendPublicUrl, getFrontendPublicUrl };
