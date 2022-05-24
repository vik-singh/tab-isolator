'use strict'

module.exports = {
  '*.js': ['eslint --quiet --fix'],
  '*.{json,js,md}': ['prettier --write']
}
