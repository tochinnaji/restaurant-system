const db = require('../config/db');
const https = require('https');
const { getBackendPublicUrl, getFrontendPublicUrl } = require('../utils/publicUrl');

const safeJsonParse = (data) => {
  try {
    return JSON.parse(data);
  } catch (err) {
    return null;
  }
};

const initializePayment = async (req, res) => {
  const { order_id, email } = req.body;
  const paystackSecretKey = String(process.env.PAYSTACK_SECRET_KEY || '').trim();

  if (!paystackSecretKey || paystackSecretKey.includes('your_paystack_secret_key')) {
    return res.status(500).json({ success: false, message: 'Paystack secret key is not configured on the server.' });
  }


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
      callback_url: `${getBackendPublicUrl(req)}/api/payment/verify`
    });

    const options = {
      hostname: 'api.paystack.co',
      port: 443,
      path: '/transaction/initialize',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
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
          const gatewayMessage = response.message || response.error || 'Payment provider rejected this transaction.';
          console.error('Paystack initialization failed:', {
            statusCode: paystackRes.statusCode,
            message: gatewayMessage,
            callback_url: `${getBackendPublicUrl(req)}/api/payment/verify`
          });
          res.status(400).json({ success: false, message: gatewayMessage, error: gatewayMessage });
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
  const paystackSecretKey = String(process.env.PAYSTACK_SECRET_KEY || '').trim();
  const frontendUrl = getFrontendPublicUrl(req);

  if (!reference) {
    return res.redirect(`${frontendUrl}/customer/payment-failed`);
  }

  const options = {
    hostname: 'api.paystack.co',
    port: 443,
    path: `/transaction/verify/${encodeURIComponent(reference)}`,
    method: 'GET',
    headers: {
      Authorization: `Bearer ${paystackSecretKey}`
    }
  };

  const paystackReq = https.request(options, (paystackRes) => {
    let data = '';
    paystackRes.on('data', (chunk) => { data += chunk; });
    paystackRes.on('end', async () => {
      try {
        const response = safeJsonParse(data);
        if (!response || !response.status || response.data?.status !== 'success') {
          return res.redirect(`${frontendUrl}/customer/payment-failed`);
        }

        const { reference: ref, paid_at, channel, metadata = {} } = response.data;
        const [paymentRows] = await db.query('SELECT order_id FROM payments WHERE payment_reference = ? LIMIT 1', [ref]);
        const orderId = metadata.order_id || paymentRows[0]?.order_id;

        if (!orderId) {
          console.error('Payment verified but order could not be resolved:', { reference: ref, metadata });
          return res.redirect(`${frontendUrl}/customer/payment-failed`);
        }

        const [orderRows] = await db.query('SELECT table_number FROM orders WHERE order_id = ? LIMIT 1', [orderId]);
        const tableNumber = metadata.table_number || orderRows[0]?.table_number;
        let tableToken = metadata.table_token;

        if (!tableToken && tableNumber) {
          const [tables] = await db.query(
            'SELECT qr_token FROM restaurant_tables WHERE table_number = ? AND is_active = TRUE ORDER BY table_id DESC LIMIT 1',
            [tableNumber]
          );
          tableToken = tables[0]?.qr_token;
        }

        await db.query(
          `UPDATE payments
           SET payment_status = 'successful', payment_method = ?, paid_at = ?
           WHERE payment_reference = ?`,
          [channel || null, paid_at ? new Date(paid_at) : new Date(), ref]
        );

        await db.query('UPDATE orders SET payment_status = "paid" WHERE order_id = ?', [orderId]);

        const query = new URLSearchParams();
        query.set('order_id', orderId);
        if (tableNumber) query.set('table', tableNumber);
        if (tableToken) query.set('token', tableToken);
        return res.redirect(`${frontendUrl}/customer/payment-success?${query.toString()}`);
      } catch (err) {
        console.error('Verify payment processing error:', err);
        return res.redirect(`${frontendUrl}/customer/payment-failed`);
      }
    });
  });

  paystackReq.on('error', (err) => {
    console.error('Paystack verify error:', err);
    return res.redirect(`${frontendUrl}/customer/payment-failed`);
  });

  paystackReq.end();
};


const reversePayment = async (req, res) => {
  const { order_id } = req.body;

  if (!order_id || !Number.isInteger(Number(order_id)) || Number(order_id) <= 0) {
    return res.status(400).json({ success: false, message: 'Order ID is required.' });
  }

  try {
    const [orders] = await db.query('SELECT * FROM orders WHERE order_id = ?', [order_id]);
    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const [payments] = await db.query('SELECT * FROM payments WHERE order_id = ? ORDER BY payment_id DESC LIMIT 1', [order_id]);
    if (payments.length === 0) {
      return res.status(404).json({ success: false, message: 'Payment record not found.' });
    }

    await db.query(
      `UPDATE payments
       SET payment_status = 'failed', payment_method = NULL, paid_at = NULL
       WHERE order_id = ?`,
      [order_id]
    );

    await db.query('UPDATE orders SET payment_status = "unpaid" WHERE order_id = ?', [order_id]);

    res.json({ success: true, message: 'Payment reversed.' });
  } catch (err) {
    console.error('Reverse payment error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
module.exports = { initializePayment, verifyPayment, reversePayment };
