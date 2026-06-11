// Shared utilities for the Restaurant Management System

const API_BASE = '/api';

async function apiGet(endpoint, auth = false) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = localStorage.getItem('rms_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${endpoint}`, { headers });
  return res.json();
}

async function apiPost(endpoint, data, auth = false) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = localStorage.getItem('rms_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data)
  });
  return res.json();
}

async function apiPut(endpoint, data, auth = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = localStorage.getItem('rms_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data)
  });
  return res.json();
}

function showToast(message, type = 'default', duration = 3000) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); }, duration);
}

function formatNaira(amount) {
  return 'NGN ' + Number(amount).toLocaleString('en-NG', { minimumFractionDigits: 2 });
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function requireAuth(allowedRoles = []) {
  const token = localStorage.getItem('rms_token');
  const user = JSON.parse(localStorage.getItem('rms_user') || 'null');
  if (!token || !user) {
    window.location.href = '/frontend/shared/login';
    return false;
  }
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    window.location.href = '/frontend/shared/login';
    return false;
  }
  return user;
}

function statusBadge(status) {
  const map = {
    pending: 'badge-pending',
    preparing: 'badge-preparing',
    ready: 'badge-ready',
    delivered: 'badge-delivered',
    paid: 'badge-paid',
    unpaid: 'badge-unpaid',
    failed: 'badge-unpaid'
  };
  return `<span class="badge ${map[status] || ''}">${status}</span>`;
}

function logout() {
  localStorage.removeItem('rms_token');
  localStorage.removeItem('rms_user');
  window.location.href = '/frontend/shared/login';
}
