const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const router = express.Router();

// 显示注册页面
router.get('/register', (req, res) => {
  res.render('register', { message: '' });
});

// 处理注册表单提交
router.post('/register', async (req, res) => {
  try {
    const { nickname, email, password, contact } = req.body;

    // 简单验证
    if (!nickname || !email || !password) {
      return res.render('register', { message: '昵称、邮箱和密码为必填项！' });
    }

    // 检查邮箱是否已存在
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render('register', { message: '该邮箱已经被注册！' });
    }

    // 密码加密（哈希）
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 存入数据库
    const newUser = new User({
      nickname,
      email,
      passwordHash,
      contact
    });

    await newUser.save();
    
    // 注册成功，重定向到登录页
    res.redirect('/login');

  } catch (error) {
    console.error(error);
    res.render('register', { message: 'An error occurred during registration. Please try again.' });
  }
});
// 显示登录页面
router.get('/login', (req, res) => {
    res.render('login', { message: '' });
  });
  
  // 处理登录表单提交
  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;
  
      // 查找用户
      const user = await User.findOne({ email });
      if (!user) {
        return res.render('login', { message: 'Email not registered!' });
      }
  
      // 验证密码
      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        return res.render('login', { message: 'Incorrect password!' });
      }
  
      // 登录成功，把用户ID存入 Session
    // 登录成功，把用户ID存入 Session
  req.session.userId = user._id;
  req.session.nickname = user.nickname;

  // 显式保存 session，保存成功后再重定向
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
  
  // 退出登录
  router.get('/logout', (req, res) => {
    req.session.destroy(() => {
      res.redirect('/login');
    });
  });
module.exports = router;