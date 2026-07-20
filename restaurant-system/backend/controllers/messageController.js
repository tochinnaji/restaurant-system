const db = require('../config/db');

const isPositiveInteger = (value) => Number.isInteger(Number(value)) && Number(value) > 0;

const sendMessage = async (req, res) => {
  const { order_id, table_number, message_content } = req.body;

  if (!isPositiveInteger(order_id) || !table_number || !message_content || !message_content.trim()) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }

  try {
    const [orders] = await db.query('SELECT order_id FROM orders WHERE order_id = ? AND table_number = ?', [order_id, table_number]);
    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found for this table.' });
    }

    const [result] = await db.query(
      'INSERT INTO messages (order_id, table_number, message_content) VALUES (?, ?, ?)',
      [order_id, table_number, message_content.trim()]
    );
    res.status(201).json({ success: true, message: 'Message sent.', message_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getAllMessages = async (req, res) => {
  try {
    const [messages] = await db.query(
      'SELECT * FROM messages ORDER BY created_at DESC'
    );
    res.json({ success: true, data: messages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};


const getOrderMessages = async (req, res) => {
  const { orderId } = req.params;
  const { table_number } = req.query;

  if (!isPositiveInteger(orderId) || !table_number) {
    return res.status(400).json({ success: false, message: 'Order ID and table number are required.' });
  }

  try {
    const [orders] = await db.query('SELECT order_id FROM orders WHERE order_id = ? AND table_number = ?', [orderId, table_number]);
    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found for this table.' });
    }

    const [messages] = await db.query(
      `SELECT message_id, message_content, response, message_status, created_at
       FROM messages
       WHERE order_id = ? AND table_number = ?
       ORDER BY created_at DESC`,
      [orderId, table_number]
    );
    res.json({ success: true, data: messages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
const respondToMessage = async (req, res) => {
  const { id } = req.params;
  const { response } = req.body;

  if (!isPositiveInteger(id) || !response || !response.trim()) {
    return res.status(400).json({ success: false, message: 'Valid message ID and response are required.' });
  }

  try {
    const [result] = await db.query(
      'UPDATE messages SET response = ?, message_status = "responded" WHERE message_id = ?',
      [response.trim(), id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Message not found.' });
    }
    res.json({ success: true, message: 'Response sent.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const markMessageRead = async (req, res) => {
  const { id } = req.params;
  if (!isPositiveInteger(id)) {
    return res.status(400).json({ success: false, message: 'Invalid message ID.' });
  }

  try {
    const [result] = await db.query('UPDATE messages SET message_status = "read" WHERE message_id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Message not found.' });
    }
    res.json({ success: true, message: 'Message marked as read.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { sendMessage, getAllMessages, getOrderMessages, respondToMessage, markMessageRead };
