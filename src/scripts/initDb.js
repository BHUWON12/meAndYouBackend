const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const users = [
  {
    username: 'bhupesh',
    password: 'love123',
    displayName: 'Bhupesh',
    avatarUrl: 'https://images.pexels.com/photos/1073097/pexels-photo-1073097.jpeg?auto=compress&cs=tinysrgb&w=600'
  },
  {
    username: 'pihu',
    password: 'love123',
    displayName: 'Pihu',
    avatarUrl: 'https://images.pexels.com/photos/1382731/pexels-photo-1382731.jpeg?auto=compress&cs=tinysrgb&w=600'
  }
];

async function initDb() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/you-and-me');
    console.log('Connected to MongoDB');

    // Clear existing users
    await User.deleteMany({});
    console.log('Cleared existing users');

    // Create new users
    await User.insertMany(users);
    console.log('Created initial users');

    console.log('Database initialized successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
}

initDb(); 