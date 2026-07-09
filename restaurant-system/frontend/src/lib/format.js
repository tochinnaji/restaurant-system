export function formatNaira(amount) {
  const value = Number(amount || 0);
  return `NGN ${value.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export function formatDate(dateString) {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function classNames(...values) {
  return values.filter(Boolean).join(' ');
}

export function badgeClass(status) {
  const map = {
    pending: 'badge badge-warning',
    preparing: 'badge badge-info',
    available: 'badge badge-success',
    ready: 'badge badge-success',
    delivered: 'badge badge-muted',
    cancelled: 'badge badge-danger',
    paid: 'badge badge-success',
    unpaid: 'badge badge-warning',
    failed: 'badge badge-danger',
    successful: 'badge badge-success',
    low: 'badge badge-warning',
    out_of_stock: 'badge badge-danger',
    unread: 'badge badge-warning',
    read: 'badge badge-info',
    responded: 'badge badge-success'
  };
  return map[status] || 'badge badge-muted';
}
