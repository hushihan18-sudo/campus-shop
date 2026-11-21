
const express = require('express');
const csrf = require('csurf');
const mongoose = require('mongoose');

const Cart = require('../models/Cart');
const cartService = require('../services/cartService');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();
const csrfProtection = csrf();

// =====================================
// GET /cart
// 显示当前用户的购物车
// =====================================
router.get('/', requireLogin, csrfProtection, async (req, res, next) => {
    try {
        const { items, total } = await cartService.getCartForUser(
            req.session.userId
        );

        const notices = {
            added: 'Product successfully added to your cart.',
            removed: 'Product removed from your cart.'
        };

        res.render('cart/index', {
            items,
            total,
            csrfToken: req.csrfToken(),
            notice: notices[req.query.notice] || '',
            error: typeof req.query.error === 'string'
                ? req.query.error
                : ''
        });
    } catch (error) {
        next(error);
    }
});

// =====================================
// POST /cart/add/:productId
// 加入购物车
// =====================================
router.post(
    '/add/:productId',
    requireLogin,
    csrfProtection,
    async (req, res, next) => {
        try {
            const { productId } = req.params;

            if (!/^[a-fA-F0-9]{24}$/.test(productId)) {
                return res.redirect(
                    '/cart?error=' + encodeURIComponent('Invalid product ID.')
                );
            }

            const result = await cartService.addToCart(
                req.session.userId,
                productId
            );

            if (!result.ok) {
                return res.redirect(
                    '/cart?error=' + encodeURIComponent(result.error)
                );
            }

            return res.redirect('/cart?notice=added');
        } catch (error) {
            next(error);
        }
    }
);

// =====================================
// POST /cart/remove/:productId
// 删除购物车中的商品
// =====================================
router.post(
    '/remove/:productId',
    requireLogin,
    csrfProtection,
    async (req, res, next) => {
        try {
            const { productId } = req.params;

            if (!mongoose.isValidObjectId(productId)) {
                return res.status(400).send('Invalid product ID.');
            }

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

            return res.redirect('/cart?notice=removed');
        } catch (error) {
            next(error);
        }
    }
);

// CSRF 错误处理
router.use((err, req, res, next) => {
    if (err.code === 'EBADCSRFTOKEN') {
        return res.status(403).send(
            'Invalid or expired form. Please reload the page and try again.'
        );
    }

    next(err);
});

module.exports = router;
