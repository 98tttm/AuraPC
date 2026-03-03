const express = require('express');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const Product = require('../models/Product');

const router = express.Router();

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

/**
 * POST /api/chat
 * Body: { sessionId?: string, userId?: string, message: string, history?: { role: 'user'|'assistant', content: string }[] }
 */
router.post('/', async (req, res, next) => {
  try {
    if (!REPLICATE_API_TOKEN) {
      return res.status(500).json({ error: 'REPLICATE_API_TOKEN is not configured on the server.' });
    }
    const { sessionId, userId, message, history } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required' });
    }

    // Ghép system prompt + lịch sử thành 1 chuỗi prompt cho API text-completion.
    // YÊU CẦU: model phải trả về JSON theo format cố định.
    const parts = [];
    parts.push(
      'Bạn là AruBot, trợ lý tư vấn build PC cho website AuraPC.\n' +
        '- Bạn luôn trả lời ngắn gọn, rõ ràng, ưu tiên gợi ý sản phẩm trong cửa hàng (dựa vào dữ liệu backend/API) và kiến thức build PC ngoài Internet.\n' +
        '- Không bịa đặt thông số; nếu không chắc, hãy nói không chắc chắn.\n' +
        '- Ngôn ngữ mặc định là tiếng Việt.\n\n' +
        'ĐẦU RA BẮT BUỘC:\n' +
        'Luôn trả về DUY NHẤT một JSON object hợp lệ với cấu trúc:\n' +
        '{\n' +
        '  "assistant_reply": "Câu trả lời AruBot hiển thị cho khách (plain text, tiếng Việt).",\n' +
        '  "products": [\n' +
        '    { "name": "Tên sản phẩm 1", "slug": "slug-san-pham-1-hoac-de-trong-neu_khong_biet" },\n' +
        '    { "name": "Tên sản phẩm 2", "slug": "..." }\n' +
        '  ]\n' +
        '}\n' +
        '- "assistant_reply" luôn phải có.\n' +
        '- "products" là mảng <= 4 phần tử, mỗi phần tử có ít nhất trường "name". Nếu không chắc slug, để "".\n' +
        '- KHÔNG được trả thêm chữ nào ngoài JSON (không markdown, không ``` ).\n\n'
    );
    if (Array.isArray(history)) {
      for (const m of history) {
        if (!m || !m.role || !m.content) continue;
        const prefix = m.role === 'assistant' ? 'AruBot:' : 'Khách:';
        parts.push(`${prefix} ${String(m.content)}\n`);
      }
    }
    parts.push(`Khách: ${message}\nAruBot:`);
    const prompt = parts.join('');

    // Gọi Replicate qua endpoint predictions (synchronous, Prefer: wait)
    const replicateRes = await axios.post(
      'https://api.replicate.com/v1/predictions',
      {
        version:
          'qwen/qwen3-235b-a22b-instruct-2507:ed6cfb0378aae58d3cae29395120c87477eb4574b7f82ac517ff491c9ae2b768',
        input: {
          prompt,
          max_tokens: 512,
          temperature: 0.2,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json',
          Prefer: 'wait',
        },
        timeout: 120000,
      }
    );

    const output = replicateRes.data?.output;
    const raw = Array.isArray(output) ? output.join('') : String(output || '');

    let modelReplyText = raw;
    let modelProducts = [];
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (typeof parsed.assistant_reply === 'string' && parsed.assistant_reply.trim()) {
          modelReplyText = parsed.assistant_reply.trim();
        }
        if (Array.isArray(parsed.products)) {
          modelProducts = parsed.products
            .filter((p) => p && typeof p.name === 'string' && p.name.trim())
            .map((p) => ({
              name: p.name.trim(),
              slug: typeof p.slug === 'string' ? p.slug.trim() : '',
            }));
        }
      }
    } catch (e) {
      // Nếu model không trả JSON hợp lệ thì dùng toàn bộ raw làm reply text
      modelReplyText = raw;
    }

    const reply = modelReplyText;

    // Gợi ý sản phẩm: ưu tiên dùng danh sách model trả về (modelProducts). Nếu không có, fallback theo từ khóa trong message.
    let productsPayload = [];
    try {
      let found = [];

      // 1) Ưu tiên map theo products do model trả về (theo name/slug)
      const seenIds = new Set();
      for (const spec of modelProducts) {
        if (!spec?.name) continue;
        const name = spec.name.trim();
        const slugFromModel = spec.slug || '';

        let doc = null;
        if (slugFromModel) {
          doc = await Product.findOne({ active: true, slug: slugFromModel })
            .select('name slug images price old_price')
            .lean();
        }
        if (!doc) {
          // Fallback: tìm theo tên (dùng regex, bỏ phần trong ngoặc cho dễ khớp)
          const baseName = name.split('(')[0].trim();
          const regex = new RegExp(baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
          doc = await Product.findOne({ active: true, name: regex })
            .select('name slug images price old_price')
            .lean();
        }
        if (doc && !seenIds.has(String(doc._id))) {
          seenIds.add(String(doc._id));
          found.push(doc);
        }
        if (found.length >= 4) break;
      }

      // 2) Nếu model không trả danh sách hoặc không map được, dùng fallback keyword từ message
      if (!found.length) {
        const text = (message || '').toLowerCase();
        const query = { active: true };
        let nameRegex = null;
        if (text.includes('bàn phím') || text.includes('ban phim') || text.includes('keyboard')) {
          nameRegex = /bàn phím|ban phim|keyboard/i;
        } else if (text.includes('chuột') || text.includes('chuot') || text.includes('mouse')) {
          nameRegex = /chuột|chuot|mouse/i;
        } else if (text.includes('màn hình') || text.includes('man hinh') || text.includes('monitor')) {
          nameRegex = /màn hình|man hinh|monitor/i;
        } else if (text.includes('cpu') || text.includes('vi xử lý') || text.includes('processor')) {
          nameRegex = /cpu|vi xử lý|processor/i;
        } else if (text.includes('vga') || text.includes('card màn hình') || text.includes('gpu')) {
          nameRegex = /vga|card màn hình|card đồ họa|gpu/i;
        } else if (text.includes('laptop') || text.includes('máy tính xách tay')) {
          nameRegex = /laptop|máy tính xách tay/i;
        }

        if (nameRegex) {
          query.name = nameRegex;
          found = await Product.find(query)
            .sort({ featured: -1, createdAt: -1 })
            .limit(4)
            .select('name slug images price old_price')
            .lean();
        }
      }
      // Fallback: nếu không tìm được theo từ khóa, lấy 4 sản phẩm featured bất kỳ
      if (!found || found.length === 0) {
        found = await Product.find({ active: true })
          .sort({ featured: -1, createdAt: -1 })
          .limit(4)
          .select('name slug images price old_price');
      }

      productsPayload = found.map((p) => {
        let image = '';
        if (Array.isArray(p.images) && p.images.length > 0) {
          const first = p.images[0];
          image = typeof first === 'string' ? first : first?.url || '';
        } else if (p.images && typeof p.images === 'object' && p.images.url) {
          image = p.images.url;
        }
        return {
          id: String(p._id),
          name: p.name,
          slug: p.slug || String(p._id),
          image,
          price: p.price,
          old_price: p.old_price,
        };
      });

      // Nếu vẫn không có sản phẩm nào (DB không khớp), fallback hiển thị theo danh sách model trả về (chỉ tên/slug).
      if (!productsPayload.length && modelProducts.length) {
        productsPayload = modelProducts.slice(0, 4).map((p) => ({
          id: '',
          name: p.name,
          slug: p.slug || '',
          image: '',
          price: null,
          old_price: null,
        }));
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[chatRoutes] product suggestion error:', e.message || e);
    }

    // Best effort: lưu hội thoại vào Supabase nếu đã cấu hình
    if (supabase) {
      const sid = sessionId || `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const rows = [
        { session_id: sid, user_id: userId || null, role: 'user', content: message },
        { session_id: sid, user_id: userId || null, role: 'assistant', content: reply },
      ];
      try {
        await supabase.from('chat_messages').insert(rows);
      } catch (e) {
        // Không làm hỏng trả lời chỉ vì lỗi lưu log
        // eslint-disable-next-line no-console
        console.warn('[chatRoutes] Supabase insert error:', e.message || e);
      }
    }

    res.json({ reply, products: productsPayload, raw: replicateRes.data });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;

