const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

const { login, register, getAllUsers } = require('../controllers/authController');
const { getAllMenuItems, getMenuByCategory, addMenuItem, updateMenuItem, deleteMenuItem } = require('../controllers/menuController');
const { placeOrder, addItemsToOrder, getOrderById, getAllOrders, updateOrderStatus, getDashboardSummary } = require('../controllers/orderController');
const { initializePayment, verifyPayment, reversePayment } = require('../controllers/paymentController');
const { sendMessage, getAllMessages, getOrderMessages, respondToMessage, markMessageRead } = require('../controllers/messageController');
const { getAllStock, addStockItem, updateStock } = require('../controllers/stockController');
const { generateTableQR, getAllTables } = require('../controllers/qrController');
const { getPreparationTimeRecords } = require('../controllers/prepTimeController');

router.post('/auth/login', login);
router.post('/auth/register', authMiddleware, roleMiddleware('admin'), register);
router.get('/users', authMiddleware, roleMiddleware('admin'), getAllUsers);

router.get('/menu', getMenuByCategory);
router.get('/menu/all', authMiddleware, roleMiddleware('admin', 'manager', 'ceo'), getAllMenuItems);
router.post('/menu', authMiddleware, roleMiddleware('admin', 'manager'), addMenuItem);
router.put('/menu/:id', authMiddleware, roleMiddleware('admin', 'manager'), updateMenuItem);
router.delete('/menu/:id', authMiddleware, roleMiddleware('admin'), deleteMenuItem);

router.post('/orders', placeOrder);
router.post('/orders/:id/items', addItemsToOrder);
router.get('/orders/:id', getOrderById);
router.get('/orders', authMiddleware, roleMiddleware('admin', 'manager', 'staff', 'ceo'), getAllOrders);
router.put('/orders/:id/status', authMiddleware, roleMiddleware('admin', 'manager', 'staff'), updateOrderStatus);

router.get('/dashboard', authMiddleware, roleMiddleware('admin', 'manager', 'ceo'), getDashboardSummary);
router.get('/prep-times', authMiddleware, roleMiddleware('admin', 'manager', 'ceo'), getPreparationTimeRecords);

router.post('/payment/initialize', initializePayment);
router.get('/payment/verify', verifyPayment);
router.put('/payment/reverse', authMiddleware, roleMiddleware('admin', 'manager'), reversePayment);

router.post('/messages', sendMessage);
router.get('/messages/order/:orderId', getOrderMessages);
router.get('/messages', authMiddleware, roleMiddleware('admin', 'manager', 'staff'), getAllMessages);
router.put('/messages/:id/respond', authMiddleware, roleMiddleware('admin', 'manager', 'staff'), respondToMessage);
router.put('/messages/:id/read', authMiddleware, roleMiddleware('admin', 'manager', 'staff'), markMessageRead);

router.get('/stock', authMiddleware, roleMiddleware('admin', 'manager', 'ceo'), getAllStock);
router.post('/stock', authMiddleware, roleMiddleware('admin', 'manager'), addStockItem);
router.put('/stock/:id', authMiddleware, roleMiddleware('admin', 'manager'), updateStock);

router.post('/qr/generate', authMiddleware, roleMiddleware('admin', 'manager'), generateTableQR);
router.get('/qr/tables', authMiddleware, roleMiddleware('admin', 'manager', 'ceo'), getAllTables);

module.exports = router;
