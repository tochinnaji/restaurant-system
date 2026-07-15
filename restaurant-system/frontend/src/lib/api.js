const API_BASE = (() => {
  const raw = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');
  if (raw === '/api') return '/api';
  if (raw.endsWith('/api')) return raw;
  return `${raw}/api`;
})();

function joinApiPath(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalizedPath}`;
}

function authHeaders(extra = {}) {
  const headers = { 'Content-Type': 'application/json', ...extra };
  const token = localStorage.getItem('rms_token');
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function requestJson(path, options = {}) {
  const response = await fetch(joinApiPath(path), {
    ...options,
    headers: authHeaders(options.headers || {})
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
