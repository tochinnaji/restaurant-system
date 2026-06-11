const db = require('../config/db');

const getPreparationTimeRecords = async (req, res) => {
  try {
    const [records] = await db.query(
      `SELECT p.record_id, p.menu_item_id, p.average_preparation_time, p.last_updated, m.item_name
       FROM preparation_time_records p
       JOIN menu_items m ON p.menu_item_id = m.menu_item_id
       ORDER BY p.last_updated DESC`
    );
    res.json({ success: true, data: records });
  } catch (err) {
    console.error('Prep time load error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { getPreparationTimeRecords };
