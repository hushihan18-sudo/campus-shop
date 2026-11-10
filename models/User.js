const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  nickname: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  contact: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);