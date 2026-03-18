const crypto = require('crypto');

// Helper to safely read and trim env values
function env(name, fallback) {
  const value = process.env[name];
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  return fallback;
}

const config = {
  appId: env('ZALOPAY_APP_ID', '2554'),
  key1: env('ZALOPAY_KEY1', 'sdngKKJmqEMzvh5QQcdD2A9XBSKUNaYn'),
  key2: env('ZALOPAY_KEY2', 'trMrHtvjo6myautxDUiAcYsVtaeQ8nhf'),
  endpoint: env('ZALOPAY_ENDPOINT', 'https://sb-openapi.zalopay.vn/v2/create'),
  queryEndpoint: env('ZALOPAY_QUERY_ENDPOINT', 'https://sb-openapi.zalopay.vn/v2/query'),
  callbackUrl: env('ZALOPAY_CALLBACK_URL', 'http://localhost:3000/api/payment/zalopay/callback'),
  redirectUrl: env('ZALOPAY_REDIRECT_URL', 'http://localhost:4200/checkout-zalopay-return'),
};

/**
 * Generate app_trans_id in format: yymmdd_<unique>
 * @param {string} orderNumber - The order number to include
 */
function generateAppTransId(orderNumber) {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}_${orderNumber}`;
}

/**
 * Create HMAC-SHA256 MAC for create order request.
 * Format: app_id|app_trans_id|app_user|amount|app_time|embed_data|item
 */
function createOrderMac({ app_id, app_trans_id, app_user, amount, app_time, embed_data, item }) {
  const data = `${app_id}|${app_trans_id}|${app_user}|${amount}|${app_time}|${embed_data}|${item}`;
  return crypto.createHmac('sha256', config.key1).update(data).digest('hex');
}

/**
 * Verify callback MAC using key2.
 * mac = HMAC(key2, callback.data)
 */
function verifyCallbackMac(dataStr, mac) {
  const computedMac = crypto.createHmac('sha256', config.key2).update(dataStr).digest('hex');
  return computedMac === mac;
}

/**
 * Create MAC for query order status.
 * Format: app_id|app_trans_id|key1
 */
function createQueryMac(appTransId) {
  const data = `${config.appId}|${appTransId}|${config.key1}`;
  return crypto.createHmac('sha256', config.key1).update(data).digest('hex');
}

/**
 * Build the create order payload for ZaloPay API.
 */
function buildCreatePayload({ orderNumber, amount, description, items, userId, callbackUrl }) {
  const appTransId = generateAppTransId(orderNumber);
  const appTime = Date.now();
  const embedData = JSON.stringify({ redirecturl: config.redirectUrl });
  const itemStr = JSON.stringify(items || []);

  const payload = {
    app_id: parseInt(config.appId, 10),
    app_user: userId || 'AuraPC_User',
    app_trans_id: appTransId,
    app_time: appTime,
    amount: parseInt(amount, 10),
    description: description || `AuraPC - Thanh toan don hang #${orderNumber}`,
    item: itemStr,
    embed_data: embedData,
    bank_code: '',
    callback_url: callbackUrl || config.callbackUrl,
  };

  payload.mac = createOrderMac(payload);
  return payload;
}

function getConfigIssues() {
  const issues = [];
  if (!config.appId) issues.push('Thiếu ZALOPAY_APP_ID trong server/.env.');
  if (!config.key1) issues.push('Thiếu ZALOPAY_KEY1 trong server/.env.');
  if (!config.key2) issues.push('Thiếu ZALOPAY_KEY2 trong server/.env.');
  // Localhost callback is fine for sandbox testing — redirect flow still works.
  // Server-to-server callback won't reach localhost, but the user will be redirected back.
  if (!config.callbackUrl) {
    issues.push('Thiếu ZALOPAY_CALLBACK_URL.');
  }
  return issues;
}

module.exports = {
  config,
  generateAppTransId,
  createOrderMac,
  verifyCallbackMac,
  createQueryMac,
  buildCreatePayload,
  getConfigIssues,
};
