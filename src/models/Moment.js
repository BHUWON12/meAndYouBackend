const mongoose = require('mongoose');

const momentSchema = new mongoose.Schema({
  imageUrl: {
    type: String,
    required: true
  },
  caption: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  isVideo: {
    type: Boolean,
    default: false
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
});

module.exports = mongoose.model('Moment', momentSchema);