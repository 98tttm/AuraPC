const crypto = require('crypto');

// Helper to safely read and trim env values. Trailing spaces/newlines break signatures.
function env(name, fallback) {
    const value = process.env[name];
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
    return fallback;
}

const LEGACY_SAMPLE_CONFIG = Object.freeze({
    partnerCode: 'MOMOBKUN20180529',
    accessKey: 'klm05TvNCpe7cgrv',
    secretKey: 'at67qH6mk8g5HI1JT10ZKd9T7k9m2g3P',
});

const config = {
    partnerCode: env('MOMO_PARTNER_CODE', ''),
    accessKey: env('MOMO_ACCESS_KEY', ''),
    secretKey: env('MOMO_SECRET_KEY', ''),
    endpoint: env('MOMO_ENDPOINT', 'https://test-payment.momo.vn/v2/gateway/api/create'),
    redirectUrl: env('MOMO_REDIRECT_URL', 'http://localhost:4200/checkout-momo-return'),
    ipnUrl: env('MOMO_IPN_URL', 'http://localhost:3000/api/payment/momo/ipn'),
    partnerName: env('MOMO_PARTNER_NAME', ''),
    storeId: env('MOMO_STORE_ID', ''),
    mockMode: ['1', 'true', 'yes', 'on'].includes(env('MOMO_MOCK_MODE', 'false').toLowerCase()),
};

function usesLegacySandboxCredentials() {
    return config.partnerCode === LEGACY_SAMPLE_CONFIG.partnerCode
        && config.accessKey === LEGACY_SAMPLE_CONFIG.accessKey
        && config.secretKey === LEGACY_SAMPLE_CONFIG.secretKey;
}

function isLocalhostUrl(value) {
    try {
        const url = new URL(value);
        return ['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname);
    } catch (_) {
        return false;
    }
}

function getCreateConfigIssues({ paymentMethod, amount } = {}) {
    const issues = [];

    if (config.mockMode) {
        return issues;
    }

    if (!config.partnerCode || !config.accessKey || !config.secretKey) {
        issues.push('Thiếu cấu hình MOMO_PARTNER_CODE / MOMO_ACCESS_KEY / MOMO_SECRET_KEY trong server/.env.');
    }

    if (usesLegacySandboxCredentials()) {
        issues.push('Đang dùng bộ credential sandbox mẫu MOMOBKUN20180529. Hãy thay bằng bộ khóa test của merchant trong MoMo M4B / Business Test Tool.');
    }

    if (!config.redirectUrl) {
        issues.push('Thiếu MOMO_REDIRECT_URL.');
    }

    if (!config.ipnUrl) {
        issues.push('Thiếu MOMO_IPN_URL.');
    } else if (isLocalhostUrl(config.ipnUrl)) {
        // Warn but don't block — redirect flow still works in sandbox without IPN callback.
        console.warn('[MoMo] MOMO_IPN_URL đang là localhost. IPN callback sẽ không hoạt động; redirect flow vẫn OK cho sandbox.');
    }

    if (paymentMethod === 'atm' && Number(amount || 0) < 10000) {
        issues.push('Thanh toán ATM/NAPAS qua MoMo yêu cầu số tiền tối thiểu 10.000 VND.');
    }

    return issues;
}

function buildCreatePayload({
    requestId,
    amount,
    orderId,
    orderInfo,
    extraData = '',
    requestType,
    lang = 'vi',
}) {
    const payload = {
        partnerCode: config.partnerCode,
        requestId,
        amount,
        orderId,
        orderInfo,
        redirectUrl: config.redirectUrl,
        ipnUrl: config.ipnUrl,
        extraData,
        requestType,
        lang,
    };

    if (config.partnerName) payload.partnerName = config.partnerName;
    if (config.storeId) payload.storeId = config.storeId;

    return payload;
}

function createSignature(data) {
    const rawSignature = `accessKey=${config.accessKey}&amount=${data.amount}&extraData=${data.extraData ?? ''}&ipnUrl=${data.ipnUrl}&orderId=${data.orderId}&orderInfo=${data.orderInfo}&partnerCode=${data.partnerCode}&redirectUrl=${data.redirectUrl}&requestId=${data.requestId}&requestType=${data.requestType}`;

    return crypto
        .createHmac('sha256', config.secretKey)
        .update(rawSignature)
        .digest('hex');
}

function verifyIpnSignature(data) {
    const rawSignature = `accessKey=${data.accessKey}&amount=${data.amount}&extraData=${data.extraData}&message=${data.message}&orderId=${data.orderId}&orderInfo=${data.orderInfo}&orderType=${data.orderType}&partnerCode=${data.partnerCode}&payType=${data.payType}&requestId=${data.requestId}&responseTime=${data.responseTime}&resultCode=${data.resultCode}&transId=${data.transId}`;

    const signature = crypto
        .createHmac('sha256', config.secretKey)
        .update(rawSignature)
        .digest('hex');

    return signature === data.signature;
}

module.exports = {
    buildCreatePayload,
    config,
    createSignature,
    getCreateConfigIssues,
    usesLegacySandboxCredentials,
    verifyIpnSignature,
};
