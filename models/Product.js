const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  // 商品名称
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },

  // 商品描述
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 3000
  },

  // 商品价格，不能为负数
  price: {
    type: Number,
    required: true,
    min: 0
  },

  // 商品分类，选项在页面与路由中统一
  category: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },

  // 图片地址：允许不填；填写时只接受 HTTP/HTTPS URL
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

  // 卖家 ID，关联现有的 User 模型
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // 出售状态：在售 / 已售出
  status: {
    type: String,
    enum: ['available', 'sold'],
    default: 'available'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Product', ProductSchema);