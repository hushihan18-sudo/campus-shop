// ============================================
// Favourite service layer (module C)
// ---------------------------------------------------------------
// Every method only touches the favourite list of the user that is
// passed in, and the route layer always takes that user id from
// req.session.userId, so one user can never read or delete the
// favourites of another user.
//
// Usage:
//   const favouriteService = require('../services/favouriteService');
//   const { items, count } = await favouriteService.getFavourites(userId);
//   await favouriteService.removeFavourites(userId, [id1, id2]);
//
// This file only depends on models/Favourite.js and models/Product.js,
// it does not know anything about pages, forms or CSRF.
// ============================================

const mongoose = require('mongoose');
const Favourite = require('../models/Favourite');
const Product = require('../models/Product');

// ============================================
// Helper functions
// ============================================

// Check whether a value is a valid 24 character MongoDB ObjectId
function isValidObjectId(id) {
  return typeof id === 'string' && /^[a-fA-F0-9]{24}$/.test(id);
}

// Normalise a list of product ids coming from a form or a request body.
// Accepts an array, a comma separated string or a single id and always
// returns a de-duplicated array of trimmed id strings.
function toIdList(value) {
  let raw = [];

  if (Array.isArray(value)) {
    raw = value;
  } else if (typeof value === 'string') {
    raw = value.split(',');
  }

  const ids = raw
    .map((id) => (typeof id === 'string' ? id.trim() : id))
    .filter((id) => typeof id === 'string' && id.length > 0);

  return [...new Set(ids)];
}

// ============================================
// 1. Read the favourite list
// ---------------------------------------------------------------
// Returns { items: [...], count: Number }
//
// Every item contains:
//   productId    product id
//   title        product name
//   price        current price
//   imageUrl     product image
//   category     product category
//   status       available / sold / removed
//   available    can the product still be bought
//   reason       why it cannot be bought, null when it is available
//   favouritedAt when the product was added to the list
//
// The price is read from the Product collection again instead of an old
// stored value, because the seller may have changed the price or sold
// the product after it was favourited.
// ============================================
async function getFavourites(userId) {
  const entries = await Favourite.find({ userId })
    .sort({ createdAt: -1 })
    .lean();

  if (entries.length === 0) {
    return { items: [], count: 0 };
  }

  const productIds = entries.map((entry) => entry.productId);

  // Load every favourited product in one query
  const products = await Product.find({ _id: { $in: productIds } }).lean();

  // Turn the list into a table that can be looked up by product id
  const productMap = {};
  products.forEach((product) => {
    productMap[String(product._id)] = product;
  });

  const items = entries.map((entry) => {
    const product = productMap[String(entry.productId)];

    // The seller deleted the product after it was favourited
    if (!product) {
      return {
        productId: entry.productId,
        title: '(Product no longer exists)',
        price: 0,
        imageUrl: '',
        category: '',
        status: 'removed',
        available: false,
        reason: 'This product no longer exists.',
        favouritedAt: entry.createdAt
      };
    }

    const available = product.status === 'available';

    return {
      productId: product._id,
      title: product.title,
      price: Number(product.price) || 0,
      imageUrl: product.imageUrl || '',
      category: product.category || '',
      status: product.status,
      available,
      reason: available ? null : 'This product has already been sold.',
      favouritedAt: entry.createdAt
    };
  });

  return { items, count: items.length };
}

// ============================================
// 2. Read only the product ids
// ---------------------------------------------------------------
// Returns an array of product id strings, newest first.
// The product list page uses this to decide whether the button of a
// product should say "Favourite" or "Unfavourite".
// ============================================
async function getFavouriteIds(userId) {
  const entries = await Favourite.find({ userId })
    .sort({ createdAt: -1 })
    .lean();

  return entries.map((entry) => String(entry.productId));
}

// ============================================
// 3. Check whether one product is already favourited
// ---------------------------------------------------------------
// Returns true / false
// ============================================
async function isFavourited(userId, productId) {
  if (!isValidObjectId(productId)) {
    return false;
  }

  const entry = await Favourite.findOne({
    userId,
    productId: new mongoose.Types.ObjectId(productId)
  })
    .lean();

  return Boolean(entry);
}

// ============================================
// 4. Add one product to the favourite list
// ---------------------------------------------------------------
// Returns { ok: true } or { ok: false, status: Number, error: String }
//
// The product must exist, otherwise the favourite would point to
// nothing. Favouriting the same product twice is not an error,
// the second call simply reports that it was already there.
// ============================================
async function addFavourite(userId, productId) {
  if (!isValidObjectId(productId)) {
    return { ok: false, status: 400, error: 'Invalid product id.' };
  }

  const product = await Product.findById(productId).lean();

  if (!product) {
    return { ok: false, status: 404, error: 'Product not found.' };
  }

  try {
    await Favourite.create({
      userId,
      productId: product._id
    });
  } catch (error) {
    // 11000 = duplicate key, the product is already in the list
    if (error.code === 11000) {
      return { ok: true, alreadyFavourited: true };
    }

    throw error;
  }

  return { ok: true, alreadyFavourited: false };
}

// ============================================
// 5. Remove one product from the favourite list
// ---------------------------------------------------------------
// Returns { ok: true, removed: Number }
// Removing something that is not in the list is not an error,
// it simply removes nothing.
// ============================================
async function removeFavourite(userId, productId) {
  if (!isValidObjectId(productId)) {
    return { ok: true, removed: 0 };
  }

  const result = await Favourite.deleteOne({
    userId,
    productId: new mongoose.Types.ObjectId(productId)
  });

  return { ok: true, removed: result.deletedCount || 0 };
}

// ============================================
// 6. Remove several products at once (batch delete)
// ---------------------------------------------------------------
// This is the method the favourite page uses when the user ticks
// several products and presses "Remove selected".
//
// Input:
//   productIds  an array of product ids, or a comma separated string
//
// Returns { ok: true, removed: Number, productIds: [...] }
//   removed      how many favourite entries were really deleted
//   productIds   the ids that were accepted and deleted
//
// The user id is part of the filter, so the delete can never reach
// the favourites of another user.
// ============================================
async function removeFavourites(userId, productIds) {
  const ids = toIdList(productIds).filter(isValidObjectId);

  if (ids.length === 0) {
    return { ok: true, removed: 0, productIds: [] };
  }

  const result = await Favourite.deleteMany({
    userId,
    productId: {
      $in: ids.map((id) => new mongoose.Types.ObjectId(id))
    }
  });

  return {
    ok: true,
    removed: result.deletedCount || 0,
    productIds: ids
  };
}

// ============================================
// 7. Toggle one product
// ---------------------------------------------------------------
// The product page button uses this: if the product is already in the
// list it is removed, otherwise it is added.
//
// Returns { ok: true, favourited: Boolean }
//   favourited  the state after the operation
// ============================================
async function toggleFavourite(userId, productId) {
  if (!isValidObjectId(productId)) {
    return { ok: false, status: 400, error: 'Invalid product id.' };
  }

  const entry = await Favourite.findOne({
    userId,
    productId: new mongoose.Types.ObjectId(productId)
  }).lean();

  // Already in the list, so remove it
  if (entry) {
    await Favourite.deleteOne({ _id: entry._id });
    return { ok: true, favourited: false };
  }

  // Not in the list, so add it
  const result = await addFavourite(userId, productId);

  if (!result.ok) {
    return result;
  }

  return { ok: true, favourited: true };
}

// ============================================
// 8. Set the state of one product
// ---------------------------------------------------------------
// Used by the PUT API. The target state comes from the request body,
// so the same call can create or delete the entry.
//
// Returns { ok: true, favourited: Boolean }
// ============================================
async function setFavourite(userId, productId, favourited) {
  if (favourited) {
    const result = await addFavourite(userId, productId);

    if (!result.ok) {
      return result;
    }

    return { ok: true, favourited: true };
  }

  await removeFavourite(userId, productId);
  return { ok: true, favourited: false };
}

// ============================================
// 9. Remove every product from the favourite list
// ---------------------------------------------------------------
// Returns { ok: true, removed: Number }
// ============================================
async function clearFavourites(userId) {
  const result = await Favourite.deleteMany({ userId });
  return { ok: true, removed: result.deletedCount || 0 };
}

// ============================================
// Export
// ============================================
module.exports = {
  getFavourites,
  getFavouriteIds,
  isFavourited,
  addFavourite,
  removeFavourite,
  removeFavourites,
  toggleFavourite,
  setFavourite,
  clearFavourites
};
