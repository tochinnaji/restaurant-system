const db = require('../config/db');

/**
 * Estimates wait time for a new order.
 * Formula: Estimated Wait Time = Number of Pending Orders x Average Meal Preparation Time.
 */
const estimateWaitTime = async (orderItems) => {
  try {
    const [pendingOrders] = await db.query(
      `SELECT COUNT(*) AS count FROM orders WHERE order_status IN ('pending', 'preparing')`
    );
    const pendingCount = pendingOrders[0].count;

    let totalPrepTime = 0;
    let itemCount = 0;

    for (const item of orderItems) {
      const [rows] = await db.query(
        `SELECT COALESCE(p.average_preparation_time, m.average_preparation_time) AS average_preparation_time
         FROM menu_items m
         LEFT JOIN preparation_time_records p ON p.menu_item_id = m.menu_item_id
         WHERE m.menu_item_id = ?`,
        [item.menu_item_id]
      );
      if (rows.length > 0) {
        totalPrepTime += rows[0].average_preparation_time;
        itemCount++;
      }
    }

    const avgPrepTime = itemCount > 0 ? totalPrepTime / itemCount : 10;
    return Math.ceil((pendingCount + 1) * avgPrepTime);
  } catch (err) {
    console.error('Wait time estimation error:', err);
    return 15;
  }
};

module.exports = { estimateWaitTime };
