const express = require('express');
const csrf = require('csurf');
const Product = require('../models/Product');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();

// 使用现有 Session 保存 CSRF secret，不需要 cookie-parser
const csrfProtection = csrf();

const categories = [
  'Books',
  'Electronics',
  'Clothing',
  'Daily Essentials',
  'Sports',
  'Other'
];

// 商品列表
router.get('/', requireLogin, async (req, res, next) => {
  try {
    const products = await Product.find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.render('products/index', { products });
  } catch (error) {
    next(error);
  }
});

// 显示发布表单
router.get('/new', requireLogin, csrfProtection, (req, res) => {
  res.render('products/new', {
    categories,
    values: {},
    error: '',
    csrfToken: req.csrfToken()
  });
});

// 处理发布表单
router.post('/', requireLogin, csrfProtection, async (req, res, next) => {
  const body = req.body || {};

  // 只接受指定字段的字符串，不直接使用整个 req.body
  const text = (value) =>
    typeof value === 'string' ? value.trim() : '';

  const values = {
    title: text(body.title),
    description: text(body.description),
    price: text(body.price),
    category: text(body.category),
    imageUrl: text(body.imageUrl)
  };

  const showError = (message) => {
    return res.status(400).render('products/new', {
      categories,
      values,
      error: message,
      csrfToken: req.csrfToken()
    });
  };

  if (!values.title || values.title.length > 100) {
    return showError('Please enter a product name of 1–100 characters.');
  }

  if (!values.description || values.description.length > 3000) {
    return showError('Please enter a description of 1–3000 characters.');
  }

  // 最多保留两位小数，不允许负数或非数字
  if (!/^\d+(\.\d{1,2})?$/.test(values.price)) {
    return showError('Enter a non-negative price with up to two decimal places.');
  }

  const price = Number(values.price);

  if (!Number.isFinite(price) || price > 1000000) {
    return showError('The price must not exceed 1,000,000.');
  }

  if (!categories.includes(values.category)) {
    return showError('Please select a valid category.');
  }

  if (values.imageUrl) {
    try {
      const url = new URL(values.imageUrl);

      if (
        !['http:', 'https:'].includes(url.protocol) ||
        values.imageUrl.length > 2048
      ) {
        return showError('Please enter a valid HTTP or HTTPS image URL.');
      }
    } catch {
      return showError('Please enter a valid HTTP or HTTPS image URL.');
    }
  }

  try {
    await Product.create({
      title: values.title,
      description: values.description,
      price,
      category: values.category,
      imageUrl: values.imageUrl,

      // 卖家只能来自登录 Session，不能由表单指定
      seller: req.session.userId,
      status: 'available'
    });

    return res.redirect('/products');
  } catch (error) {
    if (error.name === 'ValidationError') {
      return showError('Please check the product information and try again.');
    }

    next(error);
  }
});

// 我的商品：只查询当前登录用户发布的商品
router.get(
  '/mine',
  requireLogin,
  csrfProtection,
  async (req, res, next) => {
    try {
      const products = await Product.find({
        seller: req.session.userId
      })
        .sort({ createdAt: -1 })
        .lean();

      res.render('products/mine', {
        products,
        csrfToken: req.csrfToken()
      });
    } catch (error) {
      next(error);
    }
  }
);
// 显示编辑表单：只能编辑自己的商品
router.get(
  '/:id/edit',
  requireLogin,
  csrfProtection,
  async (req, res, next) => {
    try {
      const { id } = req.params;

      // 检查商品 ID 格式
      if (!/^[a-fA-F0-9]{24}$/.test(id)) {
        return res.status(404).send('Product not found.');
      }

      // 同时检查商品 ID 和卖家，避免编辑别人的商品
      const product = await Product.findOne({
        _id: id,
        seller: req.session.userId
      }).lean();

      if (!product) {
        return res.status(404).send(
          'Product not found or you do not have permission to edit it.'
        );
      }

      // 复用发布页面，并回填商品信息
      res.render('products/new', {
        categories,
        values: {
          title: product.title,
          description: product.description,
          price: String(product.price),
          category: product.category,
          imageUrl: product.imageUrl || '',
          status: product.status
        },
        error: '',
        csrfToken: req.csrfToken(),
        editProductId: String(product._id)
      });
    } catch (error) {
      next(error);
    }
  }
);
// 保存编辑：只能修改自己的商品
router.post(
  '/:id/edit',
  requireLogin,
  csrfProtection,
  async (req, res, next) => {
    const { id } = req.params;

    if (!/^[a-fA-F0-9]{24}$/.test(id)) {
      return res.status(404).send('Product not found.');
    }

    const body = req.body || {};

    const text = (value) =>
      typeof value === 'string' ? value.trim() : '';

    // 只接受允许修改的字段
    const values = {
      title: text(body.title),
      description: text(body.description),
      price: text(body.price),
      category: text(body.category),
      imageUrl: text(body.imageUrl),
      status: text(body.status)
    };

    // 验证失败时保留输入，并继续显示编辑模式
    const showError = (message) => {
      return res.status(400).render('products/new', {
        categories,
        values,
        error: message,
        csrfToken: req.csrfToken(),
        editProductId: id
      });
    };

    if (!values.title || values.title.length > 100) {
      return showError(
        'Please enter a product name of 1–100 characters.'
      );
    }

    if (!values.description || values.description.length > 3000) {
      return showError(
        'Please enter a description of 1–3000 characters.'
      );
    }

    if (!/^\d+(\.\d{1,2})?$/.test(values.price)) {
      return showError(
        'Enter a non-negative price with up to two decimal places.'
      );
    }

    const price = Number(values.price);

    if (!Number.isFinite(price) || price > 1000000) {
      return showError('The price must not exceed 1,000,000.');
    }

    if (!categories.includes(values.category)) {
      return showError('Please select a valid category.');
    }

    if (!['available', 'sold'].includes(values.status)) {
      return showError('Please select a valid status.');
    }

    if (values.imageUrl) {
      try {
        const url = new URL(values.imageUrl);

        if (
          !['http:', 'https:'].includes(url.protocol) ||
          values.imageUrl.length > 2048
        ) {
          return showError(
            'Please enter a valid HTTP or HTTPS image URL.'
          );
        }
      } catch {
        return showError(
          'Please enter a valid HTTP or HTTPS image URL.'
        );
      }
    }

    try {
      const product = await Product.findOneAndUpdate(
        {
          _id: id,
          seller: req.session.userId
        },
        {
          $set: {
            title: values.title,
            description: values.description,
            price,
            category: values.category,
            imageUrl: values.imageUrl,
            status: values.status
          }
        },
        {
          new: true,
          runValidators: true
        }
      );

      if (!product) {
        return res.status(404).send(
          'Product not found or you do not have permission to edit it.'
        );
      }

      return res.redirect('/products/' + product._id);
    } catch (error) {
      if (error.name === 'ValidationError') {
        return showError(
          'Please check the product information and try again.'
        );
      }

      next(error);
    }
  }
);
// 删除商品：只能删除自己发布的商品
router.post(
  '/:id/delete',
  requireLogin,
  csrfProtection,
  async (req, res, next) => {
    try {
      const { id } = req.params;

      // 检查商品 ID 格式
      if (!/^[a-fA-F0-9]{24}$/.test(id)) {
        return res.status(404).send('Product not found.');
      }

      // 在删除时同时检查商品 ID 和卖家身份
      const product = await Product.findOneAndDelete({
        _id: id,
        seller: req.session.userId
      });

      if (!product) {
        return res.status(404).send(
          'Product not found or you do not have permission to delete it.'
        );
      }

      return res.redirect('/products/mine');
    } catch (error) {
      next(error);
    }
  }
);


// 商品详情：放在 /new 等固定路径后面
router.get('/:id', requireLogin, async (req, res, next) => {
  try {
    const { id } = req.params;

    // 防止无效 ID 引起数据库转换错误
    if (!/^[a-fA-F0-9]{24}$/.test(id)) {
      return res.status(404).send('Product not found.');
    }

    const product = await Product.findById(id)
      .populate('seller', 'nickname contact')
      .lean();

    if (!product) {
      return res.status(404).send('Product not found.');
    }

    // 图片只允许 HTTP/HTTPS 地址
    let imageUrl = '';

    if (product.imageUrl) {
      try {
        const url = new URL(product.imageUrl);

        if (['http:', 'https:'].includes(url.protocol)) {
          imageUrl = url.href;
        }
      } catch {
        // 无效图片地址不展示
      }
    }

    res.render('products/show', {
      product,
      imageUrl
    });
  } catch (error) {
    next(error);
  }
});
// 商品路由自己的 CSRF 错误提示

router.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).send(
      'Invalid or expired form. Go back, reload the page, and try again.'
    );
  }

  next(err);
});

module.exports = router;