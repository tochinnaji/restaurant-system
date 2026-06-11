const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isPositiveInteger = (value) => Number.isInteger(Number(value)) && Number(value) > 0;

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password || !isValidEmail(email)) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  try {
    const [users] = await db.query(
      `SELECT u.*, r.role_name FROM users u 
       JOIN roles r ON u.role_id = r.role_id 
       WHERE u.email = ?`,
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { user_id: user.user_id, email: user.email, role: user.role_name },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        user_id: user.user_id,
        full_name: user.full_name,
        email: user.email,
        role: user.role_name
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const register = async (req, res) => {
  const { full_name, email, password, role_id } = req.body;

  if (!full_name || !email || !password || !role_id || !isValidEmail(email) || !isPositiveInteger(role_id)) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
  }

  try {
    const [roles] = await db.query('SELECT role_id FROM roles WHERE role_id = ?', [role_id]);
    if (roles.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid role.' });
    }

    const [existing] = await db.query('SELECT user_id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Email already in use.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query(
      'INSERT INTO users (full_name, email, password, role_id) VALUES (?, ?, ?, ?)',
      [full_name, email, hashedPassword, role_id]
    );

    res.status(201).json({ success: true, message: 'User created successfully.' });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const [users] = await db.query(
      `SELECT u.user_id, u.full_name, u.email, u.created_at, r.role_name
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       ORDER BY u.created_at DESC`
    );
    res.json({ success: true, data: users });
  } catch (err) {
    console.error('Users load error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { login, register, getAllUsers };
