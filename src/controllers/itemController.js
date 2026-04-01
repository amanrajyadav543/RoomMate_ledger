const Item = require('../models/Item');
const User = require('../models/User');
const Group = require('../models/Group');
const { uploadToCloudinary, deleteFromCloudinary } = require('../utils/cloudinary');
const { sendPushNotification } = require('../utils/notification');

function getCurrentMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

async function getOtherMemberTokens(groupId, excludeUserId) {
  const group = await Group.findById(groupId).populate('members', 'fcmToken');
  if (!group) return [];
  return group.members
    .filter((m) => String(m._id) !== String(excludeUserId) && m.fcmToken)
    .map((m) => m.fcmToken);
}

// POST /api/items
async function addItem(req, res) {
  try {
    let currentUser = req.user;

    // Auto-create a solo group if user doesn't have one yet
    if (!currentUser.groupId) {
      const group = await Group.create({ members: [currentUser._id] });
      await User.findByIdAndUpdate(currentUser._id, { groupId: group._id });
      currentUser = await User.findById(currentUser._id);
    }

    const { name, price, month } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: 'Item name is required' });
    }

    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ success: false, message: 'Valid price is required' });
    }

    const itemMonth = month || getCurrentMonth();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(itemMonth)) {
      return res.status(400).json({ success: false, message: 'Month must be in YYYY-MM format' });
    }

    let imageUrl = null;
    let imagePublicId = null;

    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer);
      imageUrl = result.url;
      imagePublicId = result.publicId;
    }

    const item = await Item.create({
      userId: currentUser._id,
      groupId: currentUser.groupId,
      name: name.trim(),
      price: parsedPrice,
      imageUrl,
      imagePublicId,
      month: itemMonth,
    });

    // Send FCM notification to other group members
    const tokens = await getOtherMemberTokens(currentUser.groupId, currentUser._id);
    if (tokens.length > 0) {
      await sendPushNotification(
        tokens,
        'New Item Added',
        `${currentUser.name} added "${item.name}" for ₹${item.price}`,
        { type: 'item_added', itemId: String(item._id), month: item.month }
      );
    }

    const populatedItem = await Item.findById(item._id).populate('userId', 'name email');

    res.status(201).json({ success: true, message: 'Item added successfully', item: populatedItem });
  } catch (err) {
    console.error('Add item error:', err);
    res.status(500).json({ success: false, message: 'Failed to add item' });
  }
}

// GET /api/items/group
async function getGroupItems(req, res) {
  try {
    let currentUser = req.user;

    if (!currentUser.groupId) {
      const group = await Group.create({ members: [currentUser._id] });
      await User.findByIdAndUpdate(currentUser._id, { groupId: group._id });
      currentUser = await User.findById(currentUser._id);
    }

    const { month } = req.query;
    const filter = { groupId: currentUser.groupId };

    if (month) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
        return res.status(400).json({ success: false, message: 'Month must be in YYYY-MM format' });
      }
      filter.month = month;
    }

    const items = await Item.find(filter)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, items });
  } catch (err) {
    console.error('Get group items error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve items' });
  }
}

// GET /api/items/user/:userId
async function getUserItems(req, res) {
  try {
    const currentUser = req.user;

    if (!currentUser.groupId) {
      return res.status(400).json({ success: false, message: 'You are not part of a group' });
    }

    const { userId } = req.params;
    const { month } = req.query;

    // Verify the requested user is in the same group
    const group = await Group.findById(currentUser.groupId);
    if (!group || !group.members.map(String).includes(userId)) {
      return res.status(403).json({ success: false, message: 'User is not in your group' });
    }

    const filter = { userId, groupId: currentUser.groupId };
    if (month) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
        return res.status(400).json({ success: false, message: 'Month must be in YYYY-MM format' });
      }
      filter.month = month;
    }

    const items = await Item.find(filter)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, items });
  } catch (err) {
    console.error('Get user items error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve user items' });
  }
}

// PUT /api/items/:id
async function updateItem(req, res) {
  try {
    const currentUser = req.user;
    const { id } = req.params;

    const item = await Item.findById(id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    if (String(item.userId) !== String(currentUser._id)) {
      return res.status(403).json({ success: false, message: 'You can only edit your own items' });
    }

    const { name, price } = req.body;

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({ success: false, message: 'Item name cannot be empty' });
      }
      item.name = name.trim();
    }

    if (price !== undefined) {
      const parsedPrice = parseFloat(price);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({ success: false, message: 'Valid price is required' });
      }
      item.price = parsedPrice;
    }

    if (req.file) {
      // Delete old image from Cloudinary if exists
      if (item.imagePublicId) {
        await deleteFromCloudinary(item.imagePublicId);
      }
      const result = await uploadToCloudinary(req.file.buffer);
      item.imageUrl = result.url;
      item.imagePublicId = result.publicId;
    }

    await item.save();

    // Send FCM notification
    const tokens = await getOtherMemberTokens(currentUser.groupId, currentUser._id);
    if (tokens.length > 0) {
      await sendPushNotification(
        tokens,
        'Item Updated',
        `${currentUser.name} updated "${item.name}"`,
        { type: 'item_updated', itemId: String(item._id), month: item.month }
      );
    }

    const populatedItem = await Item.findById(item._id).populate('userId', 'name email');

    res.status(200).json({ success: true, message: 'Item updated successfully', item: populatedItem });
  } catch (err) {
    console.error('Update item error:', err);
    res.status(500).json({ success: false, message: 'Failed to update item' });
  }
}

// DELETE /api/items/:id
async function deleteItem(req, res) {
  try {
    const currentUser = req.user;
    const { id } = req.params;

    const item = await Item.findById(id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    if (String(item.userId) !== String(currentUser._id)) {
      return res.status(403).json({ success: false, message: 'You can only delete your own items' });
    }

    // Delete image from Cloudinary
    if (item.imagePublicId) {
      await deleteFromCloudinary(item.imagePublicId);
    }

    await item.deleteOne();

    res.status(200).json({ success: true, message: 'Item deleted successfully' });
  } catch (err) {
    console.error('Delete item error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete item' });
  }
}

// GET /api/items/summary
async function getSummary(req, res) {
  try {
    let currentUser = req.user;

    if (!currentUser.groupId) {
      const group = await Group.create({ members: [currentUser._id] });
      await User.findByIdAndUpdate(currentUser._id, { groupId: group._id });
      currentUser = await User.findById(currentUser._id);
    }

    const { month } = req.query;
    const targetMonth = month || getCurrentMonth();

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(targetMonth)) {
      return res.status(400).json({ success: false, message: 'Month must be in YYYY-MM format' });
    }

    const group = await Group.findById(currentUser.groupId).populate('members', 'name email');
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const items = await Item.find({ groupId: currentUser.groupId, month: targetMonth });

    // Build per-user totals
    const userTotals = {};
    group.members.forEach((member) => {
      userTotals[String(member._id)] = {
        user: { _id: member._id, name: member.name, email: member.email },
        total: 0,
        itemCount: 0,
      };
    });

    items.forEach((item) => {
      const uid = String(item.userId);
      if (userTotals[uid]) {
        userTotals[uid].total += item.price;
        userTotals[uid].itemCount += 1;
      }
    });

    const grandTotal = items.reduce((sum, item) => sum + item.price, 0);
    const memberCount = group.members.length;
    const perPersonShare = memberCount > 0 ? grandTotal / memberCount : 0;

    const summaries = Object.values(userTotals).map((entry) => ({
      ...entry,
      balance: entry.total - perPersonShare,
    }));

    res.status(200).json({
      success: true,
      summary: {
        month: targetMonth,
        grandTotal,
        perPersonShare,
        memberCount,
        users: summaries,
      },
    });
  } catch (err) {
    console.error('Get summary error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve summary' });
  }
}

module.exports = { addItem, getGroupItems, getUserItems, updateItem, deleteItem, getSummary };
