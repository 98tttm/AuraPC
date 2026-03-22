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

// ── Extract JSON from AI output (handles thinking tags, markdown fences, etc.) ──
function extractJSON(raw) {
  let text = raw;

  // 1) Strip <think>...</think> blocks (Qwen3 reasoning mode)
  text = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

  // 2) Extract from markdown code fences: ```json ... ``` or ``` ... ```
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }

  // 3) Try direct JSON.parse
  try {
    return JSON.parse(text);
  } catch (_) {
    // ignore
  }

  // 4) Find first { ... } block using brace matching
  const start = text.indexOf('{');
  if (start !== -1) {
    let depth = 0;
    for (let i = start; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.substring(start, i + 1));
        } catch (_) {
          break;
        }
      }
    }
  }

  return null;
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
    // Load top-level categories (dùng để nhóm sản phẩm)
    const categories = await Category.find({})
      .select('_id name slug category_id parent_id is_active')
      .lean();

    // Build category lookup: map BOTH _id AND category_id → name
    // Products may reference categories by either field
    const catMap = new Map();
    for (const cat of categories) {
      catMap.set(String(cat._id), cat.name);
      if (cat.category_id) {
        catMap.set(String(cat.category_id), cat.name);
      }
    }

    // Load ALL products (DB không dùng active field)
    const products = await Product.find({})
      .select('name slug price old_price brand category_ids category_id primaryCategoryId categoryIds')
      .sort({ featured: -1, createdAt: -1 })
      .lean();

    console.log(`[chatRoutes] Catalog load: ${categories.length} categories, ${products.length} products`);

    // Group products by their FIRST matching category
    // Products may use: category_ids (String[]), category_id (String),
    //                    primaryCategoryId (Number), categoryIds (Number[])
    const grouped = new Map();
    for (const p of products) {
      let catId = 'other';

      // Collect all candidate IDs from different fields
      const candidates = [];
      if (Array.isArray(p.category_ids) && p.category_ids.length) {
        candidates.push(...p.category_ids.map(String));
      }
      if (p.category_id) candidates.push(String(p.category_id));
      if (p.primaryCategoryId != null) candidates.push(String(p.primaryCategoryId));
      if (Array.isArray(p.categoryIds) && p.categoryIds.length) {
        candidates.push(...p.categoryIds.map(String));
      }

      // Use the first candidate that exists in our category map
      for (const cid of candidates) {
        if (catMap.has(cid)) {
          catId = cid;
          break;
        }
      }
      // If nothing matched but we have candidates, use the first one
      if (catId === 'other' && candidates.length > 0) catId = candidates[0];
      if (!grouped.has(catId)) grouped.set(catId, []);
      grouped.get(catId).push(p);
    }

    // SMART SAMPLING: đảm bảo mỗi loại sản phẩm đều có mặt
    // Phân bổ đều cho mỗi category, tổng tối đa 300 sản phẩm
    const MAX_TOTAL = 300;
    const categoryCount = grouped.size;
    const perCategory = Math.max(3, Math.floor(MAX_TOTAL / categoryCount));

    const lines = [];
    lines.push('DANH MỤC SẢN PHẨM CỬA HÀNG AURAPC (chỉ gợi ý từ danh sách này):');

    let totalProducts = 0;
    for (const [catId, prods] of grouped) {
      if (totalProducts >= MAX_TOTAL) break;
      const catName = catMap.get(catId) || 'Khác';
      lines.push(`\n[${catName}]`);
      const limit = Math.min(perCategory, prods.length, MAX_TOTAL - totalProducts);
      for (let i = 0; i < limit; i++) {
        const p = prods[i];
        const priceStr = p.price ? `${(p.price / 1_000_000).toFixed(1)}tr` : '?';
        const oldStr = p.old_price && p.old_price > p.price
          ? ` (gốc ${(p.old_price / 1_000_000).toFixed(1)}tr)`
          : '';
        lines.push(`- ${p.name} | slug: ${p.slug} | ${priceStr}${oldStr}`);
        totalProducts++;
      }
    }

    const result = lines.join('\n');
    console.log(`[chatRoutes] Catalog built: ${totalProducts} products from ${categoryCount} groups, ${result.length} chars`);

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

function isLocalhostWebhook(url) {
  try {
    const u = new URL(url);
    return ['localhost', '127.0.0.1', '0.0.0.0'].includes(u.hostname);
  } catch (_) {
    return false;
  }
}

router.post('/auravisual', requireAuth, async (req, res) => {
  const webhookUrl =
    process.env.AURA_VISUAL_WEBHOOK_URL ||
    (process.env.NODE_ENV !== 'production'
      ? 'http://localhost:5678/webhook/auravisual-trigger'
      : '');
  if (!webhookUrl) {
    return res.status(503).json({ error: 'AURA_VISUAL_WEBHOOK_URL is not configured on the server.' });
  }
  if (process.env.NODE_ENV === 'production' && isLocalhostWebhook(webhookUrl)) {
    return res.status(503).json({
      error:
        'AuraVisual is disabled in production: AURA_VISUAL_WEBHOOK_URL must be a public URL (not localhost). Unset it or set a deployed n8n/tunnel URL.',
    });
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

    // ── System prompt: persona + rules + catalog + output format ──
    const systemPrompt =
      'QUAN TRỌNG: Bạn CHỈ ĐƯỢC trả về DUY NHẤT một JSON object. KHÔNG markdown, KHÔNG giải thích, KHÔNG ``` fences.\n\n' +
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
      '  "assistant_reply": "Câu trả lời (xem quy tắc format bên dưới)",\n' +
      '  "products": [ { "name": "TÊN CHÍNH XÁC từ danh mục", "slug": "SLUG CHÍNH XÁC từ danh mục" } ]\n' +
      '}\n' +
      '- "assistant_reply" luôn phải có. Trong chuỗi JSON dùng \\n cho xuống dòng, dùng **tên sản phẩm** để in đậm.\n' +
      '- "products" là mảng <= 4 phần tử. PHẢI copy đúng name và slug từ danh mục cửa hàng.\n' +
      '- Để "products": [] khi: (1) câu hỏi không liên quan sản phẩm (2) khách không muốn gợi ý (3) chỉ tư vấn kiến thức (4) khách đã từ chối gợi ý trước đó.\n\n' +
      'FORMAT "assistant_reply" KHI GỢI Ý SẢN PHẨM (khi products không rỗng):\n' +
      '1. Một câu mở đầu ngắn (vd: "Dưới đây là một số lựa chọn ... mà bạn có thể tham khảo:").\n' +
      '2. Liệt kê từng sản phẩm theo số thứ tự, mỗi dòng: "1. **Tên sản phẩm**: mô tả ngắn, đặc điểm chính, tầm giá (nếu biết)." — dùng đúng tên từ danh mục, in đậm bằng **.\n' +
      '3. Kết bằng MỘT câu hỏi follow-up để thu hẹp nhu cầu (vd: "Bạn cần bàn phím có dây, không dây hay dạng compact không?").\n' +
      'Giữ câu trả lời gọn, dễ đọc; xuống dòng giữa câu mở đầu, từng mục, và câu hỏi cuối.\n\n' +
      'FORMAT "assistant_reply" KHI KHÔNG GỢI Ý SẢN PHẨM (products: []): trả lời bình thường, ngắn gọn, thân thiện; không cần list đánh số.\n\n' +
      '- KHÔNG được trả thêm chữ nào ngoài JSON (không markdown bọc ngoài, không ``` ).';

    // ── Conversation prompt: history + current message only ──
    const conversationParts = [];
    if (Array.isArray(history)) {
      for (const m of history) {
        if (!m || !m.role || !m.content) continue;
        const prefix = m.role === 'assistant' ? 'AruBot:' : 'Khách:';
        conversationParts.push(`${prefix} ${String(m.content)}`);
      }
    }
    conversationParts.push(`Khách: ${message}\nAruBot (trả JSON, không markdown):`);
    const prompt = conversationParts.join('\n') + ' /no_think';

    // Gọi Replicate qua endpoint predictions (synchronous, Prefer: wait)
    const replicateRes = await axios.post(
      'https://api.replicate.com/v1/predictions',
      {
        version:
          'qwen/qwen3-235b-a22b-instruct-2507:ed6cfb0378aae58d3cae29395120c87477eb4574b7f82ac517ff491c9ae2b768',
        input: {
          system_prompt: systemPrompt,
          prompt,
          max_tokens: 1024,
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
    const parsed = extractJSON(raw);
    if (parsed && typeof parsed === 'object') {
      // AI có thể trả nhiều key khác nhau — chấp nhận tất cả
      const replyField = parsed.assistant_reply || parsed.response || parsed.reply || parsed.message || parsed.answer || parsed.text || '';
      if (typeof replyField === 'string' && replyField.trim()) {
        modelReplyText = replyField.trim();
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

    // Safety net: if modelReplyText still looks like JSON, extract text from it
    if (modelReplyText.startsWith('{') && modelReplyText.includes('"')) {
      try {
        const inner = JSON.parse(modelReplyText);
        if (inner && typeof inner === 'object') {
          const txt = inner.assistant_reply || inner.response || inner.reply || inner.message || inner.answer || inner.text || '';
          if (typeof txt === 'string' && txt.trim()) {
            modelReplyText = txt.trim();
          }
        }
      } catch (_) { /* not JSON, keep as-is */ }
    }

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
        console.log(
          `[chatRoutes] Step 1 (model products): ${modelProducts.length} suggested → ${found.length} matched`
        );
      }

      // 2) Nhận diện intent hỏi sản phẩm dựa trên từ khóa trong câu hỏi
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

      // Chỉ dùng fallback khi:
      // - Model có trả products HOẶC
      // - Câu hỏi hiện tại có nhắc tới từ khóa sản phẩm (nameRegex != null)
      const aiIntendedProducts = modelProducts.length > 0 || !!nameRegex;

      // 3) Fallback: keyword + price range từ message (khi có intent sản phẩm nhưng Step 1 không match)
      if (!found.length && aiIntendedProducts) {
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
          found = await Product.find(query)
            .sort({ featured: -1, createdAt: -1 })
            .limit(4)
            .select(PRODUCT_FIELDS)
            .lean();
          if (!found.length && nameRegex && priceFilter) {
            found = await Product.find({ name: nameRegex })
              .sort({ featured: -1, createdAt: -1 })
              .limit(4)
              .select(PRODUCT_FIELDS)
              .lean();
          }
        }
        console.log(
          `[chatRoutes] Step 2 (keyword fallback): regex=${nameRegex}, priceFilter=${!!priceFilter} → ${found.length} found`
        );
      }

      // 4) Final fallback: chỉ khi CÓ intent sản phẩm nhưng không tìm được gì
      if ((!found || found.length === 0) && aiIntendedProducts) {
        found = await Product.find({})
          .sort({ featured: -1, createdAt: -1 })
          .limit(4)
          .select(PRODUCT_FIELDS)
          .lean();
        console.log(`[chatRoutes] Step 3 (final fallback): ${found.length} found`);
      }

      productsPayload = found.map(formatProduct);
    } catch (e) {
      console.error('[chatRoutes] product suggestion error:', e.message || e);
    }

    // ── Nếu đã có danh sách sản phẩm thực tế, chuẩn hóa lại câu trả lời cho khớp UI ──
    let reply = modelReplyText;
    if (Array.isArray(productsPayload) && productsPayload.length > 0) {
      const intro =
        'Dưới đây là một số lựa chọn sản phẩm phù hợp từ cửa hàng AuraPC mà bạn có thể tham khảo:\n\n';
      const lines = productsPayload.map((p, idx) => {
        const index = idx + 1;
        let priceText = '';
        if (typeof p.price === 'number' && p.price > 0) {
          const millions = p.price / 1_000_000;
          priceText = ` (khoảng ${millions.toFixed(1)} triệu)`;
        }
        let discountText = '';
        if (typeof p.old_price === 'number' && p.old_price > p.price) {
          const discount = Math.round(((p.old_price - p.price) / p.old_price) * 100);
          discountText = ` – hiện đang giảm khoảng ${discount}%`;
        }
        return `${index}. **${p.name}**${priceText}${discountText}.`;
      });
      const outro =
        '\n\nBạn muốn mình tư vấn kỹ hơn về con nào, hoặc cần gợi ý thêm trong tầm giá khác không?';
      reply = intro + lines.join('\n') + outro;
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

    res.json({ reply, products: productsPayload });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
