const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const { auth, authorize } = require('../middleware/auth');

// Get all orders (admin only)
router.get('/', auth, authorize('vendor', 'delivery'), async (req, res) => {
  try {
    const query = {};
    
    if (req.user.role === 'vendor') {
      query.vendor = req.user._id;
    } else if (req.user.role === 'delivery') {
      query.deliveryPerson = req.user._id;
    }

    const orders = await Order.find(query)
      .populate('customer', 'name email phone')
      .populate('vendor', 'name email phone')
      .populate('deliveryPerson', 'name email phone')
      .populate('items.product')
      .sort('-createdAt');
    
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get customer orders
router.get('/customer', auth, authorize('customer'), async (req, res) => {
  try {
    const orders = await Order.find({ customer: req.user._id })
      .populate('vendor', 'name email phone')
      .populate('deliveryPerson', 'name email phone')
      .populate('items.product')
      .sort('-createdAt');
    
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get live orders (orders in progress)
router.get('/live', auth, async (req, res) => {
  try {
    const query = {
      status: { $in: ['pending', 'confirmed', 'preparing', 'ready', 'picked_up'] }
    };
    
    if (req.user.role === 'vendor') {
      query.vendor = req.user._id;
    } else if (req.user.role === 'delivery') {
      query.deliveryPerson = req.user._id;
    } else if (req.user.role === 'customer') {
      query.customer = req.user._id;
    }

    const orders = await Order.find(query)
      .populate('customer', 'name email phone')
      .populate('vendor', 'name email phone')
      .populate('deliveryPerson', 'name email phone')
      .populate('items.product')
      .sort('-createdAt');
    
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single order
router.get('/:id', auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customer', 'name email phone')
      .populate('vendor', 'name email phone')
      .populate('deliveryPerson', 'name email phone')
      .populate('items.product');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check if user has permission to view this order
    if (
      req.user.role !== 'vendor' &&
      req.user.role !== 'delivery' &&
      order.customer._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: 'Not authorized to view this order' });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create order (customer only)
router.post('/', auth, authorize('customer'), async (req, res) => {
  try {
    const { items, vendor, deliveryAddress, paymentMethod, specialInstructions } = req.body;

    // Calculate total amount and validate products
    let totalAmount = 0;
    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product || !product.isAvailable) {
        return res.status(400).json({ message: `Product ${item.product} is not available` });
      }
      totalAmount += product.price * item.quantity;
    }

    const order = new Order({
      customer: req.user._id,
      vendor,
      items: items.map(item => ({
        product: item.product,
        quantity: item.quantity,
        price: item.price
      })),
      totalAmount,
      deliveryAddress,
      paymentMethod,
      specialInstructions
    });

    await order.save();

    // Get io instance from app
    const io = req.app.get('io');
    if (io) {
    // Emit order created event
      io.emit('newOrder', order);
    }

    res.status(201).json(order);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(400).json({ message: error.message });
  }
});

// Update order status
router.patch('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check permissions based on role
    if (req.user.role === 'vendor' && order.vendor.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this order' });
    }

    if (req.user.role === 'delivery' && order.deliveryPerson?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this order' });
    }

    // Update status and add tracking update
    await order.addTrackingUpdate(status, `Order status updated to ${status}`);

    // Emit status update event
    req.app.get('io').emit('orderStatusChanged', {
      orderId: order._id,
      status,
      timestamp: new Date()
    });

    res.json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Assign delivery person (vendor only)
router.patch('/:id/assign-delivery', auth, authorize('vendor'), async (req, res) => {
  try {
    const { deliveryPersonId } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.vendor.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this order' });
    }

    order.deliveryPerson = deliveryPersonId;
    await order.addTrackingUpdate('assigned', 'Delivery person assigned');
    await order.save();

    // Emit delivery assignment event
    req.app.get('io').emit('deliveryAssigned', {
      orderId: order._id,
      deliveryPersonId
    });

    res.json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router; 