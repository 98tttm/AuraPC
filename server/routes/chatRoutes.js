const express = require('express');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const Product = require('../models/Product');
const Category = require('../models/Category');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ── Cached product catalog for AI prompt ──
let catalogCache = null;
let catalogCacheTime = 0;
const CATALOG_TTL = 10 * 60 * 1000; // 10 phút

async function getProductCatalog() {
  const now = Date.now();
  if (catalogCache && now - catalogCacheTime < CATALOG_TTL) {
    return catalogCache;
  }

  try {
    // Load categories
    const categories = await Category.find({})
      .select('_id name slug is_active')
      .lean();

    // Load products — try active first, fallback to all
    let products = await Product.find({ active: true })
      .select('name slug price old_price brand primaryCategoryId categoryIds')
      .sort({ featured: -1, createdAt: -1 })
      .lean();

    // Nếu không có active products, load tất cả
    if (!products.length) {
      products = await Product.find({})
        .select('name slug price old_price brand primaryCategoryId categoryIds')
        .sort({ createdAt: -1 })
        .lean();
    }

    console.log(`[chatRoutes] Catalog load: ${categories.length} categories, ${products.length} products`);

    // Build category lookup map
    const catMap = new Map();
    for (const cat of categories) {
      catMap.set(String(cat._id), cat.name);
    }

    // Build compact catalog string — limit to avoid prompt overflow
    const lines = [];
    lines.push('DANH MỤC SẢN PHẨM CỬA HÀNG AURAPC (chỉ gợi ý từ danh sách này):');

    // Group by category
    const grouped = new Map();
    for (const p of products) {
      const catId = p.primaryCategoryId != null ? String(p.primaryCategoryId) : 'other';
      if (!grouped.has(catId)) grouped.set(catId, []);
      grouped.get(catId).push(p);
    }

    let totalProducts = 0;
    for (const [catId, prods] of grouped) {
      const catName = catMap.get(catId) || 'Khác';
      lines.push(`\n[${catName}]`);
      for (const p of prods) {
        if (totalProducts >= 200) break; // Giới hạn để prompt không quá dài
        const priceStr = p.price ? `${(p.price / 1_000_000).toFixed(1)}tr` : '?';
        const oldStr = p.old_price && p.old_price > p.price
          ? ` (gốc ${(p.old_price / 1_000_000).toFixed(1)}tr)`
          : '';
        lines.push(`- ${p.name} | slug: ${p.slug} | ${priceStr}${oldStr}`);
        totalProducts++;
      }
      if (totalProducts >= 200) break;
    }

    const result = lines.join('\n');
    console.log(`[chatRoutes] Catalog built: ${totalProducts} products, ${result.length} chars`);

    catalogCache = result;
    catalogCacheTime = now;
    return catalogCache;
  } catch (err) {
    console.error('[chatRoutes] Catalog load error:', err.message);
    return 'DANH MỤC SẢN PHẨM: Không tải được. Hãy gợi ý sản phẩm chung.';
  }
}

// Debug endpoint — xem catalog đang load gì
router.get('/debug-catalog', async (req, res) => {
  try {
    const catalog = await getProductCatalog();
    res.json({
      length: catalog.length,
      preview: catalog.substring(0, 2000),
      full: catalog,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/auravisual', requireAuth, async (req, res) => {
  const webhookUrl = process.env.AURA_VISUAL_WEBHOOK_URL;
  if (!webhookUrl) {
    return res.status(503).json({ error: 'AURA_VISUAL_WEBHOOK_URL is not configured on the server.' });
  }

  const { components } = req.body || {};
  if (!Array.isArray(components) || components.length === 0) {
    return res.status(400).json({ error: 'components is required' });
  }

  try {
    const upstream = await axios.post(
      webhookUrl,
      { components, userId: req.userId },
      { timeout: 120000 }
    );
    return res.json(upstream.data);
  } catch (err) {
    const upstreamMessage =
      err.response?.data?.error ||
      err.response?.data?.message ||
      err.message ||
      'Unknown AuraVisual error';
    return res.status(502).json({ error: `AuraVisual request failed: ${upstreamMessage}` });
  }
});

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

    // Load real product catalog from DB
    const catalog = await getProductCatalog();

    // Ghép system prompt + catalog + lịch sử thành 1 chuỗi prompt
    const parts = [];
    parts.push(
      'Bạn là AruBot, trợ lý tư vấn build PC cho website AuraPC.\n' +
        '- Bạn luôn trả lời ngắn gọn, rõ ràng, thân thiện bằng tiếng Việt.\n' +
        '\n' +
        'QUY TẮC ƯU TIÊN CAO NHẤT:\n' +
        '1. TÔN TRỌNG Ý MUỐN KHÁCH HÀNG: Nếu khách nói không muốn gợi ý sản phẩm, hoặc yêu cầu dừng gợi ý, ' +
        'hoặc chỉ muốn hỏi thông tin/tư vấn chung → trả "products": [] và chỉ trả lời text. ' +
        'Quy tắc này ưu tiên hơn mọi quy tắc khác bên dưới.\n' +
        '2. LINH HOẠT theo ngữ cảnh: Đọc kỹ lịch sử hội thoại để hiểu ý khách. ' +
        'Nếu trước đó khách đã từ chối gợi ý → không gợi ý nữa trừ khi khách HỎI LẠI về sản phẩm.\n' +
        '\n' +
        'QUY TẮC GỢI Ý SẢN PHẨM (chỉ áp dụng khi khách MUỐN xem sản phẩm):\n' +
        '- BẮT BUỘC: Chỉ gợi ý sản phẩm CÓ TRONG danh mục cửa hàng bên dưới. KHÔNG ĐƯỢC bịa tên sản phẩm.\n' +
        '- Khi gợi ý sản phẩm, PHẢI dùng đúng "name" và "slug" từ danh mục.\n' +
        '- KIỂM TRA KỸ danh mục trước khi nói "cửa hàng không có". Nếu danh mục có sản phẩm phù hợp → phải gợi ý.\n' +
        '- Nếu không có sản phẩm ĐÚNG loại khách hỏi nhưng có sản phẩm tương tự → gợi ý và giải thích tại sao phù hợp.\n' +
        '- Ưu tiên gợi ý sản phẩm đúng tầm giá khách yêu cầu.\n' +
        '- Không bịa đặt thông số; nếu không chắc, hãy nói không chắc chắn.\n\n' +
        catalog + '\n\n' +
        'ĐẦU RA BẮT BUỘC:\n' +
        'Luôn trả về DUY NHẤT một JSON object hợp lệ với cấu trúc:\n' +
        '{\n' +
        '  "assistant_reply": "Câu trả lời AruBot hiển thị cho khách (plain text, tiếng Việt).",\n' +
        '  "products": [\n' +
        '    { "name": "TÊN CHÍNH XÁC từ danh mục", "slug": "SLUG CHÍNH XÁC từ danh mục" }\n' +
        '  ]\n' +
        '}\n' +
        '- "assistant_reply" luôn phải có.\n' +
        '- "products" là mảng <= 4 phần tử. PHẢI copy đúng name và slug từ danh mục cửa hàng.\n' +
        '- Để "products": [] khi:\n' +
        '  (1) câu hỏi không liên quan đến sản phẩm (chào hỏi, hỏi thông tin chung, hỏi về chính sách, giao hàng...)\n' +
        '  (2) khách nói KHÔNG muốn nhận gợi ý sản phẩm\n' +
        '  (3) khách chỉ muốn được tư vấn kiến thức, không cần mua\n' +
        '  (4) trong lịch sử hội thoại khách đã từ chối gợi ý và chưa hỏi lại về sản phẩm\n' +
        '- KHÔNG được trả thêm chữ nào ngoài JSON (không markdown, không \`\`\` ).\n\n'
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

    // ── Map model products to real DB products ──
    let productsPayload = [];
    try {
      let found = [];
      const PRODUCT_FIELDS = 'name slug images price old_price';

      // Helper: format product doc to payload
      const formatProduct = (p) => {
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
      };

      // 1) Map theo slug/name do model trả về
      if (modelProducts.length) {
        const seenIds = new Set();
        for (const spec of modelProducts) {
          if (!spec?.name) continue;
          const name = spec.name.trim();
          const slugFromModel = spec.slug || '';

          let doc = null;
          // 1a) Tìm theo slug exact
          if (slugFromModel) {
            doc = await Product.findOne({ slug: slugFromModel }).select(PRODUCT_FIELDS).lean();
          }
          // 1b) Tìm theo tên chính xác
          if (!doc) {
            doc = await Product.findOne({ name: name }).select(PRODUCT_FIELDS).lean();
          }
          // 1c) Tìm theo tên regex
          if (!doc) {
            const baseName = name.split('(')[0].trim();
            const regex = new RegExp(baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            doc = await Product.findOne({ name: regex }).select(PRODUCT_FIELDS).lean();
          }
          // 1d) Fuzzy: tách từ khóa chính
          if (!doc) {
            const stopWords = ['laptop', 'pc', 'máy', 'tính', 'gaming', 'desktop', 'workstation'];
            const words = name
              .replace(/[()[\]\/\\,.-]/g, ' ')
              .split(/\s+/)
              .filter((w) => w.length >= 2 && !stopWords.includes(w.toLowerCase()));
            const keywords = words.slice(0, 3);
            if (keywords.length >= 1) {
              const andConditions = keywords.map((w) => ({
                name: new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
              }));
              doc = await Product.findOne({ $and: andConditions }).select(PRODUCT_FIELDS).lean();
            }
          }
          if (doc && !seenIds.has(String(doc._id))) {
            seenIds.add(String(doc._id));
            found.push(doc);
          }
          if (found.length >= 4) break;
        }
        console.log(`[chatRoutes] Step 1 (model products): ${modelProducts.length} suggested → ${found.length} matched`);
      }

      // Chỉ dùng fallback khi AI CÓ gợi ý sản phẩm nhưng DB không tìm thấy.
      // Nếu AI trả products: [] (không gợi ý), tôn trọng quyết định đó.
      const aiIntendedProducts = modelProducts.length > 0;

      // 2) Fallback: keyword + price range từ message (chỉ khi AI gợi ý nhưng không match)
      if (!found.length && aiIntendedProducts) {
        const text = (message || '').toLowerCase();
        const query = {};
        let nameRegex = null;
        const keywordMap = [
          { keywords: ['bàn phím', 'ban phim', 'keyboard'], regex: /bàn phím|ban phim|keyboard/i },
          { keywords: ['chuột', 'chuot', 'mouse'], regex: /chuột|chuot|mouse/i },
          { keywords: ['màn hình', 'man hinh', 'monitor'], regex: /màn hình|man hinh|monitor/i },
          { keywords: ['cpu', 'vi xử lý', 'processor'], regex: /cpu|vi xử lý|processor/i },
          { keywords: ['vga', 'card màn hình', 'gpu', 'card đồ họa'], regex: /vga|card màn hình|card đồ họa|gpu|geforce|radeon/i },
          { keywords: ['laptop', 'máy tính xách tay'], regex: /laptop|máy tính xách tay/i },
          { keywords: ['ram', 'bộ nhớ'], regex: /ram|bộ nhớ/i },
          { keywords: ['ssd', 'ổ cứng', 'hdd', 'nvme'], regex: /ssd|ổ cứng|hdd|nvme/i },
          { keywords: ['mainboard', 'bo mạch', 'main'], regex: /mainboard|bo mạch|main/i },
          { keywords: ['psu', 'nguồn'], regex: /psu|nguồn/i },
          { keywords: ['case', 'vỏ máy', 'thùng máy'], regex: /case|vỏ máy|thùng máy/i },
          { keywords: ['tản nhiệt', 'cooler', 'fan', 'quạt'], regex: /tản nhiệt|cooler|fan|quạt/i },
          { keywords: ['tai nghe', 'headset', 'headphone'], regex: /tai nghe|headset|headphone/i },
          { keywords: ['ghế', 'ghe', 'chair'], regex: /ghế|ghe|chair/i },
          { keywords: ['bàn', 'desk'], regex: /bàn gaming|bàn máy tính|desk/i },
        ];
        for (const entry of keywordMap) {
          if (entry.keywords.some((kw) => text.includes(kw))) {
            nameRegex = entry.regex;
            break;
          }
        }

        let priceFilter = null;
        const priceMatch = text.match(/(\d+)\s*(triệu|tr)/);
        if (priceMatch) {
          const millions = parseInt(priceMatch[1], 10);
          if (millions > 0 && millions < 500) {
            const target = millions * 1_000_000;
            priceFilter = { price: { $gte: target * 0.7, $lte: target * 1.3 } };
          }
        }

        if (nameRegex || priceFilter) {
          if (nameRegex) query.name = nameRegex;
          if (priceFilter) Object.assign(query, priceFilter);
          found = await Product.find(query).sort({ featured: -1, createdAt: -1 }).limit(4).select(PRODUCT_FIELDS).lean();
          if (!found.length && nameRegex && priceFilter) {
            found = await Product.find({ name: nameRegex }).sort({ featured: -1, createdAt: -1 }).limit(4).select(PRODUCT_FIELDS).lean();
          }
        }
        console.log(`[chatRoutes] Step 2 (keyword fallback): regex=${nameRegex}, priceFilter=${!!priceFilter} → ${found.length} found`);
      }

      // 3) Final fallback: chỉ khi AI gợi ý nhưng không tìm được gì
      if ((!found || found.length === 0) && aiIntendedProducts) {
        found = await Product.find({}).sort({ featured: -1, createdAt: -1 }).limit(4).select(PRODUCT_FIELDS).lean();
        console.log(`[chatRoutes] Step 3 (final fallback): ${found.length} found`);
      }

      productsPayload = found.map(formatProduct);
    } catch (e) {
      console.error('[chatRoutes] product suggestion error:', e.message || e);
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
        console.warn('[chatRoutes] Supabase insert error:', e.message || e);
      }
    }

    res.json({ reply, products: productsPayload, raw: replicateRes.data });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
