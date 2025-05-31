const mongoose = require('mongoose');

const dateSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  description: String,
  imageUrl: String,
  isHighlighted: {
    type: Boolean,
    default: false
  },
  category: {
    type: String,
    enum: ['birthday', 'anniversary', 'trip', 'other'],
    required: true,
    default: 'other'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Date', dateSchema);