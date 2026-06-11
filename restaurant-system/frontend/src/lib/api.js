const API_BASE = '/api';

function authHeaders(extra = {}) {
  const headers = { 'Content-Type': 'application/json', ...extra };
  const token = localStorage.getItem('rms_token');
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
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
