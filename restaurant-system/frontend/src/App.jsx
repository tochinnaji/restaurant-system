import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, NavLink, Route, BrowserRouter, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  ClipboardList,
  Clock3,
  Download,
  Edit3,
  Grid2x2,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Ban,
  RotateCcw,
  QrCode,
  RefreshCw,
  Send,
  ShoppingCart,
  ShieldCheck,
  Star,
  Trash2,
  UserCircle2,
  Users,
  Wallet,
  ChefHat,
  MessageSquareText,
  ReceiptText,
  Sparkles,
  Plus,
  Search,
  Save,
  Eye,
  MoonStar,
  SunMedium,
  X
} from 'lucide-react';
import { api } from './lib/api';
import { badgeClass, classNames, formatDate, formatNaira } from './lib/format';
import { clearSession, getSessionUser, requiresRole, setSession } from './lib/session';

const APP_NAME = 'IRMS';
const BRAND_ICON = `${import.meta.env.BASE_URL}brand/irms-sidebar-icon.png`;
const BRAND_LOGO = `${import.meta.env.BASE_URL}brand/irms-selected-logo-source.png`;
const APP_BASE_PATH = (import.meta.env.VITE_APP_BASE_PATH || '/').replace(/\/+$/, '') || '/';
const QR_CONTEXT_KEY = 'irms_qr_context';
const ORDER_HISTORY_KEY = 'irms_order_history';
const HOME_SLIDES = [
  { main: 'menu-images/jollof-rice-chicken.png' },
  { main: 'menu-images/fried-rice-chicken.png' },
  { main: 'menu-images/egusi-soup-eba.png' },
  { main: 'menu-images/pounded-yam-oha.png' },
  { main: 'menu-images/chapman.png' },
  { main: 'menu-images/fresh-orange-juice.png' },
  { main: 'menu-images/soft-drinks.png' },
  { main: 'menu-images/chin-chin.png' },
  { main: 'menu-images/puff-puff.png' },
  { main: 'menu-images/samosa.png' }
];
const ORDER_HISTORY_TTL_MS = 24 * 60 * 60 * 1000;

function readStoredQrContext() {
  if (typeof window === 'undefined') return null;
  try {
    const stored = JSON.parse(window.localStorage.getItem(QR_CONTEXT_KEY) || 'null');
    if (stored?.orderId && stored?.orderSavedAt && Date.now() - Number(stored.orderSavedAt) >= ORDER_HISTORY_TTL_MS) {
      const next = { ...stored };
      delete next.orderId;
      delete next.orderSavedAt;
      window.localStorage.setItem(QR_CONTEXT_KEY, JSON.stringify(next));
      return next;
    }
    return stored;
  } catch (err) {
    return null;
  }
}

function saveQrContext(tableNumber, token) {
  if (typeof window === 'undefined' || !tableNumber || !token) return;
  const current = readStoredQrContext() || {};
  window.localStorage.setItem(QR_CONTEXT_KEY, JSON.stringify({ ...current, tableNumber, token }));
}

function saveOrderContext(orderId, tableNumber, token) {
  if (typeof window === 'undefined' || !orderId) return;
  const current = readStoredQrContext() || {};
  window.localStorage.setItem(QR_CONTEXT_KEY, JSON.stringify({
    ...current,
    orderId: String(orderId),
    orderSavedAt: Date.now(),
    tableNumber: tableNumber || current.tableNumber,
    token: token || current.token
  }));
}

function readOrderHistory() {
  if (typeof window === 'undefined') return {};
  try {
    const now = Date.now();
    const stored = JSON.parse(window.localStorage.getItem(ORDER_HISTORY_KEY) || '{}');
    return Object.fromEntries(Object.entries(stored).map(([table, orders]) => [
      table,
      (Array.isArray(orders) ? orders : []).filter((order) => now - Number(order.savedAt || 0) < ORDER_HISTORY_TTL_MS)
    ]));
  } catch (err) {
    return {};
  }
}

function writeTableOrderHistory(tableNumber, tableHistory) {
  if (typeof window === 'undefined' || !tableNumber) return [];
  const history = readOrderHistory();
  const nextTableHistory = (Array.isArray(tableHistory) ? tableHistory : []).slice(0, 8);
  window.localStorage.setItem(ORDER_HISTORY_KEY, JSON.stringify({ ...history, [tableNumber]: nextTableHistory }));
  return nextTableHistory;
}

function saveOrderHistoryEntry(tableNumber, order) {
  if (typeof window === 'undefined' || !tableNumber || !order?.order_id) return [];
  const history = readOrderHistory();
  const existing = (history[tableNumber] || []).find((item) => String(item.order_id) === String(order.order_id));
  const entry = {
    ...existing,
    order_id: String(order.order_id),
    total_amount: order.total_amount,
    order_status: order.order_status || existing?.order_status || 'pending',
    payment_status: order.payment_status || existing?.payment_status || 'unpaid',
    created_at: order.created_at || existing?.created_at || new Date().toISOString(),
    savedAt: existing?.savedAt || Date.now()
  };
  const tableHistory = [entry, ...(history[tableNumber] || []).filter((item) => String(item.order_id) !== String(order.order_id))];
  return writeTableOrderHistory(tableNumber, tableHistory);
}

function appPath(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return APP_BASE_PATH === '/' ? normalizedPath : `${APP_BASE_PATH}${normalizedPath}`;
}

function menuImageSrc(imageUrl) {
  const trimmed = String(imageUrl || '').trim();
  if (!trimmed) return '';
  if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/')) return appPath(trimmed);
  return `${import.meta.env.BASE_URL}${trimmed.replace(/^\/+/, '')}`;
}
const MENU_IMAGE_ALIASES = {
  'menu-images/fried-rice-fish.png': 'menu-images/fried-rice-chicken.png',
  'menu-images/soft-drink-can.png': 'menu-images/soft-drinks.png',
  'menu-images/soft-drinks-can.png': 'menu-images/soft-drinks.png'
};

const MENU_IMAGE_BY_NAME = {
  'Jollof Rice & Chicken': 'menu-images/jollof-rice-chicken.png',
  'Fried Rice & Fish': 'menu-images/fried-rice-chicken.png',
  'Fried Rice & Chicken': 'menu-images/fried-rice-chicken.png',
  'Egusi Soup & Eba': 'menu-images/egusi-soup-eba.png',
  'Pounded Yam & Oha Soup': 'menu-images/pounded-yam-oha.png',
  Chapman: 'menu-images/chapman.png',
  'Fresh Juice (Orange)': 'menu-images/fresh-orange-juice.png',
  'Soft Drink (Can)': 'menu-images/soft-drinks.png',
  'Chin Chin': 'menu-images/chin-chin.png',
  'Puff Puff': 'menu-images/puff-puff.png',
  'Samosa (3 pcs)': 'menu-images/samosa.png'
};

function menuItemImageSrc(item) {
  const imageUrl = String(item?.image_url || '').trim();
  const resolvedImageUrl = MENU_IMAGE_ALIASES[imageUrl] || imageUrl || MENU_IMAGE_BY_NAME[item?.item_name] || '';
  return menuImageSrc(resolvedImageUrl);
}

const ToastContext = createContext(null);
const ThemeContext = createContext(null);
const THEME_STORAGE_KEY = 'irms_theme';

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = (type, message) => {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, type, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3500);
  };

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={classNames('toast', toast.type)}>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function useToast() {
  return useContext(ToastContext);
}

function getInitialTheme() {
  if (typeof window === 'undefined') return 'dark';
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const value = useMemo(() => ({
    theme,
    setTheme,
    toggleTheme: () => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function useTheme() {
  return useContext(ThemeContext);
}

function ThemeToggleFab() {
  const theme = useTheme();
  if (!theme) return null;
  const isDark = theme.theme === 'dark';

  return (
    <button
      type="button"
      className="btn btn-secondary theme-fab"
      onClick={theme.toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      {isDark ? <SunMedium size={16} /> : <MoonStar size={16} />}
      <span className="theme-fab-label">{isDark ? 'Light mode' : 'Dark mode'}</span>
    </button>
  );
}

function App() {
  return (
    <BrowserRouter basename={APP_BASE_PATH === '/' ? '/' : APP_BASE_PATH}>
      <ThemeProvider>
        <ToastProvider>
          <Routes>
          <Route path="/" element={<Navigate to="/customer" replace />} />
          <Route path="/shared/login" element={<LoginPage />} />
          <Route path="/scan/:tableNumber/:token" element={<ScanRedirectPage />} />
          <Route path="/frontend/scan/:tableNumber/:token" element={<ScanRedirectPage />} />
          <Route path="/customer" element={<CustomerPage />} />
          <Route path="/customer/payment-success" element={<PaymentSuccessPage />} />
          <Route path="/customer/payment-failed" element={<PaymentFailedPage />} />

          <Route element={<ProtectedShell allowedRoles={['staff', 'admin', 'manager']} shell="staff" />}>
            <Route path="/staff" element={<StaffPage />} />
          </Route>

          <Route element={<ProtectedShell allowedRoles={['admin', 'manager', 'ceo']} shell="manager" />}>
            <Route path="/manager" element={<ManagerDashboardPage />} />
            <Route path="/manager/menu" element={<MenuPage />} />
            <Route path="/manager/orders" element={<OrdersPage />} />
            <Route path="/manager/stock" element={<StockPage />} />
            <Route path="/manager/qr" element={<QrPage />} />
            <Route path="/manager/users" element={<UsersPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/customer" replace />} />
          </Routes>
          <ThemeToggleFab />
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

function ScanRedirectPage() {
  const { tableNumber, token } = useParams();
  const table = tableNumber ? decodeURIComponent(tableNumber) : 'T1';
  const qrToken = token ? decodeURIComponent(token) : '';

  return <Navigate to={`/customer?table=${encodeURIComponent(table)}&token=${encodeURIComponent(qrToken)}`} replace />;
}

function ProtectedShell({ allowedRoles, shell }) {
  const user = getSessionUser();
  const location = useLocation();

  if (!requiresRole(user, allowedRoles)) {
    return <Navigate to="/shared/login" replace state={{ from: location.pathname }} />;
  }

  return shell === 'staff' ? <StaffShell user={user} /> : <ManagerShell user={user} />;
}

function PageFrame({ title, subtitle, actions, children }) {
  return (
    <div className="page-frame">
      <header className="page-header">
        <div>
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {actions ? <div className="page-actions">{actions}</div> : null}
      </header>
      {children}
    </div>
  );
}

function Shell({ user, navItems, children, eyebrow, title, subtitle, footerExtra }) {
  const navigate = useNavigate();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark" aria-label={APP_NAME}>
            <img src={BRAND_ICON} alt="" aria-hidden="true" />
          </div>
          <div className="brand-copy">
            <strong>{APP_NAME}</strong>
            <span>{eyebrow}</span>
          </div>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => classNames('nav-link', isActive && 'active')}>
              <item.icon size={17} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-block">
            <UserCircle2 size={18} />
            <div>
              <strong>{user?.full_name || 'User'}</strong>
              <span>{user?.role || 'guest'}</span>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-block"
            onClick={() => {
              clearSession();
              navigate('/shared/login');
            }}
          >
            <LogOut size={16} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <main className="workspace">
        <div className="workspace-topline">
          <div>
            <div className="eyebrow">{eyebrow}</div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          {footerExtra}
        </div>
        {children}
      </main>
    </div>
  );
}

function StaffShell({ user }) {
  const navItems = [
    { to: '/staff', label: 'Orders', icon: ClipboardList },
    { to: '/staff?panel=messages', label: 'Messages', icon: MessageSquareText }
  ];
  return (
    <Shell
      user={user}
      navItems={navItems}
      eyebrow="Kitchen and floor operations"
      title="Staff Console"
      subtitle="Live orders and customer messages"
      footerExtra={null}
    >
      <Routes>
        <Route path="/staff" element={<StaffPage />} />
      </Routes>
    </Shell>
  );
}

function ManagerShell({ user }) {
  const navItems = [
    { to: '/manager', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/manager/orders', label: 'Orders', icon: ClipboardList },
    { to: '/manager/menu', label: 'Menu', icon: Menu },
    { to: '/manager/stock', label: 'Stock', icon: Package },
    { to: '/manager/qr', label: 'QR Codes', icon: QrCode },
    ...(user?.role === 'admin' ? [{ to: '/manager/users', label: 'Users', icon: Users }] : [])
  ];

  return (
    <Shell
      user={user}
      navItems={navItems}
      eyebrow="Management and control"
      title="Manager and CEO Console"
      subtitle="Sales, stock, payments, prep-time, and account balance"
      footerExtra={<RolePill role={user?.role} />}
    >
      <Routes>
        <Route path="/manager" element={<ManagerDashboardPage />} />
        <Route path="/manager/orders" element={<OrdersPage />} />
        <Route path="/manager/menu" element={<MenuPage />} />
        <Route path="/manager/stock" element={<StockPage />} />
        <Route path="/manager/qr" element={<QrPage />} />
        <Route path="/manager/users" element={<UsersPage />} />
      </Routes>
    </Shell>
  );
}

function RolePill({ role }) {
  return (
    <div className="role-pill">
      <ShieldCheck size={15} />
      <span>{role}</span>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, meta }) {
  return (
    <section className="stat-card">
      <div className="stat-top">
        <div className="stat-icon"><Icon size={18} /></div>
        {meta ? <span className="stat-meta">{meta}</span> : null}
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </section>
  );
}

function Panel({ title, subtitle, actions, children }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {actions ? <div className="panel-actions">{actions}</div> : null}
      </div>
      <div className="panel-body">{children}</div>
    </section>
  );
}

function Button({ icon: Icon, children, variant = 'primary', ...props }) {
  return (
    <button type="button" className={classNames('btn', `btn-${variant}`)} {...props}>
      {Icon ? <Icon size={16} /> : null}
      <span>{children}</span>
    </button>
  );
}

function Input({ label, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input className="input" {...props} />
    </label>
  );
}

function Select({ label, children, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select className="input" {...props}>{children}</select>
    </label>
  );
}

function Textarea({ label, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea className="input" {...props} />
    </label>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const pushToast = useToast();
  const [form, setForm] = useState({ email: 'admin@restaurant.com', password: 'Admin@123' });
  const [loading, setLoading] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/login', form);
      if (!res.success) {
        pushToast('danger', res.message || 'Login failed.');
        return;
      }
      setSession(res.token, res.user);
      pushToast('success', 'Login successful.');
      if (['admin', 'manager', 'ceo'].includes(res.user.role)) {
        navigate('/manager', { replace: true });
      } else {
        navigate('/staff', { replace: true });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <img src={BRAND_LOGO} alt={APP_NAME} />
        </div>
        <h1>Sign in</h1>
        <p>Access the customer, staff, manager, or CEO workspace.</p>
        <form className="grid-form" onSubmit={onSubmit}>
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm((curr) => ({ ...curr, email: e.target.value }))} />
          <Input label="Password" type="password" value={form.password} onChange={(e) => setForm((curr) => ({ ...curr, password: e.target.value }))} />
          <Button icon={LogOut} type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</Button>
        </form>
        <div className="auth-footnote">
          Default seeded admin credentials are ready for local smoke testing.
        </div>
      </div>
    </div>
  );
}

function CustomerPage() {
  const pushToast = useToast();
  const [searchParams] = useSearchParams();
  const storedQrContext = useMemo(readStoredQrContext, []);
  const urlTableNumber = searchParams.get('table');
  const urlQrToken = searchParams.get('token');
  const tableNumber = urlTableNumber || storedQrContext?.tableNumber || 'T1';
  const qrToken = urlQrToken || (storedQrContext?.tableNumber === tableNumber ? storedQrContext?.token : '') || '';
  const [menu, setMenu] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [cart, setCart] = useState([]);
  const [activeOrderId, setActiveOrderId] = useState(searchParams.get('order_id') || storedQrContext?.orderId || '');
  const [activeOrder, setActiveOrder] = useState(null);
  const [orderMessages, setOrderMessages] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showTracking, setShowTracking] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [customerView, setCustomerView] = useState('home');
  const [homeSlideIndex, setHomeSlideIndex] = useState(0);
  const [messageText, setMessageText] = useState('');
  const [paymentEmail, setPaymentEmail] = useState('');
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [orderActionMessage, setOrderActionMessage] = useState('');
  const [paymentActionMessage, setPaymentActionMessage] = useState('');
  const [refreshingCustomer, setRefreshingCustomer] = useState(false);
  const [orderHistory, setOrderHistory] = useState(() => readOrderHistory()[tableNumber] || []);
  const [now, setNow] = useState(Date.now());
  const lastOrderStatusRef = useRef(null);
  const lastPaymentStatusRef = useRef(null);
  const readyNoticeShownRef = useRef(false);

  const menuSectionRef = useRef(null);
  useEffect(() => {
    if (urlQrToken) {
      saveQrContext(tableNumber, urlQrToken);
    }
  }, [tableNumber, urlQrToken]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setHomeSlideIndex((current) => (current + 1) % HOME_SLIDES.length);
    }, 4200);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    api.get('/menu').then((res) => {
      if (!res.success) {
        pushToast('danger', res.message || 'Failed to load menu.');
        return;
      }
      setMenu(res.data || []);
      setActiveCategory((res.data || [])[0]?.category_id || null);
    });
  }, []);

  useEffect(() => {
    if (!activeOrderId) {
      setOrderMessages([]);
      return;
    }
    const load = async () => {
      const [orderRes, messageRes] = await Promise.all([
        api.get(`/orders/${activeOrderId}`),
        api.get(`/messages/order/${activeOrderId}?table_number=${encodeURIComponent(tableNumber)}`)
      ]);
      if (orderRes.success) {
        setActiveOrder(orderRes.data);
        saveOrderContext(activeOrderId, tableNumber, qrToken);
        setOrderHistory(saveOrderHistoryEntry(tableNumber, orderRes.data));
      }
      if (messageRes.success) {
        setOrderMessages(messageRes.data || []);
      }
    };
    load();
    const timer = window.setInterval(load, 15000);
    return () => window.clearInterval(timer);
  }, [activeOrderId, tableNumber, qrToken]);

  useEffect(() => {
    refreshTableOrderHistory().catch(() => {});
  }, [tableNumber]);

  const currentItems = useMemo(() => menu.find((cat) => cat.category_id === activeCategory)?.items || [], [menu, activeCategory]);
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const tableHint = qrToken ? `Table ${tableNumber}` : `Table ${tableNumber} - scan a valid QR link`;
  const homeSlide = HOME_SLIDES[homeSlideIndex];

  async function refreshTableOrderHistory() {
    const currentHistory = readOrderHistory()[tableNumber] || [];
    if (currentHistory.length === 0) {
      setOrderHistory([]);
      return [];
    }

    const responses = await Promise.all(currentHistory.map((order) => api.get(`/orders/${order.order_id}`)));
    const nextHistory = currentHistory.map((order, index) => {
      const latest = responses[index];
      return latest?.success ? { ...order, ...latest.data, order_id: String(latest.data.order_id), savedAt: order.savedAt } : order;
    });
    const savedHistory = writeTableOrderHistory(tableNumber, nextHistory);
    setOrderHistory(savedHistory);
    return savedHistory;
  }

  async function refreshCustomerData() {
    setRefreshingCustomer(true);
    try {
      const requests = [api.get('/menu')];
      if (activeOrderId) {
        requests.push(api.get(`/orders/${activeOrderId}`));
        requests.push(api.get(`/messages/order/${activeOrderId}?table_number=${encodeURIComponent(tableNumber)}`));
      }
      const [menuRes, orderRes, messageRes] = await Promise.all(requests);
      if (menuRes.success) {
        setMenu(menuRes.data || []);
        setActiveCategory((current) => current || (menuRes.data || [])[0]?.category_id || null);
      }
      if (orderRes?.success) {
        setActiveOrder(orderRes.data);
        saveOrderContext(activeOrderId, tableNumber, qrToken);
        setOrderHistory(saveOrderHistoryEntry(tableNumber, orderRes.data));
      } else {
        await refreshTableOrderHistory();
      }
      if (messageRes?.success) {
        setOrderMessages(messageRes.data || []);
      }
      pushToast('success', activeOrderId ? 'Order status refreshed.' : 'Menu refreshed.');
    } finally {
      setRefreshingCustomer(false);
    }
  }

  function addItem(item) {
    setCart((current) => {
      const found = current.find((cartItem) => cartItem.menu_item_id === item.menu_item_id);
      if (found) {
        return current.map((cartItem) =>
          cartItem.menu_item_id === item.menu_item_id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        );
      }
      return [...current, { menu_item_id: item.menu_item_id, name: item.item_name, price: Number(item.price), quantity: 1 }];
    });
    pushToast('success', `${item.item_name} added to cart.`);
  }

  function updateQty(menuItemId, delta) {
    setCart((current) =>
      current
        .map((item) => item.menu_item_id === menuItemId ? { ...item, quantity: item.quantity + delta } : item)
        .filter((item) => item.quantity > 0)
    );
  }

  function returnToMenuForAddOns() {
    setShowTracking(false);
    setShowCart(false);
    window.setTimeout(() => {
      menuSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  function scrollToCustomerTop() {
    setCustomerView('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function scrollToMenu() {
    setCustomerView('menu');
    window.setTimeout(() => {
      menuSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  function openNotifications() {
    setShowNotifications(true);
  }
  async function submitCart() {
    setOrderActionMessage('');
    if (canAddToCurrentOrder) {
      await addItemsToCurrentOrder();
      return;
    }
    await placeOrder();
  }

  async function addItemsToCurrentOrder() {
    if (!qrToken) {
      const message = 'Scan a valid table QR code before adding items.';
      setOrderActionMessage(message);
      pushToast('danger', message);
      return;
    }
    if (cart.length === 0) {
      const message = 'Add at least one menu item first.';
      setOrderActionMessage(message);
      pushToast('danger', message);
      return;
    }
    setLoadingOrder(true);
    try {
      const res = await api.post(`/orders/${activeOrderId}/items`, {
        table_number: tableNumber,
        token: qrToken,
        items: cart.map((item) => ({ menu_item_id: item.menu_item_id, quantity: item.quantity }))
      });
      if (!res.success) {
        const message = res.message || 'Could not add items to this order.';
        setOrderActionMessage(message);
        pushToast('danger', message);
        return;
      }
      setActiveOrder(res.data);
      setOrderHistory(saveOrderHistoryEntry(tableNumber, res.data));
      setCart([]);
      setShowCart(false);
      setOrderActionMessage('');
      pushToast('success', 'Items added to your current order.');
    } finally {
      setLoadingOrder(false);
    }
  }

  async function placeOrder() {
    if (!qrToken) {
      const message = 'Scan a valid table QR code before placing an order.';
      setOrderActionMessage(message);
      pushToast('danger', message);
      return;
    }
    if (cart.length === 0) {
      const message = 'Add at least one menu item first.';
      setOrderActionMessage(message);
      pushToast('danger', message);
      return;
    }
    setLoadingOrder(true);
    try {
      const res = await api.post('/orders', {
        table_number: tableNumber,
        token: qrToken,
        items: cart.map((item) => ({ menu_item_id: item.menu_item_id, quantity: item.quantity }))
      });
      if (!res.success) {
        const message = res.message || 'Could not place order.';
        setOrderActionMessage(message);
        pushToast('danger', message);
        return;
      }
      setActiveOrderId(String(res.data.order_id));
      saveOrderContext(res.data.order_id, tableNumber, qrToken);
      const placedOrder = { ...res.data, order_status: 'pending', payment_status: 'unpaid', items: cart, created_at: new Date().toISOString() };
      setActiveOrder(placedOrder);
      setOrderHistory(saveOrderHistoryEntry(tableNumber, placedOrder));
      setCart([]);
      setShowCart(false);
      setShowPayment(true);
      setOrderActionMessage('');
      setPaymentActionMessage('');
      pushToast('success', `Order #${res.data.order_id} has been placed.`);
      pushToast('success', `Estimated wait: ${res.data.estimated_wait_time} min.`);
    } finally {
      setLoadingOrder(false);
    }
  }

  async function sendMessage() {
    if (!activeOrderId) {
      pushToast('danger', 'Place an order first.');
      return;
    }
    if (!messageText.trim()) {
      pushToast('danger', 'Type a message first.');
      return;
    }
    const res = await api.post('/messages', {
      order_id: activeOrderId,
      table_number: tableNumber,
      message_content: messageText
    });
    if (res.success) {
      pushToast('success', 'Message sent.');
      setOrderMessages((current) => [
        ...current,
        {
          message_id: `local-${Date.now()}`,
          message_content: messageText,
          response: ''
        }
      ]);
      setMessageText('');
      setShowMessage(false);
    } else {
      pushToast('danger', res.message || 'Message failed.');
    }
  }

  async function initializePayment() {
    if (!activeOrderId) {
      const message = 'Place an order first.';
      setPaymentActionMessage(message);
      pushToast('danger', message);
      return;
    }
    if (!paymentEmail.includes('@')) {
      const message = 'Enter a valid email address.';
      setPaymentActionMessage(message);
      pushToast('danger', message);
      return;
    }
    setPaymentLoading(true);
    setPaymentActionMessage('');
    try {
      const res = await api.post('/payment/initialize', { order_id: activeOrderId, email: paymentEmail });
      if (res.success && res.data?.authorization_url) {
        window.location.href = res.data.authorization_url;
        return;
      }
      const message = res.message || res.error || 'Payment could not be started.';
      setPaymentActionMessage(message);
      pushToast('danger', message);
    } finally {
      setPaymentLoading(false);
    }
  }

  const activeOrderStatus = activeOrder?.order_status || 'pending';
  const elapsedMinutes = activeOrder?.created_at ? Math.floor((now - new Date(activeOrder.created_at).getTime()) / 60000) : 0;
  const remainingMinutes = activeOrder?.estimated_wait_time != null ? Math.max(Number(activeOrder.estimated_wait_time) - elapsedMinutes, 0) : null;
  const timeLeftText = remainingMinutes == null
    ? 'Pending wait estimate'
    : remainingMinutes === 0
      ? 'Order is ready'
      : `${remainingMinutes} min left`;
  const statusTrackingText = {
    pending: timeLeftText,
    preparing: `Order in progress - ${timeLeftText}`,
    ready: 'Order is ready',
    delivered: 'Order delivered',
    cancelled: 'Order cancelled'
  };
  const progressText = statusTrackingText[activeOrderStatus] || timeLeftText;
  const canAddToCurrentOrder = activeOrderId && ['pending'].includes(activeOrderStatus) && ['unpaid', 'pending'].includes(activeOrder?.payment_status || 'unpaid');
  const notificationItems = useMemo(() => {
    if (!activeOrderId) {
      return [{ title: 'No active order yet', body: 'Place an order and this bell will show kitchen, payment, and receipt updates.', tone: 'muted' }];
    }
    const items = [
      { title: `Order #${activeOrderId}`, body: progressText, tone: activeOrderStatus },
      { title: 'Payment status', body: activeOrder?.payment_status === 'paid' ? 'Payment successful. Receipt is ready below.' : `Payment is ${activeOrder?.payment_status || 'unpaid'}.`, tone: activeOrder?.payment_status === 'paid' ? 'paid' : 'pending' }
    ];
    if (activeOrderStatus === 'ready') items.unshift({ title: 'Ready for pickup', body: 'Your order is ready. Please meet the kitchen or service desk.', tone: 'ready' });
    if (activeOrderStatus === 'delivered') items.unshift({ title: 'Delivered', body: 'This order has been marked delivered. Thank you for dining with us.', tone: 'delivered' });
    if (activeOrderStatus === 'pending') items.push({ title: 'Kitchen queue', body: 'Your request is pending and will be accepted by the kitchen.', tone: 'pending' });
    return items;
  }, [activeOrder, activeOrderId, activeOrderStatus, progressText]);

  useEffect(() => {
    if (!activeOrder) return;
    const status = activeOrder.order_status;
    const payment = activeOrder.payment_status;

    if (lastPaymentStatusRef.current && lastPaymentStatusRef.current !== payment && payment === 'paid') {
      pushToast('success', 'Payment confirmed. Order in progress.');
    }
    if (lastOrderStatusRef.current && lastOrderStatusRef.current !== status) {
      if (status === 'preparing') pushToast('success', 'Order in progress.');
      if (status === 'ready') pushToast('success', 'Order is ready.');
      if (status === 'delivered') pushToast('success', 'Order delivered.');
      if (status === 'cancelled') pushToast('danger', 'Order cancelled.');
    }
    if (remainingMinutes === 0 && !['cancelled', 'ready', 'delivered'].includes(status) && !readyNoticeShownRef.current) {
      readyNoticeShownRef.current = true;
      pushToast('success', 'Order is ready.');
    }

    lastOrderStatusRef.current = status;
    lastPaymentStatusRef.current = payment;
  }, [activeOrder, remainingMinutes, pushToast]);

  return (
    <div className="customer-page">
      <header className="customer-topbar">
        <div className="customer-branding">
          <div className="eyebrow">Customer ordering</div>
          <h1>{APP_NAME}</h1>
          <p>{tableHint}</p>
        </div>
        <div className="customer-mobile-actions" aria-label="Customer mobile actions">
          <button type="button" className="customer-mobile-action" onClick={openNotifications} aria-label="Notifications">
            <span className="customer-mobile-action-icon">
              <Bell size={18} />
              {activeOrderId ? <span className="customer-mobile-action-dot" aria-hidden="true" /> : null}
            </span>
          </button>
          <button type="button" className="customer-mobile-action" onClick={() => setShowMessage(true)} aria-label="Message kitchen">
            <MessageSquareText size={18} />
          </button>
        </div>
        <div className="customer-actions">
          <button type="button" className="btn btn-secondary customer-message-btn" onClick={() => setShowMessage(true)}>
            <MessageSquareText size={16} />
            <span>Message kitchen</span>
          </button>
          <button type="button" className="btn btn-secondary customer-refresh-btn" onClick={refreshCustomerData} disabled={refreshingCustomer}>
            <RefreshCw size={16} />
            <span>{refreshingCustomer ? 'Refreshing...' : 'Refresh'}</span>
          </button>
          <button type="button" className="btn btn-primary customer-cart-btn" onClick={() => setShowCart(true)}>
            <ShoppingCart size={16} />
            <span>Cart {itemCount > 0 ? `(${itemCount})` : ''}</span>
          </button>
        </div>
      </header>

      {!qrToken ? (
        <div className="notice notice-danger">
          This table link is missing a QR token. Use a valid QR link before placing an order.
        </div>
      ) : null}

      {activeOrderId ? (
        <section className="notice notice-info customer-active-order">
          <div className="customer-active-copy">
            <strong>Active order #{activeOrderId}</strong>
            <div className="customer-active-progress">{progressText}</div>
          </div>
          <div className="notice-actions customer-active-actions">
            <span className={`${badgeClass(activeOrderStatus)} customer-active-badge`}>{activeOrderStatus}</span>
            <button type="button" className="btn btn-secondary customer-track-btn" onClick={() => setShowTracking(true)}>
              <Eye size={16} />
              <span>Track order</span>
            </button>
          </div>
        </section>
      ) : null}

      {customerView === 'home' ? (
        <section className="customer-home" aria-label="Restaurant home">
          <div className="home-hero-panel">
            <div className="home-hero-copy">
              <span className="home-kicker">IRMS restaurant</span>
              <h2>Fast table ordering with a warm kitchen feel.</h2>
              <p>Explore a demo restaurant experience for QR ordering, fresh local meals, kitchen updates, and easy digital payment.</p>
              <div className="home-hero-actions">
                <button type="button" className="btn btn-primary" onClick={scrollToMenu}>
                  <Menu size={16} />
                  <span>Browse menu</span>
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowMessage(true)}>
                  <MessageSquareText size={16} />
                  <span>Ask kitchen</span>
                </button>
              </div>
            </div>
            <div className="home-visual-stack" aria-hidden="true">
              <img key={`main-${homeSlide.main}`} className="home-plate main" src={menuImageSrc(homeSlide.main)} alt="" />
              <div className="home-slide-dots">
                {HOME_SLIDES.map((slide, index) => (
                  <span key={slide.main} className={classNames(index === homeSlideIndex && 'active')} />
                ))}
              </div>
            </div>
          </div>

          <div className="home-feature-grid">
            <article className="home-feature-card">
              <ChefHat size={20} />
              <strong>Kitchen-led meals</strong>
              <p>Main courses, snacks, desserts, and drinks are grouped for quick browsing.</p>
            </article>
            <article className="home-feature-card">
              <Clock3 size={20} />
              <strong>Live wait estimates</strong>
              <p>Prep-time records help customers see realistic order timing.</p>
            </article>
            <article className="home-feature-card">
              <Wallet size={20} />
              <strong>Simple payment</strong>
              <p>Move from cart to payment without leaving the table ordering flow.</p>
            </article>
          </div>

          <div className="home-story-panel">
            <div>
              <span className="home-kicker">What we offer</span>
              <h3>Casual dining, made smoother.</h3>
              <p>This restaurant blends Nigerian-inspired comfort plates with fast counter-service habits: scan, order, pay, track, and enjoy.</p>
            </div>
            <div className="home-fact-list">
              <span>QR table ordering</span>
              <span>Kitchen messaging</span>
              <span>24-hour order history</span>
              <span>Receipt-ready payments</span>
            </div>
          </div>
        </section>
      ) : (
        <>
          <section ref={menuSectionRef} className="category-strip">
            {menu.map((category) => (
              <button
                key={category.category_id}
                type="button"
                className={classNames('category-btn', category.category_id === activeCategory && 'active')}
                title={`View ${category.category_name}`}
                onClick={() => setActiveCategory(category.category_id)}
              >
                {category.category_name}
              </button>
            ))}
          </section>

          <section className="menu-grid">
            {currentItems.map((item) => (
              <article key={item.menu_item_id} className={classNames('menu-card', item.availability_status !== 'available' && 'muted')}>
                <div className="menu-card-media">
                  {menuItemImageSrc(item) ? (
                    <img src={menuItemImageSrc(item)} alt={item.item_name} loading="lazy" />
                  ) : (
                    <div className="menu-card-image-fallback" aria-hidden="true">
                      <ChefHat size={34} />
                    </div>
                  )}
                </div>
                <div className="menu-card-head">
                  <div className="menu-card-icon">
                    <ChefHat size={18} />
                  </div>
                  <span className={badgeClass(item.availability_status)}>
                    {item.availability_status === 'out_of_stock' ? 'out of stock' : item.availability_status}
                  </span>
                </div>
                <h3>{item.item_name}</h3>
                <p>{item.description || 'No description provided.'}</p>
                <div className="menu-card-foot">
                  <div>
                    <strong>{formatNaira(item.price)}</strong>
                    <span>
                      <Clock3 size={14} />
                      <span>{item.average_preparation_time} min prep time</span>
                    </span>
                  </div>
                  <button type="button" className="btn btn-primary customer-add-btn" onClick={() => addItem(item)} disabled={item.availability_status !== 'available'}>
                    <Plus size={16} />
                    <span>Add</span>
                  </button>
                </div>
              </article>
            ))}
          </section>
        </>
      )}

      <nav className="customer-bottom-nav" aria-label="Customer quick actions">
        <button type="button" className={classNames('bottom-nav-item', customerView === 'home' && 'active')} onClick={scrollToCustomerTop}>
          <Home size={20} />
          <span>Home</span>
        </button>
        <button type="button" className={classNames('bottom-nav-item', customerView === 'menu' && 'active')} onClick={scrollToMenu}>
          <Menu size={20} />
          <span>Menu</span>
        </button>
        <button type="button" className="bottom-nav-item" onClick={() => activeOrderId ? setShowTracking(true) : pushToast('success', 'Place an order to start tracking.')}>
          <span className="bottom-nav-icon-wrap">
            <ClipboardList size={20} />
            {activeOrderId ? <span className="bottom-nav-dot" aria-hidden="true" /> : null}
          </span>
          <span>Track</span>
        </button>
        <button type="button" className="bottom-nav-item cart" onClick={() => setShowCart(true)}>
          <span className="bottom-nav-icon-wrap">
            <ShoppingCart size={20} />
            {itemCount > 0 ? <span className="bottom-nav-count">{itemCount}</span> : null}
          </span>
          <span>Cart</span>
        </button>
      </nav>
      <Modal open={showCart} title="Your order" onClose={() => setShowCart(false)}>
        <div className="stack">
          {cart.length === 0 ? <div className="empty">Your cart is empty.</div> : null}
          {cart.map((item) => (
            <div key={item.menu_item_id} className="cart-row">
              <div>
                <strong>{item.name}</strong>
                <div>{formatNaira(item.price * item.quantity)}</div>
              </div>
              <div className="qty-controls">
                <button className="icon-btn" type="button" onClick={() => updateQty(item.menu_item_id, -1)}>-</button>
                <span>{item.quantity}</span>
                <button className="icon-btn" type="button" onClick={() => updateQty(item.menu_item_id, 1)}>+</button>
              </div>
            </div>
          ))}
          <div className="summary-row">
            <strong>Total</strong>
            <strong>{formatNaira(total)}</strong>
          </div>
          {orderActionMessage ? <div className="notice notice-danger compact-notice">{orderActionMessage}</div> : null}
          <Button icon={Send} onClick={submitCart} disabled={loadingOrder || cart.length === 0}>
            {loadingOrder ? 'Saving order...' : canAddToCurrentOrder ? 'Add to current order' : 'Place order'}
          </Button>
        </div>
      </Modal>

      <Modal open={showMessage} title="Message the kitchen" onClose={() => setShowMessage(false)}>
        <div className="stack">
          {!activeOrderId ? <div className="notice notice-danger">Place an order first, then send a kitchen message.</div> : null}
          <Textarea label="Message" rows={4} value={messageText} onChange={(e) => setMessageText(e.target.value)} placeholder="Please add extra pepper to my order." />
          <Button icon={Send} onClick={sendMessage}>Send message</Button>
        </div>
      </Modal>
      <Modal open={showPayment} title="Pay for this order" onClose={() => setShowPayment(false)}>
        <div className="stack">
          <div className="summary-row">
            <span>Order #{activeOrderId}</span>
            <strong>{formatNaira(activeOrder?.total_amount || total)}</strong>
          </div>
          <Input label="Email address" type="email" value={paymentEmail} onChange={(e) => setPaymentEmail(e.target.value)} placeholder="you@example.com" />
          {paymentActionMessage ? <div className="notice notice-danger compact-notice">{paymentActionMessage}</div> : null}
          <Button icon={Wallet} onClick={initializePayment} disabled={paymentLoading}>
            {paymentLoading ? 'Starting payment...' : 'Start payment'}
          </Button>
        </div>
      </Modal>

      <Modal open={showNotifications} title="Notifications" onClose={() => setShowNotifications(false)}>
        <div className="stack notification-stack">
          {notificationItems.map((item) => (
            <div key={`${item.title}-${item.body}`} className={classNames('notification-row', `tone-${item.tone}`)}>
              <Bell size={16} />
              <div>
                <strong>{item.title}</strong>
                <span>{item.body}</span>
              </div>
            </div>
          ))}
          {activeOrder?.payment_status === 'paid' ? (
            <div className="receipt-panel">
              <div className="summary-row">
                <span>Receipt</span>
                <strong>Order #{activeOrderId}</strong>
              </div>
              {(activeOrder.items || []).map((item) => (
                <div key={`receipt-${item.menu_item_id}-${item.quantity}`} className="summary-row">
                  <span>{(item.item_name || item.name)} x{item.quantity}</span>
                  <strong>{formatNaira(item.subtotal)}</strong>
                </div>
              ))}
              <div className="summary-row">
                <span>Total paid</span>
                <strong>{formatNaira(activeOrder.total_amount)}</strong>
              </div>
            </div>
          ) : null}
        </div>
      </Modal>
      <Modal open={showTracking} title={`Order #${activeOrderId || '-'}`} onClose={() => setShowTracking(false)}>
        {activeOrder ? (
          <div className="stack">
            <div className="summary-row">
              <span>Table</span>
              <strong>{activeOrder.table_number}</strong>
            </div>
            <div className="summary-row">
              <span>Status</span>
              <span className={badgeClass(activeOrder.order_status)}>{activeOrder.order_status}</span>
            </div>
            <div className="summary-row">
              <span>Payment</span>
              <span className={badgeClass(activeOrder.payment_status)}>{activeOrder.payment_status}</span>
            </div>
            <div className="summary-row">
              <span>Time left</span>
              <strong>{progressText}</strong>
            </div>
            <div className="summary-row">
              <span>Total</span>
              <strong>{formatNaira(activeOrder.total_amount)}</strong>
            </div>
            {['unpaid', 'pending'].includes(activeOrder.payment_status) && activeOrder.order_status !== 'cancelled' ? (
              <div className="page-actions">
                <button type="button" className="btn btn-primary" onClick={() => { setShowTracking(false); setShowPayment(true); }}>
                  <Wallet size={16} />
                  <span>Pay for order</span>
                </button>
                {canAddToCurrentOrder ? (
                  <button type="button" className="btn btn-secondary" onClick={returnToMenuForAddOns}>
                    <Plus size={16} />
                    <span>Add more items</span>
                  </button>
                ) : null}
              </div>
            ) : null}
            <div className="divider" />
            {(activeOrder.items || []).map((item) => (
              <div key={`${item.menu_item_id}-${item.quantity}`} className="summary-row">
                <span>{(item.item_name || item.name)} x{item.quantity}</span>
                <strong>{formatNaira(item.subtotal)}</strong>
              </div>
            ))}
            <div className="divider" />
            <strong>Kitchen messages</strong>
            {orderMessages.length === 0 ? <div className="empty">No messages for this order yet.</div> : null}
            {orderMessages.map((message) => (
              <div key={message.message_id} className="message-thread">
                <div className="message-copy">You: {message.message_content}</div>
                {message.response ? (
                  <div className="response-copy">Kitchen: {message.response}</div>
                ) : (
                  <div className="message-copy">Waiting for response.</div>
                )}
              </div>
            ))}
            <div className="divider" />
            <strong>Today at this table</strong>
            {orderHistory.length === 0 ? <div className="empty">No recent orders for this table.</div> : null}
            {orderHistory.map((order) => (
              <button key={order.order_id} type="button" className="history-row" onClick={() => { setActiveOrderId(String(order.order_id)); setShowTracking(true); }}>
                <span>Order #{order.order_id}</span>
                <span className={badgeClass(order.order_status)}>{order.order_status || 'pending'}</span>
                <strong>{formatNaira(order.total_amount)}</strong>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty">No active order loaded yet.</div>
        )}
      </Modal>
    </div>
  );
}

function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order_id');
  const storedQrContext = readStoredQrContext();
  const table = searchParams.get('table') || storedQrContext?.tableNumber;
  const token = searchParams.get('token') || storedQrContext?.token;
  const trackUrl = appPath(`/customer?table=${encodeURIComponent(table || 'T1')}&token=${encodeURIComponent(token || '')}&order_id=${encodeURIComponent(orderId || '')}`);
  const menuUrl = appPath(`/customer?table=${encodeURIComponent(table || 'T1')}&token=${encodeURIComponent(token || '')}`);

  useEffect(() => {
    if (orderId) {
      saveOrderContext(orderId, table, token);
    }
  }, [orderId, table, token]);

  return (
    <div className="status-page success">
      <div className="status-card">
        <div className="status-icon success"><Sparkles size={24} /></div>
        <h1>Payment confirmed</h1>
        <p>Payment confirmed. Your order is now in progress.</p>
        <div className="stack">
          <div className="summary-row"><span>Order</span><strong>#{orderId || '-'}</strong></div>
          <div className="summary-row"><span>Table</span><strong>{table || '-'}</strong></div>
        </div>
        <div className="page-actions">
          <a className="btn btn-primary" href={trackUrl}>
            <Eye size={16} />
            <span>Track order</span>
          </a>
          <a className="btn btn-secondary" href={menuUrl}>
            <ArrowLeft size={16} />
            <span>Back to menu</span>
          </a>
        </div>
      </div>
    </div>
  );
}

function PaymentFailedPage() {
  return (
    <div className="status-page failed">
      <div className="status-card">
        <div className="status-icon danger"><Bell size={24} /></div>
        <h1>Payment not completed</h1>
        <p>The payment could not be verified. You can return to the menu and try again.</p>
        <div className="page-actions">
          <a className="btn btn-primary" href={appPath('/customer')}>
            <ArrowLeft size={16} />
            <span>Back to menu</span>
          </a>
        </div>
      </div>
    </div>
  );
}

function ManagerDashboardPage() {
  const pushToast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await api.get('/dashboard');
    if (!res.success) {
      pushToast('danger', res.message || 'Failed to load dashboard.');
    } else {
      setData(res.data);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const recentOrders = data?.recentOrders || [];
  const paymentSummary = data?.paymentSummary || {};
  const prepTimeRecords = data?.prepTimeRecords || [];
  const lowStock = data?.lowStock || [];

  return (
    <div className="page-stack">
      <div className="toolbar">
        <Button icon={RefreshCw} variant="secondary" onClick={load}>Refresh</Button>
      </div>
      <div className="stat-grid">
        <StatCard icon={ClipboardList} label="Total orders" value={loading ? '...' : data?.totalOrders ?? 0} meta="all time" />
        <StatCard icon={Wallet} label="Sales" value={loading ? '...' : formatNaira(data?.totalRevenue ?? 0)} meta="paid orders" />
        <StatCard icon={Wallet} label="Account balance" value={loading ? '...' : formatNaira(data?.accountBalance ?? 0)} meta="available funds" />
        <StatCard icon={Bell} label="Active orders" value={loading ? '...' : data?.pendingOrders ?? 0} meta="pending and preparing" />
      </div>

      <div className="two-column">
        <Panel title="Recent orders" subtitle="Latest activity across the restaurant">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Table</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.length === 0 ? (
                  <tr><td colSpan="6" className="empty-row">No recent orders.</td></tr>
                ) : recentOrders.map((order) => (
                  <tr key={order.order_id}>
                    <td>#{order.order_id}</td>
                    <td>{order.table_number}</td>
                    <td>{formatNaira(order.total_amount)}</td>
                    <td><span className={badgeClass(order.order_status)}>{order.order_status}</span></td>
                    <td><span className={badgeClass(order.payment_status)}>{order.payment_status}</span></td>
                    <td>{formatDate(order.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="stack">
          <Panel title="Payment status" subtitle="Paid and outstanding order totals">
            <div className="summary-grid">
              <div className="summary-box"><span>Paid</span><strong>{paymentSummary.paid ?? 0}</strong></div>
              <div className="summary-box"><span>Pending</span><strong>{paymentSummary.pending ?? 0}</strong></div>
              <div className="summary-box"><span>Failed</span><strong>{paymentSummary.failed ?? 0}</strong></div>
              <div className="summary-box"><span>Unpaid</span><strong>{paymentSummary.unpaid ?? 0}</strong></div>
            </div>
          </Panel>

          <Panel title="Stock alerts" subtitle="Items that need attention">
            <div className="stack">
              {lowStock.length === 0 ? <div className="empty">All stock levels are healthy.</div> : lowStock.map((item) => (
                <div key={item.stock_id} className="list-row">
                  <div>
                    <strong>{item.item_name}</strong>
                    <div>{item.quantity_available} {item.unit}</div>
                  </div>
                  <span className={badgeClass(item.stock_status === 'unavailable' ? 'out_of_stock' : item.stock_status)}>{item.stock_status === 'unavailable' || item.stock_status === 'out_of_stock' ? 'out of stock' : item.stock_status.replace('_', ' ')}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <Panel title="Preparation time records" subtitle="Linked menu prep times used for wait-time estimation">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Menu item</th>
                <th>Prep time</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {prepTimeRecords.length === 0 ? (
                <tr><td colSpan="3" className="empty-row">No prep records yet.</td></tr>
              ) : prepTimeRecords.map((record) => (
                <tr key={record.record_id}>
                  <td>{record.item_name}</td>
                  <td>{record.average_preparation_time} min</td>
                  <td>{formatDate(record.last_updated)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function OrdersPage() {
    const pushToast = useToast();
    const [orders, setOrders] = useState([]);
    const [filter, setFilter] = useState('all');
    const [expanded, setExpanded] = useState(null);

    const load = async () => {
      const res = await api.get('/orders');
      if (!res.success) {
        pushToast('danger', res.message || 'Failed to load orders.');
        return;
      }
      setOrders(res.data || []);
    };

    useEffect(() => { load(); }, []);

    const visible = filter === 'all' ? orders : orders.filter((order) => order.order_status === filter);

    async function updateStatus(orderId, order_status) {
      const res = await api.put(`/orders/${orderId}/status`, { order_status });
      if (!res.success) {
        pushToast('danger', res.message || 'Could not update order.');
        return;
      }
      pushToast('success', `Order #${orderId} set to ${order_status}.`);
      load();
    }

    async function reversePayment(orderId) {
      const res = await api.put('/payment/reverse', { order_id: orderId });
      if (!res.success) {
        pushToast('danger', res.message || 'Could not reverse payment.');
        return;
      }
      pushToast('success', `Payment reversed for order #${orderId}.`);
      load();
    }

    async function showItems(orderId) {
      setExpanded(orderId);
      if (!orderId) return;
      const res = await api.get(`/orders/${orderId}`);
      if (res.success) {
        setOrders((current) =>
          current.map((order) => (order.order_id === orderId ? { ...order, items: res.data.items } : order))
        );
      }
    }

    return (
      <div className="page-stack">
        <div className="toolbar">
          <div className="segmented">
            {['all', 'pending', 'preparing', 'ready', 'delivered', 'cancelled'].map((value) => (
              <button
                key={value}
                type="button"
                className={classNames('segment', filter === value && 'active')}
                onClick={() => setFilter(value)}
              >
                {value}
              </button>
            ))}
          </div>
          <Button icon={RefreshCw} variant="secondary" onClick={load}>Refresh</Button>
        </div>

        <div className="card-grid">
          {visible.map((order) => {
            const nextMap = { pending: 'preparing', preparing: 'ready', ready: 'delivered' };
            return (
              <article key={order.order_id} className="order-card">
                <div className="order-head">
                  <strong>Order #{order.order_id}</strong>
                  <span className={badgeClass(order.order_status)}>{order.order_status}</span>
                </div>
                <div className="list-row">
                  <span>Table {order.table_number}</span>
                  <span>{formatDate(order.created_at)}</span>
                </div>
                <div className="list-row">
                  <span>Total</span>
                  <strong>{formatNaira(order.total_amount)}</strong>
                </div>
                <div className="list-row">
                  <span>Payment</span>
                  <span className={badgeClass(order.payment_status)}>{order.payment_status}</span>
                </div>
                <div className="card-actions">
                  {nextMap[order.order_status] ? (
                    <Button icon={ChevronActionIcon(order.order_status)} onClick={() => updateStatus(order.order_id, nextMap[order.order_status])}>
                      {nextMap[order.order_status]}
                    </Button>
                  ) : null}
                  {order.order_status !== 'cancelled' ? (
                    <Button icon={Ban} variant="danger" onClick={() => updateStatus(order.order_id, 'cancelled')}>
                      Cancel
                    </Button>
                  ) : null}
                  {order.payment_status === 'paid' ? (
                    <Button icon={RotateCcw} variant="warning" onClick={() => reversePayment(order.order_id)}>
                      Reverse payment
                    </Button>
                  ) : null}
                  <Button icon={Eye} variant="secondary" onClick={() => showItems(order.order_id)}>Items</Button>
                </div>
                {expanded === order.order_id && Array.isArray(order.items) ? (
                  <div className="mini-list">
                    {order.items.map((item) => (
                      <div key={`${item.order_item_id}-${item.menu_item_id}`} className="list-row">
                        <span>{item.item_name} x{item.quantity}</span>
                        <strong>{formatNaira(item.subtotal)}</strong>
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>
    );
  }

  function ChevronActionIcon(orderStatus) {
  if (orderStatus === 'pending') return ChefHat;
  if (orderStatus === 'preparing') return Star;
  if (orderStatus === 'ready') return Download;
  return Edit3;
}

function MenuPage() {
  const pushToast = useToast();
  const [groups, setGroups] = useState([]);
  const [form, setForm] = useState({
    category_id: '',
    item_name: '',
    description: '',
    price: '',
    average_preparation_time: '',
    availability_status: 'available',
    image_url: ''
  });
  const [editing, setEditing] = useState(null);
  const [allItems, setAllItems] = useState([]);

  const load = async () => {
    const [menuRes, publicRes] = await Promise.all([api.get('/menu/all'), api.get('/menu')]);
    if (!menuRes.success || !publicRes.success) {
      pushToast('danger', 'Failed to load menu data.');
      return;
    }
    setGroups(publicRes.data || []);
    setAllItems(menuRes.data || []);
    if (!form.category_id && (publicRes.data || [])[0]?.category_id) {
      setForm((current) => ({ ...current, category_id: String((publicRes.data || [])[0].category_id) }));
    }
  };

  useEffect(() => { load(); }, []);

  const flatItems = useMemo(() => allItems, [allItems]);

  async function onCreate(event) {
    event.preventDefault();
    const res = await api.post('/menu', {
      ...form,
      category_id: Number(form.category_id),
      price: Number(form.price),
      average_preparation_time: Number(form.average_preparation_time)
    });
    if (!res.success) {
      pushToast('danger', res.message || 'Could not add menu item.');
      return;
    }
    pushToast('success', 'Menu item added.');
    setForm((current) => ({ ...current, item_name: '', description: '', price: '', average_preparation_time: '', image_url: '' }));
    load();
  }

  async function onUpdate(event) {
    event.preventDefault();
    const res = await api.put(`/menu/${editing.menu_item_id}`, {
      item_name: editing.item_name,
      description: editing.description || '',
      price: Number(editing.price),
      average_preparation_time: Number(editing.average_preparation_time),
      availability_status: editing.availability_status,
      image_url: editing.image_url || ''
    });
    if (!res.success) {
      pushToast('danger', res.message || 'Could not update menu item.');
      return;
    }
    pushToast('success', 'Menu item updated.');
    setEditing(null);
    load();
  }

  async function removeItem(item) {
    if (!window.confirm(`Delete ${item.item_name}?`)) return;
    const res = await api.del(`/menu/${item.menu_item_id}`);
    if (!res.success) {
      pushToast('danger', res.message || 'Could not delete menu item.');
      return;
    }
    pushToast('success', 'Menu item deleted.');
    load();
  }

  return (
    <div className="page-stack">
      <Panel title="Add menu item" subtitle="Keep prep times synced with the documented model">
        <form className="grid-form" onSubmit={onCreate}>
          <div className="form-grid">
            <Select label="Category" value={form.category_id} onChange={(e) => setForm((current) => ({ ...current, category_id: e.target.value }))}>
              {groups.map((category) => (
                <option key={category.category_id} value={category.category_id}>{category.category_name}</option>
              ))}
            </Select>
            <Input label="Item name" value={form.item_name} onChange={(e) => setForm((current) => ({ ...current, item_name: e.target.value }))} />
            <Input label="Price" type="number" step="0.01" value={form.price} onChange={(e) => setForm((current) => ({ ...current, price: e.target.value }))} />
            <Input label="Prep time (minutes)" type="number" value={form.average_preparation_time} onChange={(e) => setForm((current) => ({ ...current, average_preparation_time: e.target.value }))} />
            <Select label="Availability" value={form.availability_status} onChange={(e) => setForm((current) => ({ ...current, availability_status: e.target.value }))}>
              <option value="available">Available</option>
              <option value="out_of_stock">Out of stock</option>
            </Select>
            <Input label="Image URL" value={form.image_url} onChange={(e) => setForm((current) => ({ ...current, image_url: e.target.value }))} />
          </div>
          <Textarea label="Description" rows={3} value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} />
          <Button icon={Save} type="submit">Save menu item</Button>
        </form>
      </Panel>

      <Panel title="Menu inventory" subtitle="Edit, remove, and review item preparation times">
        <div className="card-grid">
          {flatItems.map((item) => (
            <article key={item.menu_item_id} className="order-card">
              {editing?.menu_item_id === item.menu_item_id ? (
                <form className="stack" onSubmit={onUpdate}>
                  <Input label="Item name" value={editing.item_name} onChange={(e) => setEditing((current) => ({ ...current, item_name: e.target.value }))} />
                  <Input label="Price" type="number" step="0.01" value={editing.price} onChange={(e) => setEditing((current) => ({ ...current, price: e.target.value }))} />
                  <Input label="Prep time" type="number" value={editing.average_preparation_time} onChange={(e) => setEditing((current) => ({ ...current, average_preparation_time: e.target.value }))} />
                  <Select label="Availability" value={editing.availability_status} onChange={(e) => setEditing((current) => ({ ...current, availability_status: e.target.value }))}>
                    <option value="available">Available</option>
                    <option value="out_of_stock">Out of stock</option>
                  </Select>
                  <Input label="Image URL" value={editing.image_url || ''} onChange={(e) => setEditing((current) => ({ ...current, image_url: e.target.value }))} />
                  <Textarea label="Description" rows={3} value={editing.description || ''} onChange={(e) => setEditing((current) => ({ ...current, description: e.target.value }))} />
                  <div className="card-actions">
                    <Button icon={Save} type="submit">Save</Button>
                    <Button icon={ArrowLeft} variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="manager-menu-preview">
                    {menuItemImageSrc(item) ? (
                      <img src={menuItemImageSrc(item)} alt={item.item_name} loading="lazy" />
                    ) : (
                      <div className="manager-menu-preview-fallback" aria-hidden="true"><ChefHat size={24} /></div>
                    )}
                  </div>
                  <div className="order-head">
                    <strong>{item.item_name}</strong>
                    <span className={badgeClass(item.availability_status)}>{item.availability_status}</span>
                  </div>
                  <div className="list-row"><span>Category</span><strong>{item.category_name}</strong></div>
                  <div className="list-row"><span>Price</span><strong>{formatNaira(item.price)}</strong></div>
                  <div className="list-row"><span>Prep time</span><strong>{item.average_preparation_time} min</strong></div>
                  <div className="list-row"><span>Image</span><span>{item.image_url || '-'}</span></div>
                  <div className="list-row"><span>Description</span><span>{item.description || '-'}</span></div>
                  <div className="card-actions">
                    <Button icon={Edit3} variant="secondary" onClick={() => setEditing({ ...item, price: String(item.price), average_preparation_time: String(item.average_preparation_time) })}>Edit</Button>
                    <Button icon={Trash2} variant="danger" onClick={() => removeItem(item)}>Delete</Button>
                  </div>
                </>
              )}
            </article>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function StockPage() {
  const pushToast = useToast();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ item_name: '', quantity_available: '', unit: '' });
  const [editing, setEditing] = useState(null);

  const load = async () => {
    const res = await api.get('/stock');
    if (!res.success) {
      pushToast('danger', res.message || 'Could not load stock.');
      return;
    }
    setItems(res.data || []);
  };

  useEffect(() => { load(); }, []);

  async function onCreate(event) {
    event.preventDefault();
    const res = await api.post('/stock', {
      item_name: form.item_name,
      quantity_available: Number(form.quantity_available),
      unit: form.unit
    });
    if (!res.success) {
      pushToast('danger', res.message || 'Could not add stock item.');
      return;
    }
    pushToast('success', 'Stock item added.');
    setForm({ item_name: '', quantity_available: '', unit: '' });
    load();
  }

  async function onUpdate(event) {
    event.preventDefault();
    const res = await api.put(`/stock/${editing.stock_id}`, {
      quantity_available: Number(editing.quantity_available),
      unit: editing.unit
    });
    if (!res.success) {
      pushToast('danger', res.message || 'Could not update stock.');
      return;
    }
    pushToast('success', 'Stock updated.');
    setEditing(null);
    load();
  }

  return (
    <div className="page-stack">
      <Panel title="Add stock item" subtitle="Track ingredient availability for the kitchen">
        <form className="grid-form" onSubmit={onCreate}>
          <div className="form-grid">
            <Input label="Item name" value={form.item_name} onChange={(e) => setForm((current) => ({ ...current, item_name: e.target.value }))} />
            <Input label="Quantity" type="number" step="0.01" value={form.quantity_available} onChange={(e) => setForm((current) => ({ ...current, quantity_available: e.target.value }))} />
            <Input label="Unit" value={form.unit} onChange={(e) => setForm((current) => ({ ...current, unit: e.target.value }))} />
          </div>
          <Button icon={Save} type="submit">Save stock item</Button>
        </form>
      </Panel>

      <Panel title="Stock list" subtitle="Low and out-of-stock items are surfaced automatically">
        <div className="card-grid">
          {items.map((item) => (
            <article key={item.stock_id} className="order-card">
              {editing?.stock_id === item.stock_id ? (
                <form className="stack" onSubmit={onUpdate}>
                  <Input label="Quantity" type="number" step="0.01" value={editing.quantity_available} onChange={(e) => setEditing((current) => ({ ...current, quantity_available: e.target.value }))} />
                  <Input label="Unit" value={editing.unit} onChange={(e) => setEditing((current) => ({ ...current, unit: e.target.value }))} />
                  <div className="card-actions">
                    <Button icon={Save} type="submit">Save</Button>
                    <Button icon={ArrowLeft} variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="order-head">
                    <strong>{item.item_name}</strong>
                    <span className={badgeClass(item.stock_status === 'unavailable' ? 'out_of_stock' : item.stock_status)}>{item.stock_status === 'unavailable' || item.stock_status === 'out_of_stock' ? 'out of stock' : item.stock_status.replace('_', ' ')}</span>
                  </div>
                  <div className="list-row"><span>Quantity</span><strong>{item.quantity_available}</strong></div>
                  <div className="list-row"><span>Unit</span><strong>{item.unit}</strong></div>
                  <div className="card-actions">
                    <Button icon={Edit3} variant="secondary" onClick={() => setEditing({ ...item, quantity_available: String(item.quantity_available) })}>Edit</Button>
                  </div>
                </>
              )}
            </article>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function QrPage() {
  const pushToast = useToast();
  const [tables, setTables] = useState([]);
  const [tableNumber, setTableNumber] = useState('');
  const [generated, setGenerated] = useState(null);

  const load = async () => {
    const res = await api.get('/qr/tables');
    if (!res.success) {
      pushToast('danger', res.message || 'Could not load tables.');
      return;
    }
    setTables(res.data || []);
  };

  useEffect(() => { load(); }, []);

  async function generate() {
    if (!tableNumber.trim()) {
      pushToast('danger', 'Enter a table number.');
      return;
    }
    const res = await api.post('/qr/generate', { table_number: tableNumber });
    if (!res.success) {
      pushToast('danger', res.message || 'Could not generate QR.');
      return;
    }
    setGenerated(res.data);
    pushToast('success', `QR generated for ${tableNumber}.`);
    load();
  }

  return (
    <div className="page-stack">
      <Panel title="Generate QR code" subtitle="Create or refresh table QR links">
        <div className="inline-form">
          <Input label="Table number" value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} placeholder="T1" />
          <Button icon={QrCode} onClick={generate}>Generate QR</Button>
        </div>
      </Panel>

      {generated ? (
        <Panel title={`QR for ${generated.table_number}`} subtitle="Use the code below for customer ordering">
          <div className="qr-preview">
            <img src={generated.qr_image} alt={`QR for table ${generated.table_number}`} />
            <div className="stack">
              <div className="summary-row"><span>Order URL</span><strong>{generated.order_url}</strong></div>
              <div className="summary-row"><span>Token</span><strong>{generated.qr_token}</strong></div>
            </div>
          </div>
        </Panel>
      ) : null}

      <Panel title="Registered tables" subtitle="Current active QR-enabled tables">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Table</th>
                <th>Token</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {tables.length === 0 ? (
                <tr><td colSpan="3" className="empty-row">No tables registered.</td></tr>
              ) : tables.map((table) => (
                <tr key={table.table_id}>
                  <td>{table.table_number}</td>
                  <td className="mono">{table.qr_token}</td>
                  <td>{table.is_active ? <span className="badge badge-success">active</span> : <span className="badge badge-danger">inactive</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function UsersPage() {
  const pushToast = useToast();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    role_id: '2'
  });

  const roles = [
    { role_id: '1', role_name: 'admin' },
    { role_id: '2', role_name: 'manager' },
    { role_id: '3', role_name: 'ceo' },
    { role_id: '4', role_name: 'staff' }
  ];

  const load = async () => {
    const res = await api.get('/users');
    if (!res.success) {
      pushToast('danger', res.message || 'Could not load users.');
      return;
    }
    setUsers(res.data || []);
  };

  useEffect(() => { load(); }, []);

  async function createUser(event) {
    event.preventDefault();
    const res = await api.post('/auth/register', {
      full_name: form.full_name,
      email: form.email,
      password: form.password,
      role_id: Number(form.role_id)
    });
    if (!res.success) {
      pushToast('danger', res.message || 'Could not create user.');
      return;
    }
    pushToast('success', 'User created.');
    setForm({ full_name: '', email: '', password: '', role_id: '2' });
    load();
  }

  return (
    <div className="page-stack">
      <Panel title="Create staff account" subtitle="Admin-only access for account management">
        <form className="grid-form" onSubmit={createUser}>
          <div className="form-grid">
            <Input label="Full name" value={form.full_name} onChange={(e) => setForm((current) => ({ ...current, full_name: e.target.value }))} />
            <Input label="Email" type="email" value={form.email} onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))} />
            <Input label="Password" type="password" value={form.password} onChange={(e) => setForm((current) => ({ ...current, password: e.target.value }))} />
            <Select label="Role" value={form.role_id} onChange={(e) => setForm((current) => ({ ...current, role_id: e.target.value }))}>
              {roles.map((role) => (
                <option key={role.role_id} value={role.role_id}>{role.role_name}</option>
              ))}
            </Select>
          </div>
          <Button icon={Users} type="submit">Create user</Button>
        </form>
      </Panel>

      <Panel title="User accounts" subtitle="Existing accounts in the system">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan="4" className="empty-row">No users found.</td></tr>
              ) : users.map((user) => (
                <tr key={user.user_id}>
                  <td>{user.full_name}</td>
                  <td>{user.email}</td>
                  <td><span className={badgeClass(user.role_name)}>{user.role_name}</span></td>
                  <td>{formatDate(user.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function StaffPage() {
  const pushToast = useToast();
  const [orders, setOrders] = useState([]);
  const [messages, setMessages] = useState([]);
  const [panel, setPanel] = useState('orders');
  const [expanded, setExpanded] = useState(null);

  const loadOrders = async () => {
    const res = await api.get('/orders');
    if (!res.success) {
      pushToast('danger', res.message || 'Failed to load orders.');
      return;
    }
    setOrders(res.data || []);
  };

  const loadMessages = async () => {
    const res = await api.get('/messages');
    if (!res.success) {
      pushToast('danger', res.message || 'Failed to load messages.');
      return;
    }
    setMessages(res.data || []);
  };

  useEffect(() => {
    loadOrders();
    const timer = window.setInterval(loadOrders, 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (panel === 'messages') loadMessages();
  }, [panel]);

  async function updateStatus(orderId, order_status) {
    const res = await api.put(`/orders/${orderId}/status`, { order_status });
    if (!res.success) {
      pushToast('danger', res.message || 'Could not update status.');
      return;
    }
    pushToast('success', `Order #${orderId} updated.`);
    loadOrders();
  }

  async function respond(messageId, response) {
    const res = await api.put(`/messages/${messageId}/respond`, { response });
    if (!res.success) {
      pushToast('danger', res.message || 'Could not send response.');
      return;
    }
    pushToast('success', 'Response sent.');
    loadMessages();
  }

  async function markRead(messageId) {
    await api.put(`/messages/${messageId}/read`, {});
  }

  const activeOrders = orders.filter((order) => order.order_status !== 'delivered' && order.order_status !== 'cancelled');

  return (
    <div className="page-stack">
      <div className="toolbar">
        <div className="segmented">
          <button type="button" className={classNames('segment', panel === 'orders' && 'active')} onClick={() => setPanel('orders')}>Orders</button>
          <button type="button" className={classNames('segment', panel === 'messages' && 'active')} onClick={() => setPanel('messages')}>Messages</button>
        </div>
        <Button icon={RefreshCw} variant="secondary" onClick={() => (panel === 'orders' ? loadOrders() : loadMessages())}>Refresh</Button>
      </div>

      {panel === 'orders' ? (
        <div className="card-grid">
          {activeOrders.map((order) => {
            const nextMap = { pending: 'preparing', preparing: 'ready', ready: 'delivered' };
            return (
              <article key={order.order_id} className="order-card">
                <div className="order-head">
                  <strong>Order #{order.order_id}</strong>
                  <span className={badgeClass(order.order_status)}>{order.order_status}</span>
                </div>
                <div className="list-row"><span>Table {order.table_number}</span><span>{formatNaira(order.total_amount)}</span></div>
                <div className="list-row"><span>Wait time</span><strong>{order.estimated_wait_time} min</strong></div>
                <div className="card-actions">
                  {nextMap[order.order_status] ? (
                    <Button icon={ChevronActionIcon(order.order_status)} onClick={() => updateStatus(order.order_id, nextMap[order.order_status])}>
                      {nextMap[order.order_status]}
                    </Button>
                  ) : null}
                  <Button icon={Eye} variant="secondary" onClick={() => setExpanded(expanded === order.order_id ? null : order.order_id)}>Items</Button>
                </div>
                {expanded === order.order_id ? (
                  <div className="mini-list">
                    {(order.items || []).map((item) => (
                      <div key={`${item.order_item_id}-${item.menu_item_id}`} className="list-row">
                        <span>{item.item_name} x{item.quantity}</span>
                        <strong>{formatNaira(item.subtotal)}</strong>
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="card-grid">
          {messages.map((message) => (
            <article key={message.message_id} className="order-card">
              <div className="order-head">
                <strong>Table {message.table_number}</strong>
                <span className={badgeClass(message.message_status)}>{message.message_status}</span>
              </div>
              <div className="list-row"><span>Order #{message.order_id}</span><span>{formatDate(message.created_at)}</span></div>
              <p className="message-copy">{message.message_content}</p>
              {message.response ? <div className="response-copy">Response: {message.response}</div> : null}
              {message.message_status !== 'responded' ? (
                <MessageReply onSend={(text) => respond(message.message_id, text)} onRead={() => markRead(message.message_id)} />
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function MessageReply({ onSend, onRead }) {
  const [text, setText] = useState('');
  return (
    <div className="stack">
      <Input label="Response" value={text} onChange={(e) => setText(e.target.value)} placeholder="Reply to the customer" />
      <div className="card-actions">
        <Button icon={Send} onClick={() => { onSend(text); onRead(); }}>Send response</Button>
      </div>
    </div>
  );
}

function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-head">
          <strong>{title}</strong>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close dialog"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default App;

