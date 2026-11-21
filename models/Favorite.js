const mongoose = require('mongoose');

// ============================================
// 收藏夹
// 一个用户只有一个收藏夹，用 userId 唯一索引保证
// ============================================
const favoriteSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // 收藏的商品 ID 列表
  productIds: {
    type: [mongoose.Schema.Types.ObjectId],
    default: []
  }
}, { timestamps: true });

// 一个用户只能有一个收藏夹文档
favoriteSchema.index({ userId: 1 }, { unique: true });

module.exports = mongoose.model('Favorite', favoriteSchema);
