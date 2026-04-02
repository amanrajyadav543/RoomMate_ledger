const express = require('express');
const router = express.Router();
const {
  addItem,
  getGroupItems,
  getUserItems,
  updateItem,
  deleteItem,
  getSummary,
} = require('../controllers/itemController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

router.use(protect);

// IMPORTANT: specific routes before parameterized routes
router.get('/summary', getSummary);
router.get('/group', getGroupItems);
router.get('/user/:userId', getUserItems);
router.post('/', upload.single('image'), addItem);
router.put('/:id', upload.single('image'), updateItem);
router.delete('/:id', deleteItem);


//thhissfbgjfsbjvk

module.exports = router;
