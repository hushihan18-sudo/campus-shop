const express = require('express');
const csrf = require('csurf');
const Product = require('../models/Product');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();

// Use the existing session to store the CSRF secret, no cookie-parser needed
const csrfProtection = csrf();

const categories = [
  'Books',
  'Electronics',
  'Clothing',
  'Daily Essentials',
  'Sports',
  'Other'
];

// Product list
router.get('/', requireLogin, csrfProtection, async (req, res, next) => {
  try {
    const products = await Product.find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.render('products/index', {
      products,
      csrfToken: req.csrfToken()
    });
  } catch (error) {
    next(error);
  }
});

// Show the publish form
router.get('/new', requireLogin, csrfProtection, (req, res) => {
  res.render('products/new', {
    categories,
    values: {},
    error: '',
    csrfToken: req.csrfToken()
  });
});

// Handle the publish form
router.post('/', requireLogin, csrfProtection, async (req, res, next) => {
  const body = req.body || {};

  // Only accept the listed fields as strings, never the whole req.body
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

  // At most two decimal places, no negative numbers and no other characters
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

      // The seller always comes from the session, it cannot be set by the form
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

// My products: only the products published by the logged in user
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
// Show the edit form: a product can only be edited by its seller
router.get(
  '/:id/edit',
  requireLogin,
  csrfProtection,
  async (req, res, next) => {
    try {
      const { id } = req.params;

      // Check the format of the product id
      if (!/^[a-fA-F0-9]{24}$/.test(id)) {
        return res.status(404).send('Product not found.');
      }

      // Check the product id and the seller together, so nobody can edit a product of somebody else
      const product = await Product.findOne({
        _id: id,
        seller: req.session.userId
      }).lean();

      if (!product) {
        return res.status(404).send(
          'Product not found or you do not have permission to edit it.'
        );
      }

      // Reuse the publish page and fill it with the product information
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
// Save the edit: only the seller of the product can change it
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

    // Only accept the fields that are allowed to change
    const values = {
      title: text(body.title),
      description: text(body.description),
      price: text(body.price),
      category: text(body.category),
      imageUrl: text(body.imageUrl),
      status: text(body.status)
    };

    // Keep the input when the validation fails and stay in edit mode
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
// Delete a product: only the seller of the product can delete it
router.post(
  '/:id/delete',
  requireLogin,
  csrfProtection,
  async (req, res, next) => {
    try {
      const { id } = req.params;

      // Check the format of the product id
      if (!/^[a-fA-F0-9]{24}$/.test(id)) {
        return res.status(404).send('Product not found.');
      }

      // Check the product id and the seller together while deleting
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


// Product detail: registered after the fixed paths like /new
router.get('/:id', requireLogin, csrfProtection, async (req, res, next) => {
  try {
    const { id } = req.params;

    // An invalid id must not cause a database conversion error
    if (!/^[a-fA-F0-9]{24}$/.test(id)) {
      return res.status(404).send('Product not found.');
    }

    const product = await Product.findById(id)
      .populate('seller', 'nickname contact')
      .lean();

    if (!product) {
      return res.status(404).send('Product not found.');
    }

    // Only HTTP/HTTPS addresses are allowed for the image
    let imageUrl = '';

    if (product.imageUrl) {
      try {
        const url = new URL(product.imageUrl);

        if (['http:', 'https:'].includes(url.protocol)) {
          imageUrl = url.href;
        }
      } catch {
        // An invalid image address is not shown
      }
    }

    res.render('products/show', {
      product,
      imageUrl,
      csrfToken: req.csrfToken()
    });
  } catch (error) {
    next(error);
  }
});
// CSRF error message of the product router

router.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).send(
      'Invalid or expired form. Go back, reload the page, and try again.'
    );
  }

  next(err);
});

module.exports = router;