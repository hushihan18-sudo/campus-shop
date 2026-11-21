// ============================================
// Favourite routes (module C)
// ---------------------------------------------------------------
// Two routers live in this file:
//   router     page routes, mounted on /favourites
//   apiRouter  REST API, mounted on /api/favourites
//
// Page routes
//   GET  /favourites              the favourite page
//   POST /favourites/toggle       favourite or unfavourite one product
//   POST /favourites/remove       remove one product
//   POST /favourites/remove-batch remove the products that were ticked
//   POST /favourites/clear        remove every product
//
// REST API
//   GET    /api/favourites              read the favourite list
//   POST   /api/favourites              favourite one product
//   PUT    /api/favourites/:productId   set the state of one product
//   DELETE /api/favourites/:productId   unfavourite one product
//   DELETE /api/favourites              unfavourite several products
//
// All the real work is done in services/favouriteService.js, so the
// page and the API always read and write the same data.
// ============================================

const express = require('express');
const csrf = require('csurf');
const favouriteService = require('../services/favouriteService');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();
const apiRouter = express.Router();

// Session based CSRF protection, same as routes/cart.js and routes/products.js
const csrfProtection = csrf();

// ============================================
// Page: the favourite list
// GET /favourites
// ============================================
router.get('/', requireLogin, csrfProtection, async (req, res, next) => {
  try {
    const { items, count } = await favouriteService.getFavourites(
      req.session.userId
    );

    const notices = {
      added: 'Product added to your favourites.',
      removed: 'Product removed from your favourites.',
      cleared: 'All favourites have been removed.'
    };

    res.render('favourite/index', {
      items,
      count,
      csrfToken: req.csrfToken(),
      notice: notices[req.query.notice] || '',
      error: typeof req.query.error === 'string' ? req.query.error : ''
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// Page: favourite or unfavourite one product
// POST /favourites/toggle
// The product page button posts here.
// ============================================
router.post(
  '/toggle',
  requireLogin,
  csrfProtection,
  async (req, res, next) => {
    try {
      const result = await favouriteService.toggleFavourite(
        req.session.userId,
        req.body.productId
      );

      if (!result.ok) {
        return res.redirect(
          '/favourites?error=' + encodeURIComponent(result.error)
        );
      }

      const back = req.body.back || '/favourites';

      return res.redirect(
        back + (back.includes('?') ? '&' : '?') +
          'notice=' + (result.favourited ? 'added' : 'removed')
      );
    } catch (error) {
      next(error);
    }
  }
);

// ============================================
// Page: remove one product from the list
// POST /favourites/remove
// ============================================
router.post(
  '/remove',
  requireLogin,
  csrfProtection,
  async (req, res, next) => {
    try {
      await favouriteService.removeFavourite(
        req.session.userId,
        req.body.productId
      );

      return res.redirect('/favourites?notice=removed');
    } catch (error) {
      next(error);
    }
  }
);

// ============================================
// Page: remove the products that were ticked (batch delete)
// POST /favourites/remove-batch
// The ticked product ids arrive as productIds[] in the form body.
// ============================================
router.post(
  '/remove-batch',
  requireLogin,
  csrfProtection,
  async (req, res, next) => {
    try {
      const result = await favouriteService.removeFavourites(
        req.session.userId,
        req.body.productIds
      );

      if (result.removed === 0) {
        return res.redirect(
          '/favourites?error=' +
            encodeURIComponent('Please select at least one product.')
        );
      }

      return res.redirect('/favourites?notice=removed');
    } catch (error) {
      next(error);
    }
  }
);

// ============================================
// Page: remove every product from the list
// POST /favourites/clear
// ============================================
router.post(
  '/clear',
  requireLogin,
  csrfProtection,
  async (req, res, next) => {
    try {
      await favouriteService.clearFavourites(req.session.userId);
      return res.redirect('/favourites?notice=cleared');
    } catch (error) {
      next(error);
    }
  }
);

// ============================================
// REST API: read the favourite list
// GET /api/favourites
// Returns { ok: true, items: [...], count: Number }
// ============================================
apiRouter.get('/', requireLogin, async (req, res, next) => {
  try {
    const { items, count } = await favouriteService.getFavourites(
      req.session.userId
    );

    res.json({ ok: true, items, count });
  } catch (error) {
    next(error);
  }
});

// ============================================
// REST API: favourite one product
// POST /api/favourites
// body: { "productId": "product id" }
// Returns 201 { ok: true, favourited: true }
// ============================================
apiRouter.post('/', requireLogin, async (req, res, next) => {
  try {
    const { productId } = req.body;

    const result = await favouriteService.addFavourite(
      req.session.userId,
      productId
    );

    if (!result.ok) {
      return res.status(result.status || 400).json({
        ok: false,
        error: result.error
      });
    }

    return res.status(201).json({
      ok: true,
      favourited: true,
      alreadyFavourited: Boolean(result.alreadyFavourited)
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// REST API: set the state of one product
// PUT /api/favourites/:productId
// body: { "favourited": true }  favourite it
// body: { "favourited": false } unfavourite it
// Returns { ok: true, favourited: Boolean }
// ============================================
apiRouter.put('/:productId', requireLogin, async (req, res, next) => {
  try {
    const { productId } = req.params;
    const favourited = req.body.favourited !== false;

    const result = await favouriteService.setFavourite(
      req.session.userId,
      productId,
      favourited
    );

    if (!result.ok) {
      return res.status(result.status || 400).json({
        ok: false,
        error: result.error
      });
    }

    return res.json({ ok: true, favourited: result.favourited });
  } catch (error) {
    next(error);
  }
});

// ============================================
// REST API: unfavourite one product
// DELETE /api/favourites/:productId
// Returns { ok: true, removed: Number }
// ============================================
apiRouter.delete('/:productId', requireLogin, async (req, res, next) => {
  try {
    const { productId } = req.params;

    const result = await favouriteService.removeFavourite(
      req.session.userId,
      productId
    );

    return res.json({ ok: true, removed: result.removed });
  } catch (error) {
    next(error);
  }
});

// ============================================
// REST API: unfavourite several products at once
// DELETE /api/favourites
// body: { "productIds": ["id 1", "id 2"] }
// Returns { ok: true, removed: Number, productIds: [...] }
// ============================================
apiRouter.delete('/', requireLogin, async (req, res, next) => {
  try {
    const result = await favouriteService.removeFavourites(
      req.session.userId,
      req.body.productIds
    );

    return res.json({
      ok: true,
      removed: result.removed,
      productIds: result.productIds
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// Middleware: load the favourited product ids
// ---------------------------------------------------------------
// The product list page needs to know which products are already
// favourited so the button can say "Favourite" or "Unfavourite".
// The middleware is registered as global middleware in server.js,
// so every page can use res.locals.favouritedIds.
// A visitor who is not logged in simply gets an empty array.
// ============================================
async function loadFavourites(req, res, next) {
  res.locals.favouritedIds = [];

  if (!req.session || !req.session.userId) {
    return next();
  }

  try {
    res.locals.favouritedIds = await favouriteService.getFavouriteIds(
      req.session.userId
    );
  } catch (error) {
    return next(error);
  }

  next();
}

// ============================================
// CSRF error message for this router
// ============================================
router.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).send(
      'Invalid or expired form. Please reload the page and try again.'
    );
  }

  next(err);
});

module.exports = router;
module.exports.apiRouter = apiRouter;
module.exports.loadFavourites = loadFavourites;
