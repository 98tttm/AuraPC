const crypto = require('crypto');

const config = {
    partnerCode: process.env.MOMO_PARTNER_CODE || 'MOMOBKUN20180529',
    accessKey: process.env.MOMO_ACCESS_KEY || 'klm05TvNCpe7cgrv',
    secretKey: process.env.MOMO_SECRET_KEY || 'at67qH6mk8g5HI1JT10ZKd9T7k9m2g3P',
    endpoint: process.env.MOMO_ENDPOINT || 'https://test-payment.momo.vn/v2/gateway/api/create',
    redirectUrl: process.env.MOMO_REDIRECT_URL || 'http://localhost:4200/checkout-momo-return',
    ipnUrl: process.env.MOMO_IPN_URL || 'http://localhost:3000/api/payment/momo/ipn',
};

const createSignature = (data) => {
    // Bắt buộc theo đúng danh sách tham số (sort alphabet) từ tài liệu MoMo
    const rawSignature = `accessKey=${config.accessKey}&amount=${data.amount}&extraData=${data.extraData}&ipnUrl=${config.ipnUrl}&orderId=${data.orderId}&orderInfo=${data.orderInfo}&partnerCode=${config.partnerCode}&redirectUrl=${config.redirectUrl}&requestId=${data.requestId}&requestType=${data.requestType}`;

    return crypto
        .createHmac('sha256', config.secretKey)
        .update(rawSignature)
        .digest('hex');
};

const verifyIpnSignature = (data) => {
    // Data received in IPN query
    const rawSignature = `accessKey=${data.accessKey}&amount=${data.amount}&extraData=${data.extraData}&message=${data.message}&orderId=${data.orderId}&orderInfo=${data.orderInfo}&orderType=${data.orderType}&partnerCode=${data.partnerCode}&payType=${data.payType}&requestId=${data.requestId}&responseTime=${data.responseTime}&resultCode=${data.resultCode}&transId=${data.transId}`;

    const signature = crypto
        .createHmac('sha256', config.secretKey)
        .update(rawSignature)
        .digest('hex');

    return signature === data.signature;
};

module.exports = {
    config,
    createSignature,
    verifyIpnSignature,
};
