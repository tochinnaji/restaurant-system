const db = require('../config/db');

const isNonNegativeNumber = (value) => Number.isFinite(Number(value)) && Number(value) >= 0;
const isPositiveInteger = (value) => Number.isInteger(Number(value)) && Number(value) > 0;

const getAllStock = async (req, res) => {
  try {
    const [stock] = await db.query('SELECT * FROM stock_items ORDER BY item_name');
    res.json({ success: true, data: stock });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const addStockItem = async (req, res) => {
  const { item_name, quantity_available, unit } = req.body;
  if (!item_name || !isNonNegativeNumber(quantity_available) || !unit) {
    return res.status(400).json({ success: false, message: 'Valid item name, quantity, and unit are required.' });
  }

  try {
    const quantity = Number(quantity_available);
    const status = quantity <= 0 ? 'out_of_stock' : quantity <= 5 ? 'low' : 'available';
    const [result] = await db.query(
      'INSERT INTO stock_items (item_name, quantity_available, unit, stock_status) VALUES (?, ?, ?, ?)',
      [item_name.trim(), quantity, unit.trim(), status]
    );
    res.status(201).json({ success: true, message: 'Stock item added.', stock_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const updateStock = async (req, res) => {
  const { id } = req.params;
  const { quantity_available, unit } = req.body;

  if (!isPositiveInteger(id) || !isNonNegativeNumber(quantity_available) || !unit) {
    return res.status(400).json({ success: false, message: 'Valid stock ID, quantity, and unit are required.' });
  }

  try {
    const quantity = Number(quantity_available);
    const status = quantity <= 0 ? 'out_of_stock' : quantity <= 5 ? 'low' : 'available';
    const [result] = await db.query(
      'UPDATE stock_items SET quantity_available = ?, unit = ?, stock_status = ? WHERE stock_id = ?',
      [quantity, unit.trim(), status, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Stock item not found.' });
    }
    res.json({ success: true, message: 'Stock updated.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { getAllStock, addStockItem, updateStock };
