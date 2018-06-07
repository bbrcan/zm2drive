#!/usr/bin/env node
/**
 * Entrypoint for the tool. Loads code straight from main.js, but performs a
 * runtime babel compilation.
 */

require('babel-register')({
  cache: true,
  only: '/src'
});

require('./src/main.js').default();
