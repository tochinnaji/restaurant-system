const db = require('../config/db');
const { estimateWaitTime } = require('../utils/waitTime');

const isPositiveInteger = (value) => Number.isInteger(Number(value)) && Number(value) > 0;

const placeOrder = async (req, res) => {
  const { table_number, token, items } = req.body;
  // items = [{ menu_item_id, quantity }]

  if (!table_number || !token || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Valid table QR code and items are required.' });
  }

  const normalizedItems = items.map(item => ({
    menu_item_id: Number(item.menu_item_id),
    quantity: Number(item.quantity)
  }));

  if (normalizedItems.some(item => !isPositiveInteger(item.menu_item_id) || !isPositiveInteger(item.quantity))) {
    return res.status(400).json({ success: false, message: 'Each order item must have a valid item ID and quantity.' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [tables] = await conn.query(
      'SELECT table_id FROM restaurant_tables WHERE table_number = ? AND qr_token = ? AND is_active = TRUE',
      [table_number, token]
    );
    if (tables.length === 0) {
      await conn.rollback();
      return res.status(403).json({ success: false, message: 'Invalid or inactive table QR code.' });
    }

    // Validate and price items
    let totalAmount = 0;
    const enrichedItems = [];

    for (const item of normalizedItems) {
      const [rows] = await conn.query(
        'SELECT * FROM menu_items WHERE menu_item_id = ? AND availability_status = "available"',
        [item.menu_item_id]
      );
      if (rows.length === 0) {
        await conn.rollback();
        return res.status(400).json({
          success: false,
          message: `Item ID ${item.menu_item_id} is unavailable or does not exist.`
        });
      }
      const menuItem = rows[0];
      const subtotal = menuItem.price * item.quantity;
      totalAmount += subtotal;
      enrichedItems.push({ ...item, price: menuItem.price, subtotal });
    }

    // Estimate wait time
    const estimatedWaitTime = await estimateWaitTime(normalizedItems);

    // Create order
    const [orderResult] = await conn.query(
      `INSERT INTO orders (table_number, total_amount, estimated_wait_time) VALUES (?, ?, ?)`,
      [table_number, totalAmount, estimatedWaitTime]
    );
    const orderId = orderResult.insertId;

    // Insert order items
    for (const item of enrichedItems) {
      await conn.query(
        `INSERT INTO order_items (order_id, menu_item_id, quantity, price, subtotal) VALUES (?, ?, ?, ?, ?)`,
        [orderId, item.menu_item_id, item.quantity, item.price, item.subtotal]
      );
    }

    await conn.commit();

    res.status(201).json({
      success: true,
      message: 'Order placed successfully.',
      data: {
        order_id: orderId,
        table_number,
        total_amount: totalAmount,
        estimated_wait_time: estimatedWaitTime
      }
    });
  } catch (err) {
    await conn.rollback();
    console.error('Place order error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  } finally {
    conn.release();
  }
};

const getOrderById = async (req, res) => {
  const { id } = req.params;
  if (!isPositiveInteger(id)) {
    return res.status(400).json({ success: false, message: 'Invalid order ID.' });
  }
  try {
    const [orders] = await db.query('SELECT * FROM orders WHERE order_id = ?', [id]);
    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const [items] = await db.query(
      `SELECT oi.*, m.item_name FROM order_items oi
       JOIN menu_items m ON oi.menu_item_id = m.menu_item_id
       WHERE oi.order_id = ?`,
      [id]
    );

    res.json({ success: true, data: { ...orders[0], items } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getAllOrders = async (req, res) => {
  try {
    const [orders] = await db.query(
      'SELECT * FROM orders ORDER BY created_at DESC'
    );
    res.json({ success: true, data: orders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const updateOrderStatus = async (req, res) => {
  const { id } = req.params;
  const { order_status } = req.body;

  if (!isPositiveInteger(id)) {
    return res.status(400).json({ success: false, message: 'Invalid order ID.' });
  }

  const validStatuses = ['pending', 'preparing', 'ready', 'delivered', 'cancelled'];
  if (!validStatuses.includes(order_status)) {
    return res.status(400).json({ success: false, message: 'Invalid order status.' });
  }

  try {
    const [result] = await db.query('UPDATE orders SET order_status = ? WHERE order_id = ?', [order_status, id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }
    res.json({ success: true, message: `Order status updated to "${order_status}".` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getDashboardSummary = async (req, res) => {
  try {
    const [[{ totalOrders }]] = await db.query('SELECT COUNT(*) AS totalOrders FROM orders');
    const [[{ totalRevenue }]] = await db.query(
      'SELECT COALESCE(SUM(total_amount), 0) AS totalRevenue FROM orders WHERE payment_status = "paid"'
    );
    const [[{ pendingOrders }]] = await db.query(
      'SELECT COUNT(*) AS pendingOrders FROM orders WHERE order_status IN ("pending", "preparing")'
    );
    const [paymentSummaryRows] = await db.query(
      `SELECT payment_status, COUNT(*) AS total
       FROM orders
       GROUP BY payment_status`
    );
    const [recentOrders] = await db.query(
      'SELECT * FROM orders ORDER BY created_at DESC LIMIT 10'
    );
    const [lowStock] = await db.query(
      'SELECT * FROM stock_items WHERE stock_status IN ("low", "out_of_stock")'
    );
    const [prepTimeRecords] = await db.query(
      `SELECT p.record_id, p.menu_item_id, p.average_preparation_time, p.last_updated, m.item_name
       FROM preparation_time_records p
       JOIN menu_items m ON p.menu_item_id = m.menu_item_id
       ORDER BY p.last_updated DESC LIMIT 20`
    );

    const paymentSummary = paymentSummaryRows.reduce((acc, row) => {
      acc[row.payment_status] = row.total;
      return acc;
    }, { paid: 0, pending: 0, failed: 0, unpaid: 0 });

    res.json({
      success: true,
      data: {
        totalOrders,
        totalRevenue,
        accountBalance: totalRevenue,
        pendingOrders,
        recentOrders,
        lowStock,
        paymentSummary,
        prepTimeRecords
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { placeOrder, getOrderById, getAllOrders, updateOrderStatus, getDashboardSummary };
