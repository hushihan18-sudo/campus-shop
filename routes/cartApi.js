// ============================================
// Cart REST API (module C)
// ---------------------------------------------------------------
// The assignment asks for RESTful CRUD services, at least:
//   GET    read
//   POST   create
//   PUT    update
//   DELETE delete
//
// This file provides the four endpoints of the cart, mounted on /api/cart:
//   GET    /api/cart              read the cart
//   POST   /api/cart              add a product to the cart
//   PUT    /api/cart/:productId   update the snapshot of one product
//   DELETE /api/cart/:productId   remove one product
//
// The page routes live in routes/cart.js, all the logic lives in
// services/cartService.js, so the page actions and the API actions always
// read and write the same cart.
// ============================================

const express = require('express');
const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const cartService = require('../services/cartService');
const { requireLogin } = require('../middleware/auth');

const apiRouter = express.Router();

// Check whether a value is a valid 24 character MongoDB ObjectId
function isValidObjectId(id) {
  return typeof id === 'string' && /^[a-fA-F0-9]{24}$/.test(id);
}

// ============================================
// READ - read the cart
// GET /api/cart
// Returns { ok: true, items: [...], total: Number }
// ============================================
apiRouter.get('/', requireLogin, async (req, res, next) => {
  try {
    const cart = await cartService.getCartForUser(req.session.userId);
    res.json({ ok: true, ...cart });
  } catch (error) {
    next(error);
  }
});

// ============================================
// CREATE - add a product to the cart
// POST /api/cart
// body: { "productId": "product id" }
// Returns 201 { ok: true, items: [...], total: Number }
// ============================================
apiRouter.post('/', requireLogin, async (req, res, next) => {
  try {
    const { productId } = req.body;

    if (!isValidObjectId(productId)) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid product id.'
      });
    }

    const result = await cartService.addToCart(
      req.session.userId,
      productId
    );

    if (!result.ok) {
      return res.status(result.status || 400).json({
        ok: false,
        error: result.error
      });
    }

    const cart = await cartService.getCartForUser(req.session.userId);
    return res.status(201).json({ ok: true, ...cart });
  } catch (error) {
    next(error);
  }
});

// ============================================
// UPDATE - update one product of the cart
// PUT /api/cart/:productId
// body: { "price": new price }  (optional, without it the current price
//                                of the product is used)
//
// Use case: the seller changed the price and the buyer confirms the new
// price in the cart. A second hand product exists only once, so this does
// not change a "quantity", it only updates the snapshot of this product.
// ============================================
apiRouter.put(
  '/:productId',
  requireLogin,
  async (req, res, next) => {
    try {
      const { productId } = req.params;

      if (!isValidObjectId(productId)) {
        return res.status(400).json({
          ok: false,
          error: 'Invalid product id.'
        });
      }

      const cart = await Cart.findOne({ userId: req.session.userId });
      if (!cart) {
        return res.status(404).json({
          ok: false,
          error: 'Cart not found.'
        });
      }

      const item = cart.items.find(
        (it) => String(it.productId) === String(productId)
      );

      if (!item) {
        return res.status(404).json({
          ok: false,
          error: 'This product is not in your cart.'
        });
      }

      // Use the price of the body when one was sent, otherwise use the
      // current price of the product
      const newPrice = Number(req.body.price);

      if (!Number.isFinite(newPrice) || newPrice < 0) {
        // No price was sent or it is not valid, refresh with the current
        // price of the product
        const product = await require('../models/Product')
          .findById(productId)
          .lean();

        if (!product) {
          return res.status(404).json({
            ok: false,
            error: 'Product not found.'
          });
        }

        item.price = product.price;
        item.title = product.title;
        item.imageUrl = product.imageUrl || '';
      } else {
        item.price = newPrice;
      }

      await cart.save();

      const result = await cartService.getCartForUser(req.session.userId);
      return res.json({ ok: true, ...result });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================
// DELETE - remove one product from the cart
// DELETE /api/cart/:productId
// Returns { ok: true, items: [...], total: Number }
// ============================================
apiRouter.delete(
  '/:productId',
  requireLogin,
  async (req, res, next) => {
    try {
      const { productId } = req.params;

      if (!isValidObjectId(productId)) {
        return res.status(400).json({
          ok: false,
          error: 'Invalid product id.'
        });
      }

      // $pull removes this product from the items array of the cart
      await Cart.updateOne(
        { userId: req.session.userId },
        {
          $pull: {
            items: {
              productId: new mongoose.Types.ObjectId(productId)
            }
          }
        }
      );

      const cart = await cartService.getCartForUser(req.session.userId);
      return res.json({ ok: true, ...cart });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = apiRouter;
