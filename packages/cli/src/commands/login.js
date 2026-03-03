'use strict';

const { getIdToken } = require('../auth');
const config = require('../config');

async function login() {
  await getIdToken(config.DEVICE_CLIENT_ID, config.DEVICE_CLIENT_SECRET);
  process.stderr.write('로그인 성공!\n');
}

module.exports = login;
