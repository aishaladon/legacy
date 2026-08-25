const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'krio-griot-secret-change-in-prod';
const EXPIRY = '7d';

function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
}

function checkPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRY });
}

function verifyToken(token) {
  return jwt.verify(token, SECRET);
}

// Express middleware — attaches req.user or returns 401
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated.' });
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
}

module.exports = { hashPassword, checkPassword, signToken, verifyToken, requireAuth };
