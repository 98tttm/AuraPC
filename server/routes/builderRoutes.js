const express = require('express');
const nodemailer = require('nodemailer');
const Builder = require('../models/Builder');
const { buildConfigPdf } = require('../utils/buildPdf');

const router = express.Router();

function getEmailTransporter() {
  const user = process.env.EMAIL_USER || process.env.GMAIL_USER;
  const pass = process.env.EMAIL_PASS || process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
}

const STEPS = ['GPU', 'CPU', 'MB', 'CASE', 'COOLING', 'MEMORY', 'STORAGE', 'PSU', 'FANS', 'MONITOR', 'KEYBOARD', 'MOUSE', 'HEADSET'];

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

/** Lấy chi tiết builder theo shareId hoặc _id */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const isObjectId = /^[a-f\d]{24}$/i.test(id);
    const query = isObjectId ? { _id: id } : { shareId: id };
    const builder = await Builder.findOne(query).lean();
    if (!builder) return res.status(404).json({ error: 'Cấu hình không tồn tại' });
    res.json(builder);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Tạo mới builder */
router.post('/', async (req, res) => {
  try {
    const { components, user } = req.body;
    const builder = new Builder({
      components: components || {},
      user: user || null,
    });
    await builder.save();
    res.status(201).json({ _id: builder._id, shareId: builder.shareId });
  } catch (err) {
    console.error('[Builder] POST error:', err.message, err);
    const msg = err.code === 11000 ? 'ShareId trùng, thử lại' : err.message;
    res.status(400).json({ error: msg });
  }
});

/** Cập nhật component của builder (thêm/sửa 1 bước) */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { step, product } = req.body;
    if (!step || !STEPS.includes(step) || !product) {
      return res.status(400).json({ error: 'Thiếu step hoặc product' });
    }

    const comp = toComponent(product);
    if (!comp) return res.status(400).json({ error: 'Product phải có _id' });

    const isObjectId = /^[a-f\d]{24}$/i.test(id);
    const query = isObjectId ? { _id: id } : { shareId: id };
    const builder = await Builder.findOne(query);
    if (!builder) return res.status(404).json({ error: 'Cấu hình không tồn tại' });

    builder.components = builder.components || {};
    builder.components[step] = comp;
    builder.markModified('components');
    await builder.save();

    console.log(`[Builder] Đã lưu ${step}: ${comp.name} vào builder ${builder._id}`);
    res.json({ _id: builder._id, shareId: builder.shareId, components: builder.components });
  } catch (err) {
    console.error('[Builder] Lỗi PUT:', err);
    res.status(400).json({ error: err.message });
  }
});

/** Gửi PDF cấu hình qua email */
router.post('/:id/email-pdf', async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Email không hợp lệ' });
    }

    const transporter = getEmailTransporter();
    if (!transporter) {
      return res.status(503).json({
        error: 'Chưa cấu hình email. Thêm EMAIL_USER và EMAIL_PASS vào file .env',
      });
    }

    const isObjectId = /^[a-f\d]{24}$/i.test(id);
    const query = isObjectId ? { _id: id } : { shareId: id };
    const builder = await Builder.findOne(query).lean();
    if (!builder) return res.status(404).json({ error: 'Cấu hình không tồn tại' });

    const pdfBuffer = await buildConfigPdf(builder);
    const shareId = builder.shareId || builder._id;

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
    const viewUrl = `${frontendUrl}/aura-builder/${shareId}`;

    await transporter.sendMail({
      from: `"AuraPC" <${process.env.EMAIL_USER || process.env.GMAIL_USER}>`,
      to: email.trim(),
      subject: 'Thông tin cấu hình PC - AuraPC',
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#000;color:#fff;">
  <div style="max-width:600px;margin:0 auto;background:#0c0c0e;">
    <div style="padding:24px;text-align:center;background:#111;border-bottom:1px solid #333;">
      <span style="font-size:1.2rem;font-weight:800;letter-spacing:2px;">AURA PC</span>
    </div>
    <div style="padding:32px 24px;">
      <h2 style="margin:0 0 8px;font-size:1.1rem;color:#ffb81c;text-transform:uppercase;letter-spacing:1px;">CẤU HÌNH PC CỦA BẠN</h2>
      <p style="margin:0 0 20px;color:#ccc;font-size:0.95rem;line-height:1.5;">Cảm ơn bạn đã sử dụng Aura Builder. File PDF thông tin cấu hình được đính kèm bên dưới.</p>
      <div style="margin:24px 0;">
        <a href="${viewUrl}" style="display:inline-block;padding:14px 28px;background:#ffb81c;color:#000;text-decoration:none;font-weight:700;font-size:0.9rem;border-radius:4px;">XEM CẤU HÌNH ONLINE ›</a>
      </div>
      <p style="margin:16px 0 0;font-size:0.8rem;color:#888;">Link cấu hình: ${viewUrl}</p>
    </div>
    <div style="padding:20px 24px;border-top:1px solid #333;text-align:center;">
      <p style="margin:0;font-size:0.85rem;color:#999;">Trân trọng,<br><strong style="color:#fff;">AuraPC</strong></p>
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

    console.log(`[Builder] Đã gửi PDF cấu hình đến ${email}`);
    res.json({ success: true, message: 'Đã gửi thông tin cấu hình đến email của bạn' });
  } catch (err) {
    console.error('[Builder] Email PDF error:', err.message);
    res.status(500).json({ error: err.message || 'Không gửi được email' });
  }
});

module.exports = router;
