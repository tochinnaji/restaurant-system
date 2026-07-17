-- ============================================================
-- INTELLIGENT RESTAURANT MANAGEMENT SYSTEM
-- Database Schema (MySQL)
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS preparation_time_records;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS restaurant_tables;
DROP TABLE IF EXISTS stock_items;
DROP TABLE IF EXISTS menu_items;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS roles;

SET FOREIGN_KEY_CHECKS = 1;

-- Roles
CREATE TABLE IF NOT EXISTS roles (
  role_id INT AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(50) NOT NULL UNIQUE
);

INSERT INTO roles (role_name) VALUES
('admin'),
('manager'),
('ceo'),
('staff');

-- Users
CREATE TABLE IF NOT EXISTS users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(role_id)
);

-- Categories
CREATE TABLE IF NOT EXISTS categories (
  category_id INT AUTO_INCREMENT PRIMARY KEY,
  category_name VARCHAR(100) NOT NULL UNIQUE
);

INSERT INTO categories (category_name) VALUES
('Main Course'),
('Drinks'),
('Desserts'),
('Snacks');

-- Menu Items
CREATE TABLE IF NOT EXISTS menu_items (
  menu_item_id INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT NOT NULL,
  item_name VARCHAR(100) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  average_preparation_time INT NOT NULL COMMENT 'in minutes',
  availability_status ENUM('available','out_of_stock') DEFAULT 'available',
  image_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(category_id)
);

-- Tables (restaurant tables with QR codes)
CREATE TABLE IF NOT EXISTS restaurant_tables (
  table_id INT AUTO_INCREMENT PRIMARY KEY,
  table_number VARCHAR(20) UNIQUE NOT NULL,
  qr_token VARCHAR(100) UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  order_id INT AUTO_INCREMENT PRIMARY KEY,
  table_number VARCHAR(20) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  estimated_wait_time INT COMMENT 'in minutes',
  order_status ENUM('pending','preparing','ready','delivered','cancelled') DEFAULT 'pending',
  payment_status ENUM('unpaid','pending','paid','failed') DEFAULT 'unpaid',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Order Items
CREATE TABLE IF NOT EXISTS order_items (
  order_item_id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  menu_item_id INT NOT NULL,
  quantity INT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(menu_item_id)
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  payment_id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  payment_reference VARCHAR(100) UNIQUE,
  amount DECIMAL(10,2) NOT NULL,
  payment_status ENUM('pending','successful','failed') DEFAULT 'pending',
  payment_method VARCHAR(50),
  paid_at TIMESTAMP NULL,
  UNIQUE KEY unique_order_payment (order_id),
  FOREIGN KEY (order_id) REFERENCES orders(order_id)
);

-- Stock Items
CREATE TABLE IF NOT EXISTS stock_items (
  stock_id INT AUTO_INCREMENT PRIMARY KEY,
  item_name VARCHAR(100) NOT NULL,
  quantity_available DECIMAL(10,2) DEFAULT 0,
  unit VARCHAR(50),
  stock_status ENUM('available','low','out_of_stock') DEFAULT 'available',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Messages (customer to kitchen/reception)
CREATE TABLE IF NOT EXISTS messages (
  message_id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  table_number VARCHAR(20) NOT NULL,
  message_content TEXT NOT NULL,
  message_status ENUM('unread','read','responded') DEFAULT 'unread',
  response TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(order_id)
);

-- Preparation Time Records
CREATE TABLE IF NOT EXISTS preparation_time_records (
  record_id INT AUTO_INCREMENT PRIMARY KEY,
  menu_item_id INT NOT NULL,
  average_preparation_time INT NOT NULL COMMENT 'in minutes',
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_menu_item_prep (menu_item_id),
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(menu_item_id)
);

-- ============================================================
-- SAMPLE DATA
-- ============================================================

-- Default admin user (password: Admin@123 - change in production)
INSERT INTO users (full_name, email, password, role_id) VALUES
('System Admin', 'admin@restaurant.com', '$2a$10$pvTJ/FW9KX4KrJ5ADXVrReY9enDAkax3ZDOT.u785UQzpg6jPomde', 1),
('Restaurant Manager', 'manager@restaurant.com', '$2a$10$pvTJ/FW9KX4KrJ5ADXVrReY9enDAkax3ZDOT.u785UQzpg6jPomde', 2),
('Company CEO', 'ceo@restaurant.com', '$2a$10$pvTJ/FW9KX4KrJ5ADXVrReY9enDAkax3ZDOT.u785UQzpg6jPomde', 3),
('Kitchen Staff', 'staff@restaurant.com', '$2a$10$pvTJ/FW9KX4KrJ5ADXVrReY9enDAkax3ZDOT.u785UQzpg6jPomde', 4);

-- Sample tables with QR tokens
INSERT INTO restaurant_tables (table_number, qr_token) VALUES
('T1', 'qr_token_table_1'),
('T2', 'qr_token_table_2'),
('T3', 'qr_token_table_3'),
('T4', 'qr_token_table_4'),
('T5', 'qr_token_table_5');

-- Sample menu items
INSERT INTO menu_items (category_id, item_name, description, price, average_preparation_time, availability_status) VALUES
(1, 'Jollof Rice & Chicken', 'Nigerian party-style jollof rice served with grilled chicken', 2500.00, 15, 'available'),
(1, 'Fried Rice & Fish', 'Seasoned fried rice with grilled tilapia', 2800.00, 12, 'available'),
(1, 'Egusi Soup & Eba', 'Rich melon seed soup with eba', 2200.00, 20, 'available'),
(1, 'Pounded Yam & Oha Soup', 'Smooth pounded yam with fresh oha leaf soup', 2600.00, 18, 'available'),
(2, 'Chapman', 'Refreshing fruity cocktail drink', 800.00, 3, 'available'),
(2, 'Fresh Juice (Orange)', 'Freshly squeezed orange juice', 700.00, 5, 'available'),
(2, 'Soft Drink (Can)', 'Coke, Fanta, or Sprite', 400.00, 1, 'available'),
(3, 'Chin Chin', 'Crunchy homemade chin chin', 500.00, 2, 'available'),
(3, 'Puff Puff', 'Soft deep-fried dough balls', 400.00, 8, 'available'),
(4, 'Samosa (3 pcs)', 'Crispy vegetable samosa', 600.00, 5, 'available');

INSERT INTO preparation_time_records (menu_item_id, average_preparation_time)
SELECT menu_item_id, average_preparation_time FROM menu_items;

-- Sample stock items
INSERT INTO stock_items (item_name, quantity_available, unit, stock_status) VALUES
('Rice', 50.00, 'kg', 'available'),
('Chicken', 30.00, 'kg', 'available'),
('Yam', 20.00, 'kg', 'available'),
('Palm Oil', 10.00, 'litres', 'available'),
('Egusi', 5.00, 'kg', 'low'),
('Tomatoes', 8.00, 'kg', 'available');
