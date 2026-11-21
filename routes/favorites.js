const express = require('express');
const csrf = require('csurf');
const Favorite = require('../models/Favorite');
const Product = require('../models/Product');
const { requireLogin } = require('../middleware/auth');

// ============================================
// 本文件有两个路由：
//   router     —— 页面路由，挂在 /favorites
//   apiRouter  —— REST API，挂在 /api/favorites
// ============================================

const router = express.Router();
const apiRouter = express.Router();

// CSRF 防护，和 B 的 routes/products.js 用同样的方式
const csrfProtection = csrf();

// ============================================
// 工具函数
// ============================================

// 检查是不是合法的 24 位 ObjectId
function isValidObjectId(id) {
  return typeof id === 'string' && /^[a-fA-F0-9]{24}$/.test(id);
}

// 找到当前用户的收藏夹，没有就新建一个空的
async function getOrCreateFavorite(userId) {
  let favorite = await Favorite.findOne({ userId });
  if (!favorite) {
    favorite = new Favorite({ userId, productIds: [] });
  }
  return favorite;
}

// 添加或取消收藏（切换）
// 商品详情页的"收藏"按钮提交到这里
// 返回 { ok: true, favorited: true/false } 表示操作之后是收藏了还是取消了
async function toggleFavorite(userId, productId) {
  if (!isValidObjectId(productId)) {
    return { ok: false, status: 400, error: 'Invalid product id.' };
  }

  // 商品必须存在才能收藏
  const product = await Product.findById(productId).lean();
  if (!product) {
    return { ok: false, status: 404, error: 'Product not found.' };
  }

  const favorite = await getOrCreateFavorite(userId);

  // 已经在收藏夹里了 -> 取消收藏
  const index = favorite.productIds.findIndex(
    (id) => String(id) === String(productId)
  );

  if (index >= 0) {
    favorite.productIds.splice(index, 1);
    await favorite.save();
    return { ok: true, favorited: false };
  }

  // 不在收藏夹里 -> 加进去
  favorite.productIds.push(product._id);
  await favorite.save();
  return { ok: true, favorited: true };
}

// ============================================
// 页面：查看我的收藏
// ============================================
// GET /favorites
router.get('/', requireLogin, csrfProtection, async (req, res, next) => {
  try {
    const favorite = await Favorite.findOne({
      userId: req.session.userId
    }).lean();

    const productIds = favorite ? favorite.productIds || [] : [];

    // 取出收藏的商品，卖家可能已经删掉商品，所以查出来的可能少几个
    const products = await Product.find({
      _id: { $in: productIds }
    })
      .sort({ createdAt: -1 })
      .lean();

    // 按收藏时间倒序排列（productIds 的顺序就是收藏顺序，反转一下）
    const productMap = {};
    products.forEach((p) => {
      productMap[String(p._id)] = p;
    });

    const rows = productIds
      .map((id) => productMap[String(id)])
      .filter(Boolean)
      .reverse();

    res.render('favorites/index', {
      rows,
      csrfToken: req.csrfToken()
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// 页面：收藏 / 取消收藏
// ============================================
// POST /favorites/toggle
router.post(
  '/toggle',
  requireLogin,
  csrfProtection,
  async (req, res, next) => {
    try {
      const result = await toggleFavorite(
        req.session.userId,
        req.body.productId
      );

      if (!result.ok) {
        return res.status(result.status).send(result.error);
      }

      return res.redirect(req.body.back || '/favorites');
    } catch (error) {
      next(error);
    }
  }
);

// ============================================
// REST API：查看收藏列表
// ============================================
// GET /api/favorites
apiRouter.get('/', requireLogin, async (req, res, next) => {
  try {
    const favorite = await Favorite.findOne({
      userId: req.session.userId
    }).lean();

    const productIds = favorite ? favorite.productIds || [] : [];

    const products = await Product.find({
      _id: { $in: productIds }
    }).lean();

    res.json({
      productIds,
      products
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// REST API：添加收藏
// ============================================
// POST /api/favorites
apiRouter.post('/', requireLogin, async (req, res, next) => {
  try {
    const result = await toggleFavorite(
      req.session.userId,
      req.body.productId
    );

    if (!result.ok) {
      return res.status(result.status).json({
        ok: false,
        error: result.error
      });
    }

    const favorite = await Favorite.findOne({
      userId: req.session.userId
    }).lean();

    return res.status(201).json({
      ok: true,
      favorited: result.favorited,
      productIds: favorite ? favorite.productIds : []
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// REST API：取消收藏
// ============================================
// DELETE /api/favorites/:productId
apiRouter.delete(
  '/:productId',
  requireLogin,
  async (req, res, next) => {
    try {
      const { productId } = req.params;

      if (isValidObjectId(productId)) {
        const favorite = await Favorite.findOne({
          userId: req.session.userId
        });
        if (favorite) {
          favorite.productIds = favorite.productIds.filter(
            (id) => String(id) !== String(productId)
          );
          await favorite.save();
        }
      }

      const favorite = await Favorite.findOne({
        userId: req.session.userId
      }).lean();

      return res.json({
        ok: true,
        productIds: favorite ? favorite.productIds : []
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================
// 路由自己的 CSRF 错误提示
// ============================================
router.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    return res
      .status(403)
      .send(
        'Invalid or expired form. Go back, reload the page, and try again.'
      );
  }
  next(err);
});

module.exports = router;
module.exports.apiRouter = apiRouter;
