export function getSessionUser() {
  try {
    return JSON.parse(localStorage.getItem('rms_user') || 'null');
  } catch (err) {
    return null;
  }
}

export function setSession(token, user) {
  localStorage.setItem('rms_token', token);
  localStorage.setItem('rms_user', JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem('rms_token');
  localStorage.removeItem('rms_user');
}

export function requiresRole(user, allowedRoles = []) {
  if (!user) return false;
  if (allowedRoles.length === 0) return true;
  return allowedRoles.includes(user.role);
}
