const fs = require('fs');
const path = require('path');

// utils.js is a plain script (no module.exports) meant to run as a browser
// <script> tag, attaching `Utils` to the global/window scope. Loading it via
// require() would trap `var Utils` inside CommonJS's module wrapper instead,
// so we read the source and evaluate it indirectly, which the spec always
// runs against the global scope - matching how a real <script> tag behaves.
const createDOMPurify = require('dompurify');
global.marked = require('marked');
global.DOMPurify = createDOMPurify(window);

const utilsSource = fs.readFileSync(
  path.join(__dirname, '../public/js/utils.js'),
  'utf8'
);
(0, eval)(utilsSource);

module.exports = { Utils: global.Utils };
