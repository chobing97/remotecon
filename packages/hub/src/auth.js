'use strict';

const { OAuth2Client } = require('google-auth-library');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// passport: 모바일 웹 Google OAuth 설정
function setupPassport() {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/google/callback', // 상대 경로 사용 — 배포 URL에 무관하게 동작
    proxy: true,                          // Railway 등 리버스 프록시 뒤에서 https 유지
  }, (accessToken, refreshToken, profile, done) => {
    done(null, { id: profile.id, email: profile.emails[0].value, name: profile.displayName });
  }));

  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, user));
}

// CLI에서 보내온 Google ID Token을 서버에서 검증
async function verifyIdToken(idToken) {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: [process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_DEVICE_CLIENT_ID],
  });
  const payload = ticket.getPayload();
  return { id: payload.sub, email: payload.email };
}

module.exports = { setupPassport, verifyIdToken };
