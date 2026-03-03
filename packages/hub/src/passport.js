'use strict';

const { OAuth2Client } = require('google-auth-library');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { upsertUser } = require('./services/users');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function setupPassport() {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/google/callback',
    proxy: true,
  }, (accessToken, refreshToken, profile, done) => {
    const user = { id: profile.id, email: profile.emails[0].value, name: profile.displayName };
    upsertUser(user);
    done(null, user);
  }));

  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, user));
}

async function verifyIdToken(idToken) {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: [process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_DEVICE_CLIENT_ID],
  });
  const payload = ticket.getPayload();
  return { id: payload.sub, email: payload.email, name: payload.name || payload.email };
}

module.exports = { setupPassport, verifyIdToken };
