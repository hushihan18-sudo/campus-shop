const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { requireLogin } = require('../middleware/auth');

// View the profile (protected)
router.get('/', requireLogin, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) return res.redirect('/logout');
    res.render('auth/profile', { user, message: '', success: '' });
  } catch (err) {
    console.error(err);
    res.redirect('/');
  }
});

// Update the profile (protected)
router.post('/', requireLogin, async (req, res) => {
  try {
    const { nickname, contact, password } = req.body;
    const user = await User.findById(req.session.userId);
    if (!user) return res.redirect('/logout');

    // Only update the fields that were filled in
    if (nickname) user.nickname = nickname;
    if (contact !== undefined) user.contact = contact;

    // Only hash again when a new password was entered
    if (password && password.trim() !== '') {
      user.passwordHash = await bcrypt.hash(password, 10);
    }

    await user.save();
    req.session.nickname = nickname;
    res.render('auth/profile', {
      user,
      message: '',
      success: 'Profile updated successfully!'
    });
  } catch (err) {
    console.error(err);
    const user = await User.findById(req.session.userId);
    res.render('auth/profile', {
      user,
      message: 'Update failed, please try again.',
      success: ''
    });
  }
});

module.exports = router;