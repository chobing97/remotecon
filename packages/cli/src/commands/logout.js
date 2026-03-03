'use strict';

const { logout: doLogout } = require('../auth');

function logout() {
  doLogout();
}

module.exports = logout;
