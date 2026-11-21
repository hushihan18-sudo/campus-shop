const mongoose = require('mongoose');

// ============================================
// One product inside the cart
// ============================================
// Note: a second hand product exists only once, so there is no
// "quantity" field here.
const cartItemSchema = new mongoose.Schema({
  // Product id, points at models/Product.js
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },

  // The three fields below are a snapshot taken when the product was added.
  // The reason is that the seller may rename the product, change the price
  // or replace the image later, and the cart page should still show what
  // the buyer saw at that moment.
  // Note: the real price of an order must not come from this price field,
  // the current price has to be read from Product again.
  title: { type: String, required: true },
  price: { type: Number, required: true },
  imageUrl: { type: String, default: '' },

  // When the product was added to the cart
  addedAt: { type: Date, default: Date.now }
}, { _id: false });   // _id: false = every entry does not need its own id

// ============================================
// Cart
// A user owns exactly one cart, a unique index on userId guarantees it.
// ============================================
const cartSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // The products inside the cart
  items: {
    type: [cartItemSchema],
    default: []
  }
}, { timestamps: true });

// A user can only have one cart document
cartSchema.index({ userId: 1 }, { unique: true });

module.exports = mongoose.model('Cart', cartSchema);
