const db = require('../config/db');

/**
 * Estimates wait time for a new order from the ordered items themselves.
 * Customer-facing time should reflect the food prep duration, not multiply by
 * every pending kitchen order, otherwise a 5-minute snack can appear as 40 mins.
 */
const estimateWaitTime = async (orderItems) => {
  try {
    let totalPrepTime = 0;

    for (const item of orderItems) {
      const [rows] = await db.query(
        `SELECT COALESCE(p.average_preparation_time, m.average_preparation_time) AS average_preparation_time
         FROM menu_items m
         LEFT JOIN preparation_time_records p ON p.menu_item_id = m.menu_item_id
         WHERE m.menu_item_id = ?`,
        [item.menu_item_id]
      );
      if (rows.length > 0) {
        totalPrepTime += Number(rows[0].average_preparation_time) * Number(item.quantity || 1);
      }
    }

    return Math.max(Math.ceil(totalPrepTime), 1);
  } catch (err) {
    console.error('Wait time estimation error:', err);
    return 15;
  }
};

module.exports = { estimateWaitTime };
