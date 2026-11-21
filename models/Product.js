const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  // Product name
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },

  // Product description
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 3000
  },

  // Product price, must not be negative
  price: {
    type: Number,
    required: true,
    min: 0
  },

  // Product category, the same options are used in the page and the route
  category: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },

  // Image address: optional, only HTTP/HTTPS URLs are accepted
  imageUrl: {
    type: String,
    trim: true,
    default: '',
    maxlength: 2048,
    validate: {
      validator(value) {
        if (!value) return true;

        try {
          const url = new URL(value);
          return ['http:', 'https:'].includes(url.protocol);
        } catch {
          return false;
        }
      },
      message: 'The image URL must be valid. HTTP or HTTPS URL'
    }
  },

  // Seller id, linked to the existing User model
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Sale status: on sale / sold
  status: {
    type: String,
    enum: ['available', 'sold'],
    default: 'available'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Product', ProductSchema);