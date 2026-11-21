// ============================================
// 购物车 REST API（C 模块）
// ---------------------------------------------------------------
// 作业要求提供 RESTful CRUD 服务，至少要有：
//   GET    读
//   POST   增
//   PUT    改
//   DELETE 删
//
// 这个文件提供购物车的四个接口，挂在 /api/cart：
//   GET    /api/cart              读购物车
//   POST   /api/cart              加入购物车
//   PUT    /api/cart/:productId   改（更新购物车里这件商品的快照价格）
//   DELETE /api/cart/:productId   删（移出购物车）
//
// 页面路由在 routes/cart.js，逻辑都在 services/cartService.js，
// 所以页面操作和 API 操作永远读到的是同一个购物车。
// ============================================

const express = require('express');
const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const cartService = require('../services/cartService');
const { requireLogin } = require('../middleware/auth');

const apiRouter = express.Router();

// 检查是不是合法的 24 位 ObjectId
function isValidObjectId(id) {
  return typeof id === 'string' && /^[a-fA-F0-9]{24}$/.test(id);
}

// ============================================
// READ —— 读购物车
// GET /api/cart
// 返回 { ok: true, items: [...], total: Number }
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
// CREATE —— 加入购物车
// POST /api/cart
// body: { "productId": "商品ID" }
// 返回 201 { ok: true, items: [...], total: Number }
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
// UPDATE —— 改购物车里的某件商品
// PUT /api/cart/:productId
// body: { "price": 新的价格 }   （可选，不传就按商品表现价刷新）
//
// 用途：卖家改了价之后，买家在购物车里确认接受新价格。
// 二手商品每件只有一份，所以这里改的不是"数量"，只是这件商品的快照信息。
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

      // body 里传了 price 就用传的，没传就取商品表里的现价
      const newPrice = Number(req.body.price);

      if (!Number.isFinite(newPrice) || newPrice < 0) {
        // 没传价格或者传的不合法，就按商品表现价刷新
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
// DELETE —— 移出购物车
// DELETE /api/cart/:productId
// 返回 { ok: true, items: [...], total: Number }
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

      // 用 $pull 把这件商品从购物车数组里摘掉
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
