// ============================================
// 购物车服务层（C 模块交付给 D 的部分）
// ---------------------------------------------------------------
// D 的订单模块只需要 require 这一个文件，就能:
//   1. 读出某个用户的购物车
//   2. 拿到"当前真实价格"来算订单金额
//   3. 下单成功后清空购物车
//
// 用法:
//   const cartService = require('../services/cartService');
//   const { items, total } = await cartService.getCartForUser(userId);
//   await cartService.clearCart(userId);
//
// 本文件只依赖 models/Cart.js 和 models/Product.js，
// 不依赖任何页面路由或中间件，所以和 D 的 orders 路由不会互相干扰。
// ============================================

const Cart = require('../models/Cart');
const Product = require('../models/Product');

// ============================================
// 1. 读购物车
// ---------------------------------------------------------------
// 返回 { items: [...], total: Number }
// userId 就是 req.session.userId
//
// 注意 total 是"购物车页面上显示的合计"，
// 用的是加购那一刻存下来的价格快照。
// 真正下单的金额请用 getCartItemsWithCurrentPrice()，原因见第 2 条。
// ============================================
async function getCartForUser(userId) {
  const cart = await Cart.findOne({ userId }).lean();

  // 从没买过东西的用户还没有购物车文档，返回空购物车
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
// 2. 读购物车 + 带上商品的"当前状态和现价"
// ---------------------------------------------------------------
// 这个是给 D 下单用的，返回每一件商品的:
//   productId    商品编号
//   title        商品名
//   imageUrl     图片
//   currentPrice 现在的真实价格  ← 订单金额要用这个
//   available    现在还能不能买（true/false）
//   reason       不能买的原因（available 为 true 时是 null）
//
// 为什么要重新查 Product:
//   卖家在买家加购之后可能改价，或者把商品标成已售出。
//   购物车里存的 price 只是加购当时的快照，直接拿来下单会算错钱。
//   而且二手商品只有一份，如果两个人同时下单，
//   必须当场再查一次 status，否则会出现"一物两卖"。
//
// 用法:
//   const cart = await cartService.getCartItemsWithCurrentPrice(userId);
//   if (cart.items.length === 0) return res.redirect('/cart');
//   for (const item of cart.items) {
//     if (!item.available) return res.status(400).send(item.reason);
//   }
//   const amount = cart.total;   // 用当前现价算出来的合计
// ============================================
async function getCartItemsWithCurrentPrice(userId) {
  const { items } = await getCartForUser(userId);

  if (items.length === 0) {
    return { items: [], total: 0 };
  }

  // 一次性把这些商品全查出来
  const productIds = items.map((item) => item.productId);
  const products = await Product.find({ _id: { $in: productIds } }).lean();

  // 转成"用商品编号就能查到"的表
  const productMap = {};
  products.forEach((p) => {
    productMap[String(p._id)] = p;
  });

  let total = 0;

  const rows = items.map((item) => {
    const product = productMap[String(item.productId)];

    // 商品已经被卖家删掉了
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

    // 商品还在，但已经被别人买走了
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
// 3. 清空购物车
// ---------------------------------------------------------------
// D 在订单创建成功之后调用:
//   await cartService.clearCart(userId);
//
// 只清空当前这个用户的购物车，不影响别人。
// ============================================
async function clearCart(userId) {
  await Cart.updateOne({ userId }, { $set: { items: [] } });
  return { ok: true };
}

// ============================================
// 4. 加购（可选，测试用）
// ---------------------------------------------------------------
// D 在自己测订单流程时，可能需要往购物车里塞点东西。
// 这个函数可以不用走页面，直接往购物车里加一件商品。
// 用法:
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
// 导出
// ============================================
module.exports = {
  getCartForUser,
  getCartItemsWithCurrentPrice,
  clearCart,
  addToCart
};
