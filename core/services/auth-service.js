const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const database = require('../database');

const authService = {
  async hashPassword(password) {
    return bcrypt.hashSync(password, 12); // increased from 10 to 12 rounds
  },

  async verifyPassword(password, hash) {
    return bcrypt.compareSync(password, hash);
  },

  generateToken(user) {
    return jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
  },

  generateRefreshToken(user) {
    return jwt.sign(
      { id: user.id, type: 'refresh' },
      config.jwt.secret,
      { expiresIn: config.jwt.refreshExpiresIn }
    );
  },

  async login(username, password) {
    const user = database.getOne(
      'SELECT * FROM users WHERE (username = ? OR email = ?) AND is_active = 1',
      [username, username]
    );
    if (!user) throw Object.assign(new Error('Invalid credentials'), { status: 401 });

    const valid = await this.verifyPassword(password, user.password_hash);
    if (!valid) throw Object.assign(new Error('Invalid credentials'), { status: 401 });

    database.run('UPDATE users SET last_login = datetime("now") WHERE id = ?', [user.id]);

    const role = database.getOne('SELECT name FROM roles WHERE id = ?', [user.role_id]);
    const token = this.generateToken({ ...user, role: role?.name });
    const refreshToken = this.generateRefreshToken(user);

    return {
      token,
      refreshToken,
      mustChangePassword: !!user.must_change_password,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: role?.name || 'staff',
        branch_id: user.branch_id,
      },
    };
  },

  async changePassword(userId, currentPassword, newPassword) {
    const user = database.getOne('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) throw new Error('User not found');

    const valid = await this.verifyPassword(currentPassword, user.password_hash);
    if (!valid) throw Object.assign(new Error('Current password is incorrect'), { status: 400 });

    if (newPassword.length < 8) throw Object.assign(new Error('Password must be at least 8 characters'), { status: 400 });

    const hash = await this.hashPassword(newPassword);
    database.run('UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = datetime("now") WHERE id = ?', [hash, userId]);
    return true;
  },

  async refreshAccessToken(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, config.jwt.secret);
      if (decoded.type !== 'refresh') throw new Error('Invalid token type');
      const user = database.getOne('SELECT * FROM users WHERE id = ? AND is_active = 1', [decoded.id]);
      if (!user) throw new Error('User not found');
      const role = database.getOne('SELECT name FROM roles WHERE id = ?', [user.role_id]);
      return { token: this.generateToken({ ...user, role: role?.name }) };
    } catch (err) {
      throw Object.assign(new Error('Invalid refresh token'), { status: 401 });
    }
  },

  async createUser({ username, email, password, full_name, role_id, branch_id, mustChangePassword = false }) {
    const hash = await this.hashPassword(password);
    const result = database.run(
      `INSERT INTO users (username, email, password_hash, full_name, role_id, branch_id, must_change_password)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [username, email, hash, full_name || '', role_id || 1, branch_id || null, mustChangePassword ? 1 : 0]
    );
    return result.lastInsertRowid;
  },
};

module.exports = authService;
