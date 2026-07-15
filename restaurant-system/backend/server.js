require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const db = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;
const frontendRoot = path.join(__dirname, '../frontend');
const frontendDist = path.join(frontendRoot, 'dist');
const frontendStaticRoot = fs.existsSync(frontendDist) ? frontendDist : frontendRoot;
const serveFrontend = process.env.SERVE_FRONTEND === 'true';

app.disable('x-powered-by');
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

if (serveFrontend) {
  app.use('/frontend', express.static(frontendStaticRoot));
}
app.use('/api', require('./routes/index'));

app.get('/', (req, res) => {
  if (serveFrontend) {
    return res.redirect('/frontend/customer');
  }
  return res.json({ success: true, message: 'IRMS backend is running.' });
});

app.get('/health', (req, res) => {
  res.json({ success: true, status: 'ok' });
});

if (serveFrontend) {
  app.get('/frontend/*', (req, res) => {
    if (frontendStaticRoot === frontendDist && fs.existsSync(path.join(frontendDist, 'index.html'))) {
      return res.sendFile(path.join(frontendDist, 'index.html'));
    }
    return res.redirect('/frontend/customer');
  });
}

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Invalid JSON payload.' });
  }
  return next(err);
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

const seedPreparationTimeRecords = async () => {
  await db.query('DELETE FROM preparation_time_records');
  await db.query(
    `INSERT INTO preparation_time_records (menu_item_id, average_preparation_time)
     SELECT menu_item_id, average_preparation_time FROM menu_items`
  );
};

const seedUsers = async () => {
  const passwordHash = '$2a$10$pvTJ/FW9KX4KrJ5ADXVrReY9enDAkax3ZDOT.u785UQzpg6jPomde';
  await db.query(
    `INSERT IGNORE INTO users (full_name, email, password, role_id) VALUES
     ('System Admin', 'admin@restaurant.com', ?, 1),
     ('Restaurant Manager', 'manager@restaurant.com', ?, 2),
     ('Company CEO', 'ceo@restaurant.com', ?, 3),
     ('Kitchen Staff', 'staff@restaurant.com', ?, 4)` ,
    [passwordHash, passwordHash, passwordHash, passwordHash]
  );
};

const startServer = async () => {
  try {
    await seedUsers();
    await seedPreparationTimeRecords();
  } catch (err) {
    console.error('Startup seed skipped:', err.message);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Restaurant Management System running at http://localhost:${PORT}`);
    console.log(`API available at http://localhost:${PORT}/api`);
  });
};

startServer();
