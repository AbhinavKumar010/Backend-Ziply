const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { auth, authorize } = require('../middleware/auth');

// Get all users (admin only)
router.get('/', auth, authorize('vendor'), async (req, res) => {
  try {
    const users = await User.find({ role: 'customer' })
      .select('-password')
      .sort('-createdAt');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all delivery persons (vendor only)
router.get('/delivery', auth, authorize('vendor'), async (req, res) => {
  try {
    const deliveryPersons = await User.find({ 
      role: 'delivery',
      isActive: true 
    })
      .select('-password')
      .sort('-createdAt');
    res.json(deliveryPersons);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single user
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user has permission to view this profile
    if (
      req.user.role !== 'vendor' &&
      req.user._id.toString() !== req.params.id
    ) {
      return res.status(403).json({ message: 'Not authorized to view this profile' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update user
router.put('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user has permission to update this profile
    if (
      req.user.role !== 'vendor' &&
      req.user._id.toString() !== req.params.id
    ) {
      return res.status(403).json({ message: 'Not authorized to update this profile' });
    }

    const updates = Object.keys(req.body);
    const allowedUpdates = ['name', 'phone', 'address'];
    const isValidOperation = updates.every(update => allowedUpdates.includes(update));

    if (!isValidOperation) {
      return res.status(400).json({ message: 'Invalid updates' });
    }

    updates.forEach(update => user[update] = req.body[update]);
    await user.save();
    
    res.json(user);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Deactivate user (vendor only)
router.patch('/:id/deactivate', auth, authorize('vendor'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isActive = false;
    await user.save();
    
    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Reactivate user (vendor only)
router.patch('/:id/reactivate', auth, authorize('vendor'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isActive = true;
    await user.save();
    
    res.json({ message: 'User reactivated successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router; 