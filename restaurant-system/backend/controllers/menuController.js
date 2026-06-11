const db = require('../config/db');

const isPositiveInteger = (value) => Number.isInteger(Number(value)) && Number(value) > 0;
const isPositiveNumber = (value) => Number.isFinite(Number(value)) && Number(value) > 0;

const syncPreparationTimeRecord = async (conn, menuItemId, averagePreparationTime) => {
  await conn.query('DELETE FROM preparation_time_records WHERE menu_item_id = ?', [menuItemId]);
  await conn.query(
    'INSERT INTO preparation_time_records (menu_item_id, average_preparation_time) VALUES (?, ?)',
    [menuItemId, averagePreparationTime]
  );
};

const getAllMenuItems = async (req, res) => {
  try {
    const [items] = await db.query(
      `SELECT m.*, c.category_name 
       FROM menu_items m 
       JOIN categories c ON m.category_id = c.category_id
       ORDER BY c.category_name, m.item_name`
    );
    res.json({ success: true, data: items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getMenuByCategory = async (req, res) => {
  try {
    const [categories] = await db.query('SELECT * FROM categories');
    const [items] = await db.query(
      `SELECT m.*, c.category_name 
       FROM menu_items m 
       JOIN categories c ON m.category_id = c.category_id
       WHERE m.availability_status = 'available'
       ORDER BY c.category_id, m.item_name`
    );

    // Group items by category
    const grouped = categories.map(cat => ({
      ...cat,
      items: items.filter(item => item.category_id === cat.category_id)
    }));

    res.json({ success: true, data: grouped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const addMenuItem = async (req, res) => {
  const { category_id, item_name, description, price, average_preparation_time, image_url } = req.body;
  if (!isPositiveInteger(category_id) || !item_name || !isPositiveNumber(price) || !isPositiveInteger(average_preparation_time)) {
    return res.status(400).json({ success: false, message: 'Valid category, item name, price, and prep time are required.' });
  }

  try {
    const [categories] = await db.query('SELECT category_id FROM categories WHERE category_id = ?', [category_id]);
    if (categories.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid category.' });
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [result] = await conn.query(
        `INSERT INTO menu_items (category_id, item_name, description, price, average_preparation_time, image_url)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [Number(category_id), item_name.trim(), description || null, Number(price), Number(average_preparation_time), image_url || null]
      );
      await syncPreparationTimeRecord(conn, result.insertId, Number(average_preparation_time));
      await conn.commit();
      res.status(201).json({ success: true, message: 'Menu item added.', menu_item_id: result.insertId });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const updateMenuItem = async (req, res) => {
  const { id } = req.params;
  const { item_name, description, price, average_preparation_time, availability_status } = req.body;
  const validStatuses = ['available', 'out_of_stock'];

  if (!isPositiveInteger(id) || !item_name || !isPositiveNumber(price) || !isPositiveInteger(average_preparation_time) || !validStatuses.includes(availability_status)) {
    return res.status(400).json({ success: false, message: 'Valid item name, price, prep time, and availability status are required.' });
  }

  try {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [result] = await conn.query(
        `UPDATE menu_items SET item_name=?, description=?, price=?, average_preparation_time=?, availability_status=?
         WHERE menu_item_id=?`,
        [item_name.trim(), description || null, Number(price), Number(average_preparation_time), availability_status, id]
      );
      if (result.affectedRows === 0) {
        await conn.rollback();
        return res.status(404).json({ success: false, message: 'Menu item not found.' });
      }
      await syncPreparationTimeRecord(conn, Number(id), Number(average_preparation_time));
      await conn.commit();
      res.json({ success: true, message: 'Menu item updated.' });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const deleteMenuItem = async (req, res) => {
  const { id } = req.params;
  if (!isPositiveInteger(id)) {
    return res.status(400).json({ success: false, message: 'Invalid menu item ID.' });
  }

  try {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM preparation_time_records WHERE menu_item_id = ?', [id]);
      const [result] = await conn.query('DELETE FROM menu_items WHERE menu_item_id = ?', [id]);
      if (result.affectedRows === 0) {
        await conn.rollback();
        return res.status(404).json({ success: false, message: 'Menu item not found.' });
      }
      await conn.commit();
      res.json({ success: true, message: 'Menu item deleted.' });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { getAllMenuItems, getMenuByCategory, addMenuItem, updateMenuItem, deleteMenuItem };
