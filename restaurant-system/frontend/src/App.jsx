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
  SunMedium
} from 'lucide-react';
import { api } from './lib/api';
import { badgeClass, classNames, formatDate, formatNaira } from './lib/format';
import { clearSession, getSessionUser, requiresRole, setSession } from './lib/session';

const APP_NAME = 'IRMS';
const BRAND_ICON = `${import.meta.env.BASE_URL}brand/irms-sidebar-icon.png`;
const BRAND_LOGO = `${import.meta.env.BASE_URL}brand/irms-selected-logo-source.png`;
const APP_BASE_PATH = (import.meta.env.VITE_APP_BASE_PATH || '/frontend').replace(/\/+$/, '') || '/';

function appPath(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return APP_BASE_PATH === '/' ? normalizedPath : `${APP_BASE_PATH}${normalizedPath}`;
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
    <button type="button" className="btn btn-secondary theme-fab" onClick={theme.toggleTheme}>
      {isDark ? <SunMedium size={16} /> : <MoonStar size={16} />}
      <span>{isDark ? 'Light mode' : 'Dark mode'}</span>
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
  const tableNumber = searchParams.get('table') || 'T1';
  const qrToken = searchParams.get('token') || '';
  const [menu, setMenu] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [cart, setCart] = useState([]);
  const [activeOrderId, setActiveOrderId] = useState(searchParams.get('order_id'));
  const [activeOrder, setActiveOrder] = useState(null);
  const [showCart, setShowCart] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showTracking, setShowTracking] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [paymentEmail, setPaymentEmail] = useState('');
  const [loadingOrder, setLoadingOrder] = useState(false);

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
    if (!activeOrderId) return;
    const load = async () => {
      const res = await api.get(`/orders/${activeOrderId}`);
      if (res.success) {
        setActiveOrder(res.data);
      }
    };
    load();
    const timer = window.setInterval(load, 15000);
    return () => window.clearInterval(timer);
  }, [activeOrderId]);

  const currentItems = useMemo(() => menu.find((cat) => cat.category_id === activeCategory)?.items || [], [menu, activeCategory]);
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const tableHint = qrToken ? `Table ${tableNumber}` : `Table ${tableNumber} - scan a valid QR link`;

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

  async function placeOrder() {
    if (!qrToken) {
      pushToast('danger', 'Scan a valid table QR code before placing an order.');
      return;
    }
    if (cart.length === 0) {
      pushToast('danger', 'Add at least one menu item first.');
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
        pushToast('danger', res.message || 'Could not place order.');
        return;
      }
      setActiveOrderId(String(res.data.order_id));
      setActiveOrder({ ...res.data, order_status: 'pending', payment_status: 'unpaid', items: cart });
      setCart([]);
      setShowCart(false);
      setShowPayment(true);
      pushToast('success', `Order #${res.data.order_id} placed. Estimated wait ${res.data.estimated_wait_time} min.`);
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
      setMessageText('');
      setShowMessage(false);
    } else {
      pushToast('danger', res.message || 'Message failed.');
    }
  }

  async function initializePayment() {
    if (!activeOrderId) {
      pushToast('danger', 'Place an order first.');
      return;
    }
    if (!paymentEmail.includes('@')) {
      pushToast('danger', 'Enter a valid email address.');
      return;
    }
    const res = await api.post('/payment/initialize', { order_id: activeOrderId, email: paymentEmail });
    if (res.success && res.data?.authorization_url) {
      window.location.href = res.data.authorization_url;
      return;
    }
    pushToast('danger', res.message || 'Payment could not be started.');
  }

  const activeOrderStatus = activeOrder?.order_status || 'pending';

  return (
    <div className="customer-page">
      <header className="customer-topbar">
        <div>
          <div className="eyebrow">Customer ordering</div>
          <h1>{APP_NAME}</h1>
          <p>{tableHint}</p>
        </div>
        <div className="customer-actions">
          <button type="button" className="btn btn-secondary customer-message-btn" onClick={() => setShowMessage(true)}>
            <MessageSquareText size={16} />
            <span>Message kitchen</span>
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => window.location.reload()}>
            <RefreshCw size={16} />
            <span>Refresh</span>
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setShowCart(true)}>
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
        <section className="notice notice-info">
          <div>
            <strong>Active order #{activeOrderId}</strong>
            <div>Wait time: {activeOrder?.estimated_wait_time ?? 'Pending'} min</div>
          </div>
          <div className="notice-actions">
            <span className={badgeClass(activeOrderStatus)}>{activeOrderStatus}</span>
            <button type="button" className="btn btn-secondary" onClick={() => setShowTracking(true)}>
              <Eye size={16} />
              <span>Track order</span>
            </button>
          </div>
        </section>
      ) : null}

      <section className="category-strip">
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
          <Button icon={Send} onClick={placeOrder} disabled={loadingOrder || cart.length === 0}>
            {loadingOrder ? 'Placing order...' : 'Place order'}
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
          <Button icon={Wallet} onClick={initializePayment}>Start payment</Button>
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
              <span>Estimated wait</span>
              <strong>{activeOrder.estimated_wait_time} min</strong>
            </div>
            <div className="summary-row">
              <span>Total</span>
              <strong>{formatNaira(activeOrder.total_amount)}</strong>
            </div>
            <div className="divider" />
            {(activeOrder.items || []).map((item) => (
              <div key={`${item.menu_item_id}-${item.quantity}`} className="summary-row">
                <span>{item.item_name} x{item.quantity}</span>
                <strong>{formatNaira(item.subtotal)}</strong>
              </div>
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
  const table = searchParams.get('table');
  const token = searchParams.get('token');

  return (
    <div className="status-page success">
      <div className="status-card">
        <div className="status-icon success"><Sparkles size={24} /></div>
        <h1>Payment confirmed</h1>
        <p>Your restaurant order has been paid successfully.</p>
        <div className="stack">
          <div className="summary-row"><span>Order</span><strong>#{orderId || '-'}</strong></div>
          <div className="summary-row"><span>Table</span><strong>{table || '-'}</strong></div>
        </div>
        <div className="page-actions">
          <a className="btn btn-primary" href={appPath(`/customer?table=${encodeURIComponent(table || 'T1')}&token=${encodeURIComponent(token || '')}`)}>
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
                  <span className={badgeClass(item.stock_status)}>{item.stock_status.replace('_', ' ')}</span>
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

  const load = async () => {
    const [menuRes, publicRes] = await Promise.all([api.get('/menu/all'), api.get('/menu')]);
    if (!menuRes.success || !publicRes.success) {
      pushToast('danger', 'Failed to load menu data.');
      return;
    }
    setGroups(publicRes.data || []);
    if (!form.category_id && (publicRes.data || [])[0]?.category_id) {
      setForm((current) => ({ ...current, category_id: String((publicRes.data || [])[0].category_id) }));
    }
  };

  useEffect(() => { load(); }, []);

  const flatItems = useMemo(() => groups.flatMap((category) => category.items.map((item) => ({ ...item, category_name: category.category_name }))), [groups]);

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
      availability_status: editing.availability_status
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
                  <Textarea label="Description" rows={3} value={editing.description || ''} onChange={(e) => setEditing((current) => ({ ...current, description: e.target.value }))} />
                  <div className="card-actions">
                    <Button icon={Save} type="submit">Save</Button>
                    <Button icon={ArrowLeft} variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="order-head">
                    <strong>{item.item_name}</strong>
                    <span className={badgeClass(item.availability_status)}>{item.availability_status}</span>
                  </div>
                  <div className="list-row"><span>Category</span><strong>{item.category_name}</strong></div>
                  <div className="list-row"><span>Price</span><strong>{formatNaira(item.price)}</strong></div>
                  <div className="list-row"><span>Prep time</span><strong>{item.average_preparation_time} min</strong></div>
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
                    <span className={badgeClass(item.stock_status)}>{item.stock_status.replace('_', ' ')}</span>
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
          <button type="button" className="icon-btn" onClick={onClose}>ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¾ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default App;
