const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { requireLogin } = require('../middleware/auth');

// 查看个人资料（受保护）
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

// 修改个人资料（受保护）
router.post('/', requireLogin, async (req, res) => {
  try {
    const { nickname, contact, password } = req.body;
    const user = await User.findById(req.session.userId);
    if (!user) return res.redirect('/logout');

    // 只更新填了内容的字段
    if (nickname) user.nickname = nickname;
    if (contact !== undefined) user.contact = contact;

    // 如果填了新密码，才重新哈希
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