const express = require('express');
const router = express.Router();
const { getMyCode, joinGroup, getMembers } = require('../controllers/partnerController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/my-code', getMyCode);
router.post('/join', joinGroup);
router.get('/members', getMembers);

module.exports = router;
