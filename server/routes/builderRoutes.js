const express = require('express');
const Builder = require('../models/Builder');
const { buildConfigPdf } = require('../utils/buildPdf');
const { getEmailTransporter } = require('../utils/email');
const { requireAuth, requireUserOrAdmin, verifyToken } = require('../middleware/auth');

const router = express.Router();

const STEPS = ['GPU', 'CPU', 'MB', 'CASE', 'COOLING', 'MEMORY', 'STORAGE', 'PSU', 'FANS', 'MONITOR', 'KEYBOARD', 'MOUSE', 'HEADSET'];

function isObjectIdLike(value) {
  return /^[a-f\d]{24}$/i.test(value);
}

function canAccessBuilder(builder, req) {
  if (req.adminId) return true;
  return !!req.userId && !!builder.user && String(builder.user) === String(req.userId);
}

function resolveBuilderQuery(id) {
  return isObjectIdLike(id) ? { _id: id } : { shareId: id };
}

function toComponent(product) {
  if (!product) return null;
  const prodId = product._id != null ? String(product._id) : null;
  if (!prodId) return null;
  return {
    product: prodId,
    name: product.name ?? '',
    slug: product.slug ?? '',
    price: product.price ?? 0,
    images: product.images ?? [],
    specs: product.specs ?? product.techSpecs ?? {},
  };
}

function requireBuilderOwnerOrAdmin(builder, req, res, action) {
  if (canAccessBuilder(builder, req)) return true;
  res.status(403).json({ error: `You do not have permission to ${action} this builder` });
  return false;
}

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const query = resolveBuilderQuery(id);
    const builder = await Builder.findOne(query).lean();
    if (!builder) return res.status(404).json({ error: 'Builder not found' });

    if (isObjectIdLike(id)) {
      const decoded = verifyToken(req);
      if (!decoded) return res.status(401).json({ error: 'Unauthorized' });
      if (decoded.isAdmin && decoded.adminId) req.adminId = decoded.adminId;
      else if (decoded.userId) req.userId = decoded.userId;
      else return res.status(401).json({ error: 'Unauthorized' });

      if (!requireBuilderOwnerOrAdmin(builder, req, res, 'view')) return;
      return res.json(builder);
    }

    const { user, ...sharedBuilder } = builder;
    return res.json(sharedBuilder);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { components } = req.body || {};
    const builder = new Builder({
      components: components || {},
      user: req.userId,
    });
    await builder.save();
    return res.status(201).json({ _id: builder._id, shareId: builder.shareId });
  } catch (err) {
    const message = err.code === 11000 ? 'ShareId collision, try again' : err.message;
    return res.status(400).json({ error: message });
  }
});

router.put('/:id', requireUserOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { step, product } = req.body || {};
    if (!step || !STEPS.includes(step) || !product) {
      return res.status(400).json({ error: 'Missing step or product' });
    }

    const comp = toComponent(product);
    if (!comp) return res.status(400).json({ error: 'Product must include _id' });

    const builder = await Builder.findOne(resolveBuilderQuery(id));
    if (!builder) return res.status(404).json({ error: 'Builder not found' });
    if (!requireBuilderOwnerOrAdmin(builder, req, res, 'modify')) return;

    builder.components = builder.components || {};
    builder.components[step] = comp;
    builder.markModified('components');
    await builder.save();

    return res.json({ _id: builder._id, shareId: builder.shareId, components: builder.components });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.put('/:id/auravisual', requireUserOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { imageUrl } = req.body || {};

    const builder = await Builder.findOne(resolveBuilderQuery(id));
    if (!builder) return res.status(404).json({ error: 'Builder not found' });
    if (!requireBuilderOwnerOrAdmin(builder, req, res, 'modify')) return;

    builder.auraVisualImage = imageUrl;
    await builder.save();

    return res.json({ success: true, auraVisualImage: builder.auraVisualImage });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/:id/email-pdf', requireUserOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body || {};
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Vui lòng nhập email hợp lệ.' });
    }

    const transporter = getEmailTransporter();
    if (!transporter) {
      return res.status(503).json({ error: 'Chưa cấu hình email trên server. Vui lòng thêm EMAIL_USER và EMAIL_PASS.' });
    }

    const builder = await Builder.findOne(resolveBuilderQuery(id)).lean();
    if (!builder) return res.status(404).json({ error: 'Không tìm thấy cấu hình builder.' });
    if (!requireBuilderOwnerOrAdmin(builder, req, res, 'email')) return;

    const pdfBuffer = await buildConfigPdf(builder);
    const shareId = builder.shareId || builder._id;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
    const viewUrl = `${frontendUrl}/aura-builder/${shareId}`;

    // Build components summary for email body
    const STEP_LABELS = {
      GPU: 'VGA', CPU: 'CPU', MB: 'Bo mạch chủ', CASE: 'Vỏ case',
      COOLING: 'Tản nhiệt', MEMORY: 'RAM', STORAGE: 'Ổ cứng', PSU: 'Nguồn',
      FANS: 'Quạt', MONITOR: 'Màn hình', KEYBOARD: 'Bàn phím', MOUSE: 'Chuột', HEADSET: 'Tai nghe',
    };
    const components = builder.components || {};
    let componentsHtml = '';
    let total = 0;
    for (const [step, label] of Object.entries(STEP_LABELS)) {
      const comp = components[step];
      if (comp && comp.name) {
        const price = Number(comp.price) || 0;
        total += price;
        const priceStr = price > 0 ? Number(price).toLocaleString('vi-VN') + 'đ' : 'Liên hệ';
        componentsHtml += `
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #222;color:#aaa;font-size:0.85rem;">${label}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #222;color:#fff;font-size:0.85rem;">${comp.name}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #222;color:#ffb81c;font-size:0.85rem;text-align:right;white-space:nowrap;">${priceStr}</td>
          </tr>`;
      }
    }
    const totalStr = total > 0 ? Number(total).toLocaleString('vi-VN') + 'đ' : 'Liên hệ';

    await transporter.sendMail({
      from: `"AuraPC" <${process.env.EMAIL_USER || process.env.GMAIL_USER}>`,
      to: email.trim(),
      subject: 'Cấu hình PC của bạn — AuraPC Builder',
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#000;color:#fff;">
  <div style="max-width:600px;margin:0 auto;background:#0c0c0e;">
    <div style="padding:24px 24px 20px;text-align:center;background:linear-gradient(135deg,#1a1a2e,#0c0c0e);border-bottom:2px solid #ffb81c;">
      <span style="font-size:1.4rem;font-weight:800;letter-spacing:3px;color:#fff;">AURA</span><span style="font-size:1.4rem;font-weight:800;letter-spacing:3px;color:#ffb81c;">PC</span>
      <p style="margin:6px 0 0;font-size:0.75rem;color:#666;letter-spacing:1px;text-transform:uppercase;">Aura Builder Configuration</p>
    </div>
    <div style="padding:28px 24px;">
      <h2 style="margin:0 0 6px;font-size:1rem;color:#ffb81c;text-transform:uppercase;letter-spacing:1px;">Cấu hình PC của bạn</h2>
      <p style="margin:0 0 20px;color:#999;font-size:0.85rem;">File PDF đính kèm bên dưới. Bạn cũng có thể xem online:</p>

      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <thead>
          <tr style="border-bottom:2px solid #ffb81c;">
            <th style="padding:8px 12px;text-align:left;color:#ffb81c;font-size:0.8rem;text-transform:uppercase;">Loại</th>
            <th style="padding:8px 12px;text-align:left;color:#ffb81c;font-size:0.8rem;text-transform:uppercase;">Sản phẩm</th>
            <th style="padding:8px 12px;text-align:right;color:#ffb81c;font-size:0.8rem;text-transform:uppercase;">Giá</th>
          </tr>
        </thead>
        <tbody>${componentsHtml}</tbody>
        <tfoot>
          <tr>
            <td colspan="2" style="padding:12px;text-align:right;color:#fff;font-weight:700;font-size:0.95rem;border-top:2px solid #333;">TỔNG CỘNG</td>
            <td style="padding:12px;text-align:right;color:#ffb81c;font-weight:700;font-size:0.95rem;border-top:2px solid #333;">${totalStr}</td>
          </tr>
        </tfoot>
      </table>

      <div style="text-align:center;margin:24px 0;">
        <a href="${viewUrl}" style="display:inline-block;padding:14px 32px;background:#ffb81c;color:#000;text-decoration:none;font-weight:700;font-size:0.9rem;border-radius:6px;letter-spacing:0.5px;">XEM ONLINE</a>
      </div>
      <p style="text-align:center;font-size:0.75rem;color:#555;">Link: ${viewUrl}</p>
    </div>
    <div style="padding:16px 24px;border-top:1px solid #222;text-align:center;">
      <p style="margin:0;font-size:0.8rem;color:#666;">AuraPC — Gaming PC & Linh kiện chính hãng</p>
    </div>
  </div>
</body>
</html>
      `,
      attachments: [
        {
          filename: `cau-hinh-AuraPC-${shareId}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    return res.json({ success: true, message: 'Đã gửi email thành công!' });
  } catch (err) {
    let message = err.message || 'Không gửi được email.';
    if (err.code === 'EAUTH' || String(message).toLowerCase().includes('invalid login')) {
      message = 'Sai thông tin Gmail. Kiểm tra EMAIL_USER và EMAIL_PASS (App Password).';
    }
    if (err.code === 'ESOCKET' || err.code === 'ECONNECTION') {
      message = 'Không kết nối được Gmail SMTP. Kiểm tra kết nối mạng server.';
    }
    return res.status(500).json({ error: message });
  }
});

module.exports = router;
