'use strict';

const { Router } = require('express');
const passport = require('passport');

const router = Router();

router.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login?error=auth' }),
  (req, res) => res.redirect('/')
);

router.post('/auth/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.json({ ok: true });
  });
});

module.exports = router;
