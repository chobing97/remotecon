'use strict';

const { verifyIdToken } = require('../passport');

function requireAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

async function requireApiAuth(req, res, next) {
  const idToken = req.headers['authorization']?.replace('Bearer ', '');
  if (!idToken) return res.status(401).json({ error: 'Unauthorized' });

  try {
    req.apiUser = await verifyIdToken(idToken);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = { requireAuth, requireApiAuth };
