function appendQueryParams(url, query) {
  Object.entries(query || {}).forEach(([key, value]) => {
    if (key === 'path') return;
    if (Array.isArray(value)) {
      value.forEach((item) => url.searchParams.append(key, item));
      return;
    }
    if (value !== undefined) url.searchParams.set(key, value);
  });
}

function getBackendUrl(req) {
  const configuredBase = process.env.BACKEND_API_BASE_URL || process.env.VITE_API_BACKEND_URL;
  if (!configuredBase) {
    throw new Error('Missing BACKEND_API_BASE_URL');
  }

  const withProtocol = /^https?:\/\//i.test(configuredBase)
    ? configuredBase
    : `https://${configuredBase}`;
  const cleanedBase = withProtocol.replace(/\/+$/, '');
  const base = cleanedBase.endsWith('/api') ? cleanedBase : `${cleanedBase}/api`;
  const pathValue = req.query.path || '';
  const path = Array.isArray(pathValue) ? pathValue.join('/') : pathValue;
  const url = new URL(`${base}/${String(path).replace(/^\/+/, '')}`);
  appendQueryParams(url, req.query);
  return url;
}

function getForwardHeaders(req) {
  const headers = {};
  ['content-type', 'authorization'].forEach((key) => {
    if (req.headers[key]) headers[key] = req.headers[key];
  });
  const frontendOrigin = req.headers.origin || getOriginFromReferer(req.headers.referer) || getOriginFromHost(req);
  if (frontendOrigin) headers['x-irms-frontend-origin'] = frontendOrigin;
  return headers;
}

function getOriginFromReferer(referer) {
  if (!referer) return '';
  try {
    return new URL(referer).origin;
  } catch (err) {
    return '';
  }
}

function getOriginFromHost(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (!host) return '';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}`;
}

function getForwardBody(req) {
  if (['GET', 'HEAD'].includes(req.method)) return undefined;
  if (req.body === undefined || req.body === null) return undefined;
  return typeof req.body === 'string' || Buffer.isBuffer(req.body) ? req.body : JSON.stringify(req.body);
}

export default async function handler(req, res) {
  let targetUrl;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    targetUrl = getBackendUrl(req);
    const backendResponse = await fetch(targetUrl, {
      method: req.method,
      headers: getForwardHeaders(req),
      body: getForwardBody(req),
      signal: controller.signal
    });

    const contentType = backendResponse.headers.get('content-type');
    if (contentType) res.setHeader('content-type', contentType);

    const body = Buffer.from(await backendResponse.arrayBuffer());
    res.status(backendResponse.status).send(body);
  } catch (err) {
    res.status(502).json({
      success: false,
      message: err.message === 'Missing BACKEND_API_BASE_URL'
        ? 'Backend API URL is not configured.'
        : 'Backend proxy failed.',
      detail: err.message,
      target: targetUrl ? targetUrl.origin : null
    });
  } finally {
    clearTimeout(timeout);
  }
}
