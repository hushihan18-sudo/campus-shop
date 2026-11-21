// ============================================
// 1. Dependencies
// ============================================
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const app = express();

// ============================================
// 2. Connect to MongoDB
// ============================================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// ============================================
// 3. View engine and view folders
//    profile.ejs lives in views/auth/
//    login.ejs and register.ejs live in views/
//    so both folders have to be registered
// ============================================
app.set('view engine', 'ejs');
app.set('views', [
  path.join(__dirname, 'views'),
  path.join(__dirname, 'views/auth')
]);

// ============================================
// 4. Global middleware
// ============================================
app.use(express.urlencoded({ extended: true }));   // parse form POST data
app.use(express.json());                            // parse JSON data
app.use(express.static(path.join(__dirname, 'public'))); // static files (CSS / images)

// ============================================
// 5. Session configuration (keeps the login state)
// ============================================
app.use(session({
  secret: process.env.SESSION_SECRET || 'campus-shop-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24   // 1 day
  }
}));

// Let every EJS template read the current logged in user
app.use((req, res, next) => {
  res.locals.currentUser = req.session.userId ? {
    _id: req.session.userId,
    nickname: req.session.nickname || ''
  } : null;
  next();
});

// ============================================
// 6. CSRF protection
// The product forms in routes/products.js use session based CSRF.
// Global CSRF is not enabled here, every module checks its own routes.
// ============================================

// ============================================
// 7. Routes and middleware
// ============================================
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const { requireLogin } = require('./middleware/auth');
const productRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
const cartApiRoutes = require('./routes/cartApi');
const favouriteRoutes = require('./routes/favourite');

// ============================================
// 8. Route mounting
// ============================================

// Root path: protected, requireLogin redirects to /login when logged out
app.get('/', requireLogin, (req, res) => {
  res.render('home', {
    nickname: req.session.nickname || ''
  });
});

app.use('/', authRoutes);        // /register  /login  /logout
app.use('/profile', profileRoutes); // /profile (view + update)

// Put the favourited product ids into res.locals.favouritedIds.
// It has to run before the page routes, the product page uses it to
// show the Favourite / Unfavourite button.
app.use(favouriteRoutes.loadFavourites);

app.use('/products', productRoutes);

// Cart page routes: /cart  /cart/add/:productId  /cart/remove/:productId
app.use('/cart', cartRoutes);

// Cart REST API: GET/POST /api/cart  PUT/DELETE /api/cart/:productId
app.use('/api/cart', cartApiRoutes);

// Favourite page routes: /favourites  /favourites/toggle
// /favourites/remove  /favourites/remove-batch  /favourites/clear
app.use('/favourites', favouriteRoutes);

// Favourite REST API: GET/POST /api/favourites
// PUT/DELETE /api/favourites/:productId  DELETE /api/favourites
app.use('/api/favourites', favouriteRoutes.apiRouter);

// 404 handling
app.use((req, res) => {
  res.status(404).send('404 - Page Not Found');
});

// Global error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong!');
});

// ============================================
// 9. Start the server
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

module.exports = app;
