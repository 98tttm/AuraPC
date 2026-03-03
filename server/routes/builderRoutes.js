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
      return res.status(400).json({ error: 'Invalid email' });
    }

    const transporter = getEmailTransporter();
    if (!transporter) {
      return res.status(503).json({ error: 'Email is not configured on the server' });
    }

    const builder = await Builder.findOne(resolveBuilderQuery(id)).lean();
    if (!builder) return res.status(404).json({ error: 'Builder not found' });
    if (!requireBuilderOwnerOrAdmin(builder, req, res, 'email')) return;

    const pdfBuffer = await buildConfigPdf(builder);
    const shareId = builder.shareId || builder._id;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
    const viewUrl = `${frontendUrl}/aura-builder/${shareId}`;

    await transporter.sendMail({
      from: `"AuraPC" <${process.env.EMAIL_USER || process.env.GMAIL_USER}>`,
      to: email.trim(),
      subject: 'AuraPC builder configuration',
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
      <h2 style="margin:0 0 8px;font-size:1.1rem;color:#ffb81c;text-transform:uppercase;letter-spacing:1px;">YOUR PC CONFIGURATION</h2>
      <p style="margin:0 0 20px;color:#ccc;font-size:0.95rem;line-height:1.5;">Thanks for using Aura Builder. Your PDF is attached below.</p>
      <div style="margin:24px 0;">
        <a href="${viewUrl}" style="display:inline-block;padding:14px 28px;background:#ffb81c;color:#000;text-decoration:none;font-weight:700;font-size:0.9rem;border-radius:4px;">VIEW ONLINE</a>
      </div>
      <p style="margin:16px 0 0;font-size:0.8rem;color:#888;">Link: ${viewUrl}</p>
    </div>
    <div style="padding:20px 24px;border-top:1px solid #333;text-align:center;">
      <p style="margin:0;font-size:0.85rem;color:#999;">AuraPC</p>
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

    return res.json({ success: true, message: 'Builder PDF sent successfully' });
  } catch (err) {
    let message = err.message || 'Unable to send email';
    if (err.code === 'EAUTH' || String(message).toLowerCase().includes('invalid login')) {
      message = 'Invalid Gmail credentials. Check EMAIL_USER and EMAIL_PASS.';
    }
    return res.status(500).json({ error: message });
  }
});

module.exports = router;
