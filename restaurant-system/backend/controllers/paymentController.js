const db = require('../config/db');
const https = require('https');
const { getPublicBaseUrl } = require('../utils/publicUrl');

const safeJsonParse = (data) => {
  try {
    return JSON.parse(data);
  } catch (err) {
    return null;
  }
};

const initializePayment = async (req, res) => {
  const { order_id, email } = req.body;

  if (!order_id || !email || !Number.isInteger(Number(order_id)) || Number(order_id) <= 0) {
    return res.status(400).json({ success: false, message: 'Order ID and email are required.' });
  }

  try {
    const [orders] = await db.query('SELECT * FROM orders WHERE order_id = ?', [order_id]);
    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const order = orders[0];
    if (order.payment_status === 'paid') {
      return res.status(400).json({ success: false, message: 'Order already paid.' });
    }

    const [tables] = await db.query(
      'SELECT qr_token FROM restaurant_tables WHERE table_number = ? AND is_active = TRUE ORDER BY table_id DESC LIMIT 1',
      [order.table_number]
    );
    const tableToken = tables.length > 0 ? tables[0].qr_token : null;

    const amountInKobo = Math.round(order.total_amount * 100); // Paystack uses kobo

    const params = JSON.stringify({
      email,
      amount: amountInKobo,
      metadata: { order_id, table_number: order.table_number, table_token: tableToken },
      callback_url: `${getPublicBaseUrl(req)}/api/payment/verify`
    });

    const options = {
      hostname: 'api.paystack.co',
      port: 443,
      path: '/transaction/initialize',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    const paystackReq = https.request(options, (paystackRes) => {
      let data = '';
      paystackRes.on('data', (chunk) => { data += chunk; });
      paystackRes.on('end', async () => {
        const response = safeJsonParse(data);
        if (!response) {
          return res.status(502).json({ success: false, message: 'Invalid response from payment gateway.' });
        }

        if (response.status) {
          // Save pending payment record
          await db.query(
            `INSERT INTO payments (order_id, payment_reference, amount, payment_status)
             VALUES (?, ?, ?, 'pending')
             ON DUPLICATE KEY UPDATE
               payment_reference = VALUES(payment_reference),
               amount = VALUES(amount),
               payment_status = 'pending',
               payment_method = NULL,
               paid_at = NULL`,
            [order_id, response.data.reference, order.total_amount]
          );
          await db.query(
            'UPDATE orders SET payment_status = "pending" WHERE order_id = ?',
            [order_id]
          );
          res.json({ success: true, data: response.data });
        } else {
          res.status(400).json({ success: false, message: 'Paystack initialization failed.', error: response.message });
        }
      });
    });

    paystackReq.on('error', (err) => {
      console.error('Paystack error:', err);
      res.status(500).json({ success: false, message: 'Payment gateway error.' });
    });

    paystackReq.write(params);
    paystackReq.end();
  } catch (err) {
    console.error('Init payment error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const verifyPayment = async (req, res) => {
  const { reference } = req.query;

  if (!reference) {
    return res.status(400).json({ success: false, message: 'Payment reference is required.' });
  }

  const options = {
    hostname: 'api.paystack.co',
    port: 443,
    path: `/transaction/verify/${reference}`,
    method: 'GET',
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
    }
  };

  const paystackReq = https.request(options, (paystackRes) => {
      let data = '';
      paystackRes.on('data', (chunk) => { data += chunk; });
      paystackRes.on('end', async () => {
        try {
          const response = safeJsonParse(data);
          if (!response) {
            return res.redirect('/frontend/customer/payment-failed');
          }

          if (response.status && response.data.status === 'success') {
          const { reference: ref, paid_at, channel, metadata } = response.data;
          const orderId = metadata?.order_id;
          const tableNumber = metadata?.table_number;
          const tableToken = metadata?.table_token;

          await db.query(
            `UPDATE payments SET payment_status='successful', payment_method=?, paid_at=?
             WHERE payment_reference=?`,
            [channel, new Date(paid_at), ref]
          );

          if (orderId) {
            await db.query(
              'UPDATE orders SET payment_status="paid" WHERE order_id=?',
              [orderId]
            );
          }

          // Redirect to confirmation page
          const query = new URLSearchParams();
          if (orderId) query.set('order_id', orderId);
          if (tableNumber) query.set('table', tableNumber);
          if (tableToken) query.set('token', tableToken);
          res.redirect(`/frontend/customer/payment-success?${query.toString()}`);
          } else {
            res.redirect('/frontend/customer/payment-failed');
          }
      } catch (err) {
        console.error('Verify payment processing error:', err);
        res.status(500).json({ success: false, message: 'Error processing verification.' });
      }
    });
  });

  paystackReq.on('error', (err) => {
    console.error('Paystack verify error:', err);
    res.status(500).json({ success: false, message: 'Payment gateway error.' });
  });

  paystackReq.end();
};

module.exports = { initializePayment, verifyPayment };
