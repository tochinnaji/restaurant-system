const db = require('../config/db');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const { getFrontendPublicUrl } = require('../utils/publicUrl');

const generateTableQR = async (req, res) => {
  const { table_number } = req.body;

  if (!table_number || !String(table_number).trim()) {
    return res.status(400).json({ success: false, message: 'Table number is required.' });
  }

  try {
    const normalizedTableNumber = String(table_number).trim();
    const qrToken = uuidv4();
    const baseUrl = getFrontendPublicUrl(req);
    const frontendBasePath = (process.env.FRONTEND_APP_BASE_PATH || process.env.VITE_APP_BASE_PATH || '').replace(/\/+$/, '');
    const orderUrl = `${baseUrl}${frontendBasePath}/scan/${encodeURIComponent(normalizedTableNumber)}/${encodeURIComponent(qrToken)}`;

    // Save to DB
    await db.query(
      `INSERT INTO restaurant_tables (table_number, qr_token) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE qr_token = VALUES(qr_token)`,
      [normalizedTableNumber, qrToken]
    );

    // Generate QR as base64 image
    const qrDataUrl = await QRCode.toDataURL(orderUrl, { width: 300, margin: 2 });

    res.json({
      success: true,
      data: {
        table_number: normalizedTableNumber,
        qr_token: qrToken,
        order_url: orderUrl,
        qr_image: qrDataUrl // base64 PNG
      }
    });
  } catch (err) {
    console.error('QR generation error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getAllTables = async (req, res) => {
  try {
    const [tables] = await db.query('SELECT * FROM restaurant_tables');
    res.json({ success: true, data: tables });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { generateTableQR, getAllTables };
