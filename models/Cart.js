const mongoose = require('mongoose');

// ============================================
// 购物车里的一条商品记录
// 注意：二手商品每件只有一份，所以这里没有"数量"字段
// ============================================
const cartItemSchema = new mongoose.Schema({
  // 商品 ID，指向 models/Product.js
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },

  // 下面三个是"加购那一刻"的快照
  // 目的是：卖家后来改了名字/价格/图片，购物车页面还能显示用户当初看到的东西
  // 注意：真正下单的成交价不能用这里的 price，要重新去 Product 查现价
  title: { type: String, required: true },
  price: { type: Number, required: true },
  imageUrl: { type: String, default: '' },

  // 加进购物车的时间
  addedAt: { type: Date, default: Date.now }
}, { _id: false });   // _id: false = 每条记录不需要自己的编号

// ============================================
// 购物车
// 一个用户只有一个购物车，用 userId 唯一索引保证
// ============================================
const cartSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // 购物车里的商品列表
  items: {
    type: [cartItemSchema],
    default: []
  }
}, { timestamps: true });

// 一个用户只能有一个购物车文档
cartSchema.index({ userId: 1 }, { unique: true });

module.exports = mongoose.model('Cart', cartSchema);
