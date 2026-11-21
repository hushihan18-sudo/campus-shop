const mongoose = require('mongoose');

// ============================================
// Favourite item
// ---------------------------------------------------------------
// One document = one product favourited by one user.
//
// The design document describes the favourite list as
// "user id + product id", so every pair gets its own document.
// That keeps the structure flat and lets the service layer
// delete several favourites at once with a single query.
//
// The unique index below makes sure the same product cannot be
// favourited twice by the same user.
// ============================================
const favouriteSchema = new mongoose.Schema({
  // Owner of this favourite entry
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // The favourited product
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  }
}, {
  timestamps: true
});

// The same product can only be favourited once by the same user
favouriteSchema.index({ userId: 1, productId: 1 }, { unique: true });

module.exports = mongoose.model('Favourite', favouriteSchema);
