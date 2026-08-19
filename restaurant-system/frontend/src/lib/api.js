function normalizeApiBase(value) {
  const base = (value || '/api').replace(/\/+$/, '');
  if (base === '') return '/api';
  if (base === '/api' || base.endsWith('/api')) return base;
  if (/^https?:\/\//i.test(base)) return `${base}/api`;
  return base;
}

const API_BASE = normalizeApiBase(import.meta.env.VITE_API_BASE_URL);

function joinApiPath(path) {
  const cleanedPath = path.startsWith('/api/') ? path.slice(4) : path;
  const normalizedPath = cleanedPath.startsWith('/') ? cleanedPath : `/${cleanedPath}`;
  return `${API_BASE}${normalizedPath}`;
}

function authHeaders(extra = {}, hasBody = false) {
  const headers = { ...extra };
  if (hasBody && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  const token = localStorage.getItem('rms_token');
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function requestJson(path, options = {}) {
  const hasBody = Object.prototype.hasOwnProperty.call(options, 'body');
  const response = await fetch(joinApiPath(path), {
    ...options,
    headers: authHeaders(options.headers || {}, hasBody)
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch (err) {
    payload = { success: false, message: 'Invalid server response.' };
  }
  if (!response.ok && payload?.success !== false) {
    return { success: false, message: payload?.message || 'Request failed.' };
  }
  return payload;
}

export const api = {
  get: (path) => requestJson(path),
  post: (path, body) => requestJson(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => requestJson(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: (path) => requestJson(path, { method: 'DELETE' })
};
