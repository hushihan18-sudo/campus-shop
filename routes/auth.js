const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const router = express.Router();

// Show the register page
router.get('/register', (req, res) => {
  res.render('register', { message: '' });
});

// Handle the register form
router.post('/register', async (req, res) => {
  try {
    const { nickname, email, password, contact } = req.body;

    // Simple validation
    if (!nickname || !email || !password) {
      return res.render('register', { message: 'Nickname, email and password are required.' });
    }

    // Check whether the email is already registered
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render('register', { message: 'This email has already been registered.' });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Save the user in the database
    const newUser = new User({
      nickname,
      email,
      passwordHash,
      contact
    });

    await newUser.save();
    
    // Registered, go back to the login page
    res.redirect('/login');

  } catch (error) {
    console.error(error);
    res.render('register', { message: 'An error occurred during registration. Please try again.' });
  }
});
// Show the login page
router.get('/login', (req, res) => {
    res.render('login', { message: '' });
  });
  
  // Handle the login form
  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;
  
      // Find the user
      const user = await User.findOne({ email });
      if (!user) {
        return res.render('login', { message: 'Email not registered!' });
      }
  
      // Check the password
      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        return res.render('login', { message: 'Incorrect password!' });
      }
  
      // Logged in, store the user id in the session
    // Logged in, store the user id in the session
  req.session.userId = user._id;
  req.session.nickname = user.nickname;

  // Save the session explicitly, redirect after it is stored
  req.session.save((err) => {
    if (err) {
      console.error('Session save error:', err);
      return res.render('login', { message: 'Login failed, please try again.' });
    }
    res.redirect('/profile');
  });
  
    } catch (error) {
      console.error(error);
      res.render('login', { message: 'Login failed, please try again.' });
    }
  });
  
  // Log out
  router.get('/logout', (req, res) => {
    req.session.destroy(() => {
      res.redirect('/login');
    });
  });
module.exports = router;