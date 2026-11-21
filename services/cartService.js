// ============================================
// Cart service layer (the part module C hands over to module D)
// ---------------------------------------------------------------
// The order module of member D only has to require this single file to:
//   1. read the cart of a user
//   2. get the current real price to calculate the order amount
//   3. clear the cart after the order was created
//
// Usage:
//   const cartService = require('../services/cartService');
//   const { items, total } = await cartService.getCartForUser(userId);
//   await cartService.clearCart(userId);
//
// This file only depends on models/Cart.js and models/Product.js,
// it does not depend on any page route or middleware, so it cannot
// interfere with the order route of member D.
// ============================================

const Cart = require('../models/Cart');
const Product = require('../models/Product');

// ============================================
// 1. Read the cart
// ---------------------------------------------------------------
// Returns { items: [...], total: Number }
// The userId is req.session.userId.
//
// Note: the total is the sum shown on the cart page, it is calculated
// with the price snapshot taken when the product was added.
// Use getCartItemsWithCurrentPrice() for the real order amount,
// the reason is explained in part 2.
// ============================================
async function getCartForUser(userId) {
  const cart = await Cart.findOne({ userId }).lean();

  // A user who never added anything has no cart document yet
  if (!cart) {
    return { items: [], total: 0 };
  }

  const items = cart.items || [];

  const total = Number(
    items
      .reduce((sum, item) => sum + (Number(item.price) || 0), 0)
      .toFixed(2)
  );

  return { items, total };
}

// ============================================
// 2. Read the cart with the current status and price of every product
// ---------------------------------------------------------------
// This one is meant for the order of member D, it returns for every item:
//   productId    product id
//   title        product name
//   imageUrl     image
//   currentPrice the real price right now  <- the order amount uses this
//   available    can it still be bought (true / false)
//   reason       why it cannot be bought (null when available is true)
//
// Why Product is read again:
//   The seller may change the price after the buyer added the product, or
//   mark the product as sold. The price stored in the cart is only a
//   snapshot, using it for an order would calculate the wrong amount.
//   A second hand product exists only once, so when two buyers order at the
//   same time the status has to be checked again, otherwise the same
//   product could be sold twice.
//
// Usage:
//   const cart = await cartService.getCartItemsWithCurrentPrice(userId);
//   if (cart.items.length === 0) return res.redirect('/cart');
//   for (const item of cart.items) {
//     if (!item.available) return res.status(400).send(item.reason);
//   }
//   const amount = cart.total;   // total calculated with the current prices
// ============================================
async function getCartItemsWithCurrentPrice(userId) {
  const { items } = await getCartForUser(userId);

  if (items.length === 0) {
    return { items: [], total: 0 };
  }

  // Load every product of the cart in one query
  const productIds = items.map((item) => item.productId);
  const products = await Product.find({ _id: { $in: productIds } }).lean();

  // Turn the list into a table that can be looked up by product id
  const productMap = {};
  products.forEach((p) => {
    productMap[String(p._id)] = p;
  });

  let total = 0;

  const rows = items.map((item) => {
    const product = productMap[String(item.productId)];

    // The seller deleted the product
    if (!product) {
      return {
        productId: item.productId,
        title: item.title,
        imageUrl: item.imageUrl,
        currentPrice: Number(item.price) || 0,
        available: false,
        reason: 'This product no longer exists.'
      };
    }

    // The product is still there but somebody else bought it
    if (product.status !== 'available') {
      return {
        productId: product._id,
        title: product.title,
        imageUrl: product.imageUrl || '',
        currentPrice: Number(product.price) || 0,
        available: false,
        reason: 'This product has already been sold.'
      };
    }

    const currentPrice = Number(product.price) || 0;
    total += currentPrice;

    return {
      productId: product._id,
      title: product.title,
      imageUrl: product.imageUrl || '',
      currentPrice,
      available: true,
      reason: null
    };
  });

  return { items: rows, total: Number(total.toFixed(2)) };
}

// ============================================
// 3. Clear the cart
// ---------------------------------------------------------------
// Member D calls this after the order was created:
//   await cartService.clearCart(userId);
//
// Only the cart of this user is cleared, other users are not affected.
// ============================================
async function clearCart(userId) {
  await Cart.updateOne({ userId }, { $set: { items: [] } });
  return { ok: true };
}

// ============================================
// 4. Add a product to the cart (optional, used for testing)
// ---------------------------------------------------------------
// Member D may need to put something into the cart while testing the
// order flow. This function adds a product without going through a page.
// Usage:
//   const r = await cartService.addToCart(userId, productId);
//   if (!r.ok) console.log(r.error);
// ============================================
async function addToCart(userId, productId) {
  const product = await Product.findById(productId).lean();

  if (!product) {
    return { ok: false, status: 404, error: 'Product not found.' };
  }
  if (product.status !== 'available') {
    return { ok: false, status: 400, error: 'This product has already been sold.' };
  }
  if (String(product.seller) === String(userId)) {
    return { ok: false, status: 400, error: 'You cannot add your own product to the cart.' };
  }

  let cart = await Cart.findOne({ userId });
  if (!cart) {
    cart = new Cart({ userId, items: [] });
  }

  const already = cart.items.some(
    (item) => String(item.productId) === String(productId)
  );
  if (already) {
    return { ok: false, status: 400, error: 'This product is already in your cart.' };
  }

  cart.items.push({
    productId: product._id,
    title: product.title,
    price: product.price,
    imageUrl: product.imageUrl || '',
    addedAt: new Date()
  });

  await cart.save();
  return { ok: true };
}

// ============================================
// Export
// ============================================
module.exports = {
  getCartForUser,
  getCartItemsWithCurrentPrice,
  clearCart,
  addToCart
};
