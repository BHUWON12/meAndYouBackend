const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authController = require('../controllers/auth');
const Message = require('../models/Message');
const Moment = require('../models/Moment');
const Quote = require('../models/Quote');
const DateModel = require('../models/Date');
const User = require('../models/User');

// Auth routes
router.post('/auth/login', authController.login);
router.post('/auth/register', authController.register);

// Messages
router.get('/messages', auth, async (req, res) => {
  try {
    console.log('Fetching messages for user:', req.user.username);
    
    // Get the other user's username
    const otherUsername = req.user.username === 'bhupesh' ? 'pihu' : 'bhupesh';
    console.log('Looking for messages with:', otherUsername);

    // Find the other user
    const otherUser = await User.findOne({ username: otherUsername });
    if (!otherUser) {
      console.log('Other user not found:', otherUsername);
      return res.status(404).json({ message: 'Other user not found' });
    }

    console.log('Found other user:', otherUser.username);

    // Get messages between the two users
    const messages = await Message.find({
      $or: [
        { sender: req.user._id, recipient: otherUser._id },
        { sender: otherUser._id, recipient: req.user._id }
      ]
    })
    .sort({ timestamp: 1 }) // Sort by timestamp ascending
    .populate('sender', 'username displayName')
    .populate('recipient', 'username displayName');

    console.log('Found messages:', messages.length);

    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ 
      message: 'Error fetching messages',
      error: error.message 
    });
  }
});

// Add message creation route
router.post('/messages', auth, async (req, res) => {
  try {
    const { text, emoji, timestamp } = req.body;
    
    if (!text) {
      return res.status(400).json({ message: 'Message text is required' });
    }

    const currentUser = await User.findById(req.user.id);
    const otherUsername = currentUser.username === 'bhupesh' ? 'pihu' : 'bhupesh';
    const otherUser = await User.findOne({ username: otherUsername });

    if (!otherUser) {
      return res.status(404).json({ message: 'Recipient not found' });
    }

    const message = new Message({
      text,
      sender: currentUser._id,
      recipient: otherUser._id,
      emoji,
      timestamp: timestamp || new Date()
    });

    await message.save();

    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'username displayName')
      .populate('recipient', 'username displayName');

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error('Error creating message:', error);
    res.status(500).json({ message: 'Error creating message' });
  }
});

// Moments
router.get('/moments', auth, async (req, res) => {
  try {
    const moments = await Moment.find()
      .sort('-date')
      .populate('addedBy', 'username displayName')
      .lean();
    
    // Format dates to ISO strings and ensure all fields are present
    const formattedMoments = moments.map(moment => ({
      _id: moment._id,
      imageUrl: moment.imageUrl,
      caption: moment.caption,
      date: moment.date.toISOString(),
      addedBy: {
        username: moment.addedBy.username,
        displayName: moment.addedBy.displayName
      }
    }));
    
    res.json(formattedMoments);
  } catch (error) {
    console.error('Error fetching moments:', error);
    res.status(500).json({ message: 'Error fetching moments' });
  }
});

router.post('/moments', auth, async (req, res) => {
  try {
    const moment = new Moment({
      ...req.body,
      addedBy: req.user._id
    });
    await moment.save();
    res.status(201).json(moment);
  } catch (error) {
    res.status(500).json({ message: 'Error creating moment' });
  }
});

// Quotes
router.get('/quotes', auth, async (req, res) => {
  try {
    const quotes = await Quote.find()
      .sort('-createdAt')
      .populate('addedBy', 'username displayName');
    res.json(quotes);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching quotes' });
  }
});

router.post('/quotes', auth, async (req, res) => {
  try {
    const quote = new Quote({
      text: req.body.text,
      addedBy: req.user._id
    });
    await quote.save();
    res.status(201).json(quote);
  } catch (error) {
    res.status(500).json({ message: 'Error creating quote' });
  }
});

// Dates
router.get('/dates', auth, async (req, res) => {
  try {
    const dates = await DateModel.find()
      .sort('date')
      .populate('userId', 'username displayName')
      .lean();
    
    // Format dates to ISO strings and ensure all fields are present
    const formattedDates = dates.map(date => ({
      _id: date._id,
      title: date.title,
      date: date.date.toISOString(),
      description: date.description || '',
      category: date.category,
      isHighlighted: date.isHighlighted,
      userId: date.userId._id,
      addedBy: {
        username: date.userId.username,
        displayName: date.userId.displayName
      }
    }));
    
    res.json(formattedDates);
  } catch (error) {
    console.error('Error fetching dates:', error);
    res.status(500).json({ message: 'Error fetching dates' });
  }
});

router.post('/dates', auth, async (req, res) => {
  try {
    const { title, date, description, category, isHighlighted } = req.body;
    
    // Validate required fields
    if (!title || !date) {
      return res.status(400).json({ message: 'Title and date are required' });
    }

    // Validate date format
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' });
    }

    // Validate category
    const validCategories = ['birthday', 'anniversary', 'trip', 'other'];
    if (category && !validCategories.includes(category)) {
      return res.status(400).json({ message: 'Invalid category' });
    }

    const dateDoc = new DateModel({
      title,
      date: dateObj,
      description,
      category: category || 'other',
      isHighlighted: isHighlighted || false,
      userId: req.user._id
    });

    await dateDoc.save();
    res.status(201).json(dateDoc);
  } catch (error) {
    console.error('Error creating date:', error);
    res.status(500).json({ message: 'Error creating date' });
  }
});

router.put('/dates/:id', auth, async (req, res) => {
  try {
    const { title, date, description, category, isHighlighted } = req.body;
    
    // Validate date format if provided
    if (date) {
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) {
        return res.status(400).json({ message: 'Invalid date format' });
      }
    }

    // Validate category if provided
    if (category) {
      const validCategories = ['birthday', 'anniversary', 'trip', 'other'];
      if (!validCategories.includes(category)) {
        return res.status(400).json({ message: 'Invalid category' });
      }
    }

    const dateDoc = await DateModel.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { 
        ...(title && { title }),
        ...(date && { date: new Date(date) }),
        ...(description !== undefined && { description }),
        ...(category && { category }),
        ...(isHighlighted !== undefined && { isHighlighted })
      },
      { new: true }
    );

    if (!dateDoc) {
      return res.status(404).json({ message: 'Date not found' });
    }

    res.json(dateDoc);
  } catch (error) {
    console.error('Error updating date:', error);
    res.status(500).json({ message: 'Error updating date' });
  }
});

router.delete('/dates/:id', auth, async (req, res) => {
  try {
    const dateDoc = await DateModel.findOneAndDelete({ 
      _id: req.params.id,
      userId: req.user._id 
    });

    if (!dateDoc) {
      return res.status(404).json({ message: 'Date not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting date:', error);
    res.status(500).json({ message: 'Error deleting date' });
  }
});

module.exports = router;