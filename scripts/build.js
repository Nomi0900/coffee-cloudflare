// Runs on every deploy. Reads public/brand.js and writes lib/defaults.js (first-start menu and settings for the database).
const fs = require('fs'), vm = require('vm'), path = require('path');
const sb = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'brand.js'), 'utf8'), sb, { timeout: 1000 });
const B = sb.window.BRAND || {}, D = B.defaults || {};
const settings = Object.assign({ shopName: B.name || 'My Coffee Bar', logoText: B.logoText || '', address: '', phone: '', whatsapp: '', hours: '', instagram: '', tiktok: '', currency: 'Rs',
  pickupEnabled: true, deliveryEnabled: false, deliveryFee: 0, freeDeliveryOver: 0, minOrder: 0, deliveryNote: '', onlineEnabled: false, payInstructions: '' }, D.settings || {});
fs.mkdirSync(path.join(__dirname, '..', 'lib'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '..', 'lib', 'defaults.js'), 'export default ' + JSON.stringify({ settings, products: D.products || [] }, null, 1) + ';\n');
console.log('defaults.js written (' + (D.products || []).length + ' products)');
