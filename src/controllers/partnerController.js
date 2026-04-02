const User = require('../models/User');
const Group = require('../models/Group');

// GET /api/partner/my-code
async function getMyCode(req, res) {
  try {
    res.status(200).json({
      success: true,
      partnerCode: req.user.partnerCode,
    });
  } catch (err) {
    console.error('Get my code error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve partner code' });
  }
}

// POST /api/partner/join
async function joinGroup(req, res) {
  try {
    const { partnerCode } = req.body;

    if (!partnerCode) {
      return res.status(400).json({ success: false, message: 'Partner code is required' });
    }

    const currentUser = req.user;

    if (currentUser.partnerCode === partnerCode.toUpperCase()) {
      return res.status(400).json({ success: false, message: 'You cannot join using your own partner code' });
    }

    const partner = await User.findOne({ partnerCode: partnerCode.toUpperCase() });
    if (!partner) {
      return res.status(404).json({ success: false, message: 'No user found with that partner code' });
    }

    // If current user already has a group
    if (currentUser.groupId) {
      const existingGroup = await Group.findById(currentUser.groupId);
      if (existingGroup && existingGroup.members.map(String).includes(String(partner._id))) {
        return res.status(400).json({ success: false, message: 'You are already in a group with this partner' });
      }
    }

    // Always join the partner's group (partner always has a group since registration auto-creates one)
    const group = await Group.findById(partner.groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Partner group not found' });
    }

    if (!group.members.map(String).includes(String(currentUser._id))) {
      group.members.push(currentUser._id);
      await group.save();
    }

    // If current user had their own solo group, move all their items to the partner's group
    if (currentUser.groupId && String(currentUser.groupId) !== String(partner.groupId)) {
      const Item = require('../models/Item');
      await Item.updateMany({ groupId: currentUser.groupId }, { groupId: group._id });
      // Delete old solo group
      await Group.findByIdAndDelete(currentUser.groupId);
    }

    await User.findByIdAndUpdate(currentUser._id, { groupId: group._id });

    const updatedUser = await User.findById(currentUser._id);

    res.status(200).json({
      success: true,
      message: 'Successfully joined group',
      group: {
        _id: group._id,
        members: group.members,
      },
      user: updatedUser,
    });
  } catch (err) {
    console.error('Join group error:', err);
    res.status(500).json({ success: false, message: 'Failed to join group' });
  }
}

// GET /api/partner/members
async function getMembers(req, res) {
  try {
    let currentUser = req.user;

    if (!currentUser.groupId) {
      const group = await Group.create({ members: [currentUser._id] });
      await User.findByIdAndUpdate(currentUser._id, { groupId: group._id });
      currentUser = await User.findById(currentUser._id);
    }

    const group = await Group.findById(currentUser.groupId).populate(
      'members',
      'name email partnerCode groupId createdAt'
    );

    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    res.status(200).json({
      success: true,
      group: {
        _id: group._id,
        members: group.members,
        createdAt: group.createdAt,
      },
    });
  } catch (err) {
    console.error('Get members error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve group members' });
  }
}

module.exports = { getMyCode, joinGroup, getMembers };
