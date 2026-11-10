// ============================================
// 1. 引入依赖
// ============================================
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const csrf = require('csurf');
const path = require('path');
require('dotenv').config();

const app = express();

// ============================================
// 2. 连接 MongoDB
// ============================================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// ============================================
// 3. 视图引擎与视图目录
//    profile.ejs 放在 views/auth/ 下
//    login.ejs / register.ejs 在 views/ 下
//    所以两个目录都要注册
// ============================================
app.set('view engine', 'ejs');
app.set('views', [
  path.join(__dirname, 'views'),
  path.join(__dirname, 'views/auth')
]);

// ============================================
// 4. 全局中间件
// ============================================
app.use(express.urlencoded({ extended: true }));   // 解析表单 POST 数据
app.use(express.json());                            // 解析 JSON 数据
app.use(express.static(path.join(__dirname, 'public'))); // 静态文件（CSS / 图片）

// ============================================
// 5. Session 配置（登录状态保持）
// ============================================
app.use(session({
  secret: process.env.SESSION_SECRET || 'campus-shop-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24   // 1 天
  }
}));

// 让所有 EJS 模板都能直接读到当前登录用户
app.use((req, res, next) => {
  res.locals.currentUser = req.session.userId ? {
    _id: req.session.userId,
    nickname: req.session.nickname || ''
  } : null;
  next();
});

// ============================================
// 6. CSRF 防护（暂时关闭）
//    开启条件：login.ejs / register.ejs / profile.ejs
//    的表单里都加上：
//    <input type="hidden" name="_csrf" value="<%= csrfToken %>">
//    并且在渲染这些页面的路由里传 csrfToken: req.csrfToken()
// ============================================
const csrfProtection = csrf({ cookie: true });
// app.use(csrfProtection);

// ============================================
// 7. 引入路由与中间件
// ============================================
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const { requireLogin } = require('./middleware/auth');

// ============================================
// 8. 路由挂载
// ============================================

// 根路径：受保护，未登录会被 requireLogin 重定向到 /login
app.get('/', requireLogin, (req, res) => {
  res.render('home', {
    nickname: req.session.nickname || ''
  });
});

app.use('/', authRoutes);        // /register  /login  /logout
app.use('/profile', profileRoutes); // /profile（查看 + 修改）

// 404 处理
app.use((req, res) => {
  res.status(404).send('404 - Page Not Found');
});

// 全局错误处理
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong!');
});

// ============================================
// 9. 启动服务器
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

module.exports = app;