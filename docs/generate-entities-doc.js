const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, LevelFormat, PageBreak } = require('docx');
const fs = require('fs');

const FONT = 'Times New Roman';
const FONT_BODY = 26;
const FONT_SMALL = 22;
const LINE = 340;

const r = (text, opts = {}) => new TextRun({ text, font: FONT, size: opts.size || FONT_BODY, bold: opts.bold, italics: opts.italics, color: opts.color });
const par = (children, opts = {}) => new Paragraph({ spacing: { after: opts.after ?? 100, line: LINE }, alignment: opts.align, indent: opts.indent ? { firstLine: 720 } : undefined, children: Array.isArray(children) ? children : [children] });
const heading = (level, text) => new Paragraph({ heading: [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3][level - 1], spacing: { before: level === 1 ? 400 : 280, after: 160 }, children: [r(text, { size: [32, 28, 26][level - 1], bold: true, color: level === 1 ? '1A237E' : level === 2 ? '283593' : '37474F' })] });

const bdr = { style: BorderStyle.SINGLE, size: 1, color: '999999' };
const borders = { top: bdr, bottom: bdr, left: bdr, right: bdr };
const pad = { top: 50, bottom: 50, left: 80, right: 80 };

function cell(text, width, opts = {}) {
  const runs = [];
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  for (const p of parts) {
    if (p.startsWith('**') && p.endsWith('**')) runs.push(r(p.slice(2, -2), { size: FONT_SMALL, bold: true }));
    else if (p) runs.push(r(p, { size: FONT_SMALL }));
  }
  return new TableCell({
    borders, width: { size: width, type: WidthType.DXA }, margins: pad,
    shading: opts.header ? { fill: 'D5E8F0', type: ShadingType.CLEAR } : undefined,
    children: [new Paragraph({ spacing: { after: 0, line: 280 }, children: runs })],
  });
}

function entityTable(rows) {
  const W = [500, 2200, 1600, 800, 4260];
  const headers = ['#', 'Attribute', 'Data Type', 'Req.', 'Constraints / Description'];
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: W,
    rows: [
      new TableRow({ children: headers.map((h, i) => cell(`**${h}**`, W[i], { header: true })) }),
      ...rows.map((row, idx) => new TableRow({
        children: row.map((c, i) => cell(i === 0 ? String(idx + 1) : c, W[i])),
      })),
    ],
  });
}

function allEntities() {
  const sections = [];
  const s = (...items) => sections.push(...items);

  // 1. USER
  s(heading(2, '1. User'));
  s(par([r('Stores user profile, delivery addresses, and AuraHub social network data. Timestamps: ', { size: FONT_SMALL }), r('createdAt, updatedAt', { size: FONT_SMALL, italics: true })], { indent: true }));
  s(entityTable([
    ['', 'phoneNumber', 'String', 'Y', 'Unique, Trimmed - Login phone number (0xxx / 84xxx)'],
    ['', 'email', 'String', '', 'Default: "" - Contact email'],
    ['', 'username', 'String', '', 'Default: ""'],
    ['', 'profile.fullName', 'String', '', 'Default: "" - Full name'],
    ['', 'profile.dateOfBirth', 'Date', '', 'Default: null - Date of birth'],
    ['', 'profile.gender', 'String', '', 'Default: "" - Gender'],
    ['', 'avatar', 'String', '', 'Default: "" - Avatar URL (/uploads/avatar-*)'],
    ['', 'active', 'Boolean', '', 'Default: true - Account status'],
    ['', 'lastLogin', 'Date', '', 'Default: null - Last login timestamp'],
    ['', 'followers', '[ObjectId]', '', 'Ref: User - List of followers'],
    ['', 'following', '[ObjectId]', '', 'Ref: User - List of following'],
    ['', 'followerCount', 'Number', '', 'Default: 0'],
    ['', 'followingCount', 'Number', '', 'Default: 0'],
    ['', 'hubPosts', '[ObjectId]', '', 'Ref: Post - AuraHub posts'],
    ['', 'hubReposts', '[ObjectId]', '', 'Ref: Post - Reposted posts'],
    ['', 'addresses', '[Address]', '', 'Embedded sub-schema - Delivery addresses'],
  ]));
  s(par([r('Sub-schema Address:', { size: FONT_SMALL, bold: true })], { after: 40 }));
  s(entityTable([
    ['', 'addresses.label', 'String', '', 'Default: "Home" - Label (Home, Office...)'],
    ['', 'addresses.fullName', 'String', 'Y', 'Recipient full name'],
    ['', 'addresses.phone', 'String', 'Y', 'Recipient phone number'],
    ['', 'addresses.city', 'String', '', 'Default: "" - Province/City'],
    ['', 'addresses.district', 'String', '', 'Default: "" - District'],
    ['', 'addresses.ward', 'String', '', 'Default: "" - Ward'],
    ['', 'addresses.address', 'String', '', 'Default: "" - Detailed address'],
    ['', 'addresses.isDefault', 'Boolean', '', 'Default: false - Default address flag'],
  ]));
  s(par([r('Indexes: phoneNumber (unique), email: 1', { size: FONT_SMALL, italics: true })]));

  // 2. ADMIN
  s(heading(2, '2. Admin'));
  s(par([r('Administrator accounts with email/password authentication (bcrypt). Timestamps: ', { size: FONT_SMALL }), r('createdAt, updatedAt', { size: FONT_SMALL, italics: true })], { indent: true }));
  s(entityTable([
    ['', 'email', 'String', 'Y', 'Unique, Trimmed, Lowercase - Login email'],
    ['', 'password', 'String', 'Y', 'Bcrypt hash (salt: 10) - pre-save hook auto-hashes'],
    ['', 'name', 'String', '', 'Default: "Admin" - Display name'],
    ['', 'role', 'String', '', 'Default: "admin" - Role'],
    ['', 'avatar', 'String', '', 'Default: "" - Avatar URL'],
    ['', 'lastLogin', 'Date', '', 'Default: null'],
  ]));
  s(par([r('Methods: pre("save") bcrypt hash, comparePassword(candidate)', { size: FONT_SMALL, italics: true })]));

  // 3. OTP
  s(heading(2, '3. Otp'));
  s(par([r('6-digit OTP codes with auto-deletion after 5 minutes (TTL index). No timestamps.', { size: FONT_SMALL })], { indent: true }));
  s(entityTable([
    ['', 'phoneNumber', 'String', 'Y', 'Unique - Phone number receiving OTP'],
    ['', 'code', 'String', 'Y', '6-digit OTP code'],
    ['', 'createdAt', 'Date', '', 'Default: Date.now - TTL expires: 300s (5 min)'],
  ]));
  s(par([r('TTL Index: createdAt, expireAfterSeconds: 300', { size: FONT_SMALL, italics: true })]));

  // 4. PRODUCT
  s(new Paragraph({ children: [new PageBreak()] }));
  s(heading(2, '4. Product'));
  s(par([r('Product information with flexible schema (strict: false). Timestamps: ', { size: FONT_SMALL }), r('createdAt, updatedAt', { size: FONT_SMALL, italics: true })], { indent: true }));
  s(entityTable([
    ['', 'name', 'String', 'Y', 'Product name'],
    ['', 'slug', 'String', 'Y', 'URL slug (e.g. laptop-asus-rog)'],
    ['', 'description', 'String', '', 'Default: "" - Short description'],
    ['', 'shortDescription', 'String', '', 'Default: "" - Brief description'],
    ['', 'description_html', 'String', '', 'Default: "" - Rich HTML description'],
    ['', 'price', 'Number', 'Y', 'Original price (VND)'],
    ['', 'salePrice', 'Number', '', 'Default: null - Sale price'],
    ['', 'old_price', 'Number', '', 'Default: null - Old price (strikethrough)'],
    ['', 'category', 'Mixed', '', 'Default: null - Category (flexible)'],
    ['', 'category_id', 'String', '', 'Default: "" - Category ID'],
    ['', 'category_ids', '[String]', '', 'Default: [] - Category IDs list'],
    ['', 'primaryCategoryId', 'Number', '', 'Default: null - Primary category ID'],
    ['', 'categoryIds', '[Number]', '', 'Default: [] - Numeric category IDs'],
    ['', 'images', 'Mixed', '', 'Product images (flexible schema)'],
    ['', 'specs', 'Mixed', '', 'Default: {} - Basic specifications'],
    ['', 'techSpecs', 'Mixed', '', 'Default: {} - Detailed technical specs'],
    ['', 'brand', 'String', '', 'Default: "" - Brand (ASUS, MSI...)'],
    ['', 'stock', 'Number', '', 'Default: 0 - Inventory quantity'],
    ['', 'featured', 'Boolean', '', 'Default: false - Featured product flag'],
    ['', 'active', 'Boolean', '', 'Default: true - Visibility toggle'],
    ['', 'warrantyMonths', 'Number', '', 'Default: 24 - Warranty period (months)'],
  ]));
  s(par([r('Indexes: slug:1, category:1, category_id:1, category_ids:1, primaryCategoryId:1, {featured:1, active:1}', { size: FONT_SMALL, italics: true })]));

  // 5. CATEGORY
  s(heading(2, '5. Category'));
  s(par([r('Multi-level product categories (parent-child hierarchy). Strict: true. Timestamps: ', { size: FONT_SMALL }), r('createdAt, updatedAt', { size: FONT_SMALL, italics: true })], { indent: true }));
  s(entityTable([
    ['', '_id', 'Mixed', '', 'ObjectId or Number - Flexible ID'],
    ['', 'category_id', 'String', '', 'Default: "" - External category ID'],
    ['', 'name', 'String', 'Y', 'Category name'],
    ['', 'slug', 'String', 'Y', 'URL slug'],
    ['', 'url', 'String', '', 'Default: ""'],
    ['', 'source_url', 'String', '', 'Default: "" - Source URL'],
    ['', 'parent_id', 'Mixed', '', 'Default: null - Parent category ID'],
    ['', 'level', 'Number', '', 'Default: 0 - Hierarchy level (0=root)'],
    ['', 'product_count', 'Number', '', 'Default: 0 - Number of products'],
    ['', 'product_ids', '[Mixed]', '', 'Default: [] - Product ID list'],
    ['', 'description', 'String', '', 'Default: ""'],
    ['', 'image', 'String', '', 'Default: "" - Category image'],
    ['', 'is_active', 'Boolean', '', 'Default: true'],
    ['', 'display_order', 'Number', '', 'Default: 0 - Sort order'],
    ['', 'meta', 'Mixed', '', 'Default: {} - Additional metadata'],
  ]));

  // 6. ORDER
  s(new Paragraph({ children: [new PageBreak()] }));
  s(heading(2, '6. Order'));
  s(par([r('Orders with embedded items, shipping address, and cancel/return state. Timestamps: ', { size: FONT_SMALL }), r('createdAt, updatedAt', { size: FONT_SMALL, italics: true })], { indent: true }));
  s(entityTable([
    ['', 'orderNumber', 'String', 'Y', 'Unique - Display order number'],
    ['', 'user', 'ObjectId', '', 'Ref: User, Default: null (guest checkout)'],
    ['', 'items', '[OrderItem]', '', 'Embedded sub-schema - Order line items'],
    ['', 'shippingAddress', 'Mixed', '', 'Embedded: fullName, phone, email, address, city, district, ward, note'],
    ['', 'status', 'String', '', 'Enum: pending|confirmed|processing|shipped|delivered|cancelled. Default: pending'],
    ['', 'total', 'Number', 'Y', 'Order total (VND)'],
    ['', 'shippingFee', 'Number', '', 'Default: 0 - Shipping fee'],
    ['', 'discount', 'Number', '', 'Default: 0 - Discount amount'],
    ['', 'appliedPromotion', 'Mixed', '', 'Embedded: code, discountPercent, discountAmount'],
    ['', 'paymentMethod', 'String', '', 'Enum: cod|qr|momo|zalopay|atm. Default: cod'],
    ['', 'isPaid', 'Boolean', '', 'Default: false - Payment status'],
    ['', 'paidAt', 'Date', '', 'Default: null - Payment timestamp'],
    ['', 'zaloPayTransId', 'String', '', 'Default: null - ZaloPay transaction ID'],
    ['', 'shippedAt', 'Date', '', 'Default: null - Shipped timestamp'],
    ['', 'deliveredAt', 'Date', '', 'Default: null - Delivered timestamp'],
    ['', 'cancelledAt', 'Date', '', 'Default: null - Cancelled timestamp'],
    ['', 'cancelRequest', 'RequestState', '', 'Embedded sub-schema - Cancellation request'],
    ['', 'returnRequest', 'RequestState', '', 'Embedded sub-schema - Return/refund request'],
  ]));
  s(par([r('Sub-schema OrderItem:', { size: FONT_SMALL, bold: true })], { after: 40 }));
  s(entityTable([
    ['', 'items.product', 'ObjectId', '', 'Ref: Product'],
    ['', 'items.name', 'String', 'Y', 'Product name (snapshot)'],
    ['', 'items.price', 'Number', 'Y', 'Unit price (snapshot, VND)'],
    ['', 'items.qty', 'Number', 'Y', 'Min: 1 - Quantity'],
    ['', 'items.serialNumber', 'String', '', 'Default: null - Serial number'],
  ]));
  s(par([r('Sub-schema RequestState (for cancelRequest & returnRequest):', { size: FONT_SMALL, bold: true })], { after: 40 }));
  s(entityTable([
    ['', '*.status', 'String', '', 'Enum: none|pending|approved|rejected. Default: none'],
    ['', '*.reason', 'String', '', 'Default: "" - Request reason'],
    ['', '*.requestedAt', 'Date', '', 'Default: null - Request timestamp'],
    ['', '*.resolvedAt', 'Date', '', 'Default: null - Resolution timestamp'],
    ['', '*.resolvedBy', 'ObjectId', '', 'Ref: Admin - Resolving admin'],
    ['', '*.note', 'String', '', 'Default: "" - Admin note'],
  ]));
  s(par([r('Indexes: status:1, createdAt:-1, {user:1,createdAt:-1}, cancelRequest.status:1, returnRequest.status:1, items.serialNumber:1', { size: FONT_SMALL, italics: true })]));

  // 7. CART
  s(heading(2, '7. Cart'));
  s(par([r('Server-side shopping cart (one cart per user, unique constraint). Timestamps: ', { size: FONT_SMALL }), r('createdAt, updatedAt', { size: FONT_SMALL, italics: true })], { indent: true }));
  s(entityTable([
    ['', 'user', 'ObjectId', 'Y', 'Ref: User, Unique - Cart owner'],
    ['', 'items', '[CartItem]', '', 'Embedded - Cart items'],
    ['', 'items.product', 'ObjectId', 'Y', 'Ref: Product'],
    ['', 'items.quantity', 'Number', 'Y', 'Min: 1, Default: 1 - Quantity'],
  ]));

  // 8. PRODUCTREVIEW
  s(heading(2, '8. ProductReview'));
  s(par([r('Product reviews (with rating) and comments, supporting nested replies. Timestamps: ', { size: FONT_SMALL }), r('createdAt, updatedAt', { size: FONT_SMALL, italics: true })], { indent: true }));
  s(entityTable([
    ['', 'product', 'ObjectId', 'Y', 'Ref: Product - Reviewed product'],
    ['', 'user', 'ObjectId', 'Y', 'Ref: User - Reviewer'],
    ['', 'type', 'String', 'Y', 'Enum: review|comment'],
    ['', 'rating', 'Number', '', 'Min: 1, Max: 5 - Star rating (only when type=review)'],
    ['', 'content', 'String', 'Y', 'Trimmed - Review/comment content'],
    ['', 'images', '[String]', '', 'Default: [] - Attached image URLs'],
    ['', 'parent', 'ObjectId', '', 'Ref: ProductReview - null=root, value=reply'],
  ]));
  s(par([r('Indexes: {product:1,parent:1,createdAt:-1}, {product:1,type:1}, {user:1,product:1,type:1}', { size: FONT_SMALL, italics: true })]));

  // 9. BLOG
  s(heading(2, '9. Blog'));
  s(par([r('Blog/news articles. Strict: true. Timestamps: ', { size: FONT_SMALL }), r('createdAt, updatedAt', { size: FONT_SMALL, italics: true })], { indent: true }));
  s(entityTable([
    ['', 'title', 'String', 'Y', 'Article title'],
    ['', 'slug', 'String', 'Y', 'URL slug'],
    ['', 'excerpt', 'String', '', 'Default: "" - Summary'],
    ['', 'content', 'String', '', 'Default: "" - HTML content'],
    ['', 'coverImage', 'String', '', 'Default: "" - Cover image URL'],
    ['', 'author', 'String', '', 'Default: "AuraPC" - Author name'],
    ['', 'published', 'Boolean', '', 'Default: false - Published status'],
    ['', 'publishedAt', 'Date', '', 'Default: null - Publish date'],
  ]));

  // 10. BUILDER
  s(heading(2, '10. Builder (PC Configurator)'));
  s(par([r('PC Builder configurations with 7-day auto-delete (TTL). Timestamps: ', { size: FONT_SMALL }), r('createdAt, updatedAt', { size: FONT_SMALL, italics: true })], { indent: true }));
  s(entityTable([
    ['', 'shareId', 'String', '', 'Unique, Sparse - Auto-generated via crypto.randomBytes (share link)'],
    ['', 'user', 'ObjectId', '', 'Ref: User, Default: null - Config owner'],
    ['', 'components', 'Mixed', '', 'Default: {} - 13 component steps: GPU, CPU, MB, CASE, COOLING, MEMORY, STORAGE, PSU, FANS, MONITOR, KEYBOARD, MOUSE, HEADSET'],
    ['', 'auraVisualImage', 'String', '', 'Default: null - 3D render URL'],
  ]));
  s(par([r('TTL Index: createdAt, expireAfterSeconds: 604800 (7 days). Pre-save: auto-gen shareId', { size: FONT_SMALL, italics: true })]));

  // 11. POST
  s(new Paragraph({ children: [new PageBreak()] }));
  s(heading(2, '11. Post (AuraHub Community)'));
  s(par([r('Community posts with polls, reposts, and moderation workflow. Timestamps: ', { size: FONT_SMALL }), r('createdAt, updatedAt', { size: FONT_SMALL, italics: true })], { indent: true }));
  s(entityTable([
    ['', 'author', 'ObjectId', 'Y', 'Ref: User - Post author'],
    ['', 'content', 'String', '', 'Default: "" - Post content'],
    ['', 'images', '[String]', '', 'Image URLs'],
    ['', 'topic', 'String', '', 'Default: "" - Topic tag (gaming, hardware, review...)'],
    ['', 'status', 'String', '', 'Enum: pending|approved|rejected. Default: approved'],
    ['', 'reviewedBy', 'ObjectId', '', 'Ref: Admin - Moderating admin'],
    ['', 'reviewedAt', 'Date', '', 'Default: null'],
    ['', 'rejectedReason', 'String', '', 'Default: null - Rejection reason'],
    ['', 'likes', '[ObjectId]', '', 'Ref: User - Users who liked'],
    ['', 'likeCount', 'Number', '', 'Default: 0'],
    ['', 'commentCount', 'Number', '', 'Default: 0'],
    ['', 'shareCount', 'Number', '', 'Default: 0'],
    ['', 'repostCount', 'Number', '', 'Default: 0'],
    ['', 'viewCount', 'Number', '', 'Default: 0'],
    ['', 'isRepost', 'Boolean', '', 'Default: false - Is repost flag'],
    ['', 'originalPost', 'ObjectId', '', 'Ref: Post - Original post (if repost)'],
    ['', 'repostedBy', 'ObjectId', '', 'Ref: User - Reposter'],
    ['', 'poll', 'Mixed', '', 'Embedded: options (PollOption[]), endsAt (Date), totalVotes (Number)'],
    ['', 'replyOption', 'String', '', 'Enum: anyone|followers|mentioned. Default: anyone'],
    ['', 'scheduledAt', 'Date', '', 'Default: null - Scheduled publish time'],
    ['', 'isPublished', 'Boolean', '', 'Default: true'],
  ]));
  s(par([r('Sub-schema PollOption:', { size: FONT_SMALL, bold: true })], { after: 40 }));
  s(entityTable([
    ['', 'poll.options.text', 'String', 'Y', 'Option text'],
    ['', 'poll.options.votes', '[ObjectId]', '', 'Ref: User - Voters'],
    ['', 'poll.options.voteCount', 'Number', '', 'Default: 0'],
  ]));

  // 12. HUBCOMMENT
  s(heading(2, '12. HubComment'));
  s(par([r('Nested comments on AuraHub posts. Timestamps: ', { size: FONT_SMALL }), r('createdAt, updatedAt', { size: FONT_SMALL, italics: true })], { indent: true }));
  s(entityTable([
    ['', 'post', 'ObjectId', 'Y', 'Ref: Post - Parent post'],
    ['', 'author', 'ObjectId', 'Y', 'Ref: User - Comment author'],
    ['', 'content', 'String', 'Y', 'Comment content'],
    ['', 'images', '[String]', '', 'Attached images'],
    ['', 'likes', '[ObjectId]', '', 'Ref: User - Users who liked'],
    ['', 'likeCount', 'Number', '', 'Default: 0'],
    ['', 'parentComment', 'ObjectId', '', 'Ref: HubComment - null=root, value=nested reply'],
    ['', 'replyCount', 'Number', '', 'Default: 0'],
  ]));

  // 13. SHARE
  s(heading(2, '13. Share'));
  s(par([r('Tracks AuraHub post shares. Timestamps: ', { size: FONT_SMALL }), r('createdAt, updatedAt', { size: FONT_SMALL, italics: true })], { indent: true }));
  s(entityTable([
    ['', 'post', 'ObjectId', 'Y', 'Ref: Post - Shared post'],
    ['', 'user', 'ObjectId', 'Y', 'Ref: User - User who shared'],
    ['', 'method', 'String', '', 'Enum: copy_link|copy_image|embed. Default: copy_link'],
  ]));

  // 14. PROMOTION
  s(heading(2, '14. Promotion'));
  s(par([r('Discount voucher codes with complex validation. Timestamps: ', { size: FONT_SMALL }), r('createdAt, updatedAt', { size: FONT_SMALL, italics: true })], { indent: true }));
  s(entityTable([
    ['', 'code', 'String', 'Y', 'Unique, Uppercase, Trimmed - Voucher code (e.g. SALE20)'],
    ['', 'description', 'String', '', 'Default: "" - Description'],
    ['', 'discountPercent', 'Number', 'Y', 'Min: 1, Max: 100 - Discount percentage'],
    ['', 'maxDiscountAmount', 'Number', '', 'Default: null - Maximum discount cap (VND)'],
    ['', 'minOrderAmount', 'Number', '', 'Default: 0 - Minimum order amount (VND)'],
    ['', 'maxUsage', 'Number', '', 'Default: null - Total usage limit'],
    ['', 'usedCount', 'Number', '', 'Default: 0 - Times used'],
    ['', 'maxUsagePerUser', 'Number', '', 'Default: 1 - Per-user usage limit'],
    ['', 'startDate', 'Date', 'Y', 'Start date'],
    ['', 'endDate', 'Date', 'Y', 'End date'],
    ['', 'isActive', 'Boolean', '', 'Default: true - Active status'],
  ]));

  // 15. PROMOTIONUSAGE
  s(heading(2, '15. PromotionUsage'));
  s(par([r('Tracks each use of a promotion code. No auto-timestamps.', { size: FONT_SMALL })], { indent: true }));
  s(entityTable([
    ['', 'promotion', 'ObjectId', 'Y', 'Ref: Promotion'],
    ['', 'user', 'ObjectId', 'Y', 'Ref: User'],
    ['', 'order', 'ObjectId', '', 'Ref: Order, Default: null - Associated order'],
    ['', 'usedAt', 'Date', '', 'Default: Date.now - Usage timestamp'],
  ]));

  // 16. USERNOTIFICATION
  s(heading(2, '16. UserNotification'));
  s(par([r('Customer notifications (9 order-related types). Timestamps: ', { size: FONT_SMALL }), r('createdAt, updatedAt', { size: FONT_SMALL, italics: true })], { indent: true }));
  s(entityTable([
    ['', 'user', 'ObjectId', 'Y', 'Ref: User - Recipient'],
    ['', 'type', 'String', 'Y', 'Enum: order_confirmed | order_processing | order_shipped | order_delivered | order_cancelled | order_cancel_approved | order_cancel_rejected | order_return_approved | order_return_rejected'],
    ['', 'title', 'String', 'Y', 'Notification title'],
    ['', 'message', 'String', 'Y', 'Notification message'],
    ['', 'metadata', 'Mixed', '', 'Default: {} - Additional data (orderNumber, etc.)'],
    ['', 'readAt', 'Date', '', 'Default: null - Read timestamp'],
  ]));

  // 17. ADMINNOTIFICATION
  s(heading(2, '17. AdminNotification'));
  s(par([r('Admin notifications (4 types). Timestamps: ', { size: FONT_SMALL }), r('createdAt, updatedAt', { size: FONT_SMALL, italics: true })], { indent: true }));
  s(entityTable([
    ['', 'type', 'String', 'Y', 'Enum: order_new | order_cancel_request | order_return_request | order_delivered'],
    ['', 'order', 'ObjectId', 'Y', 'Ref: Order - Related order'],
    ['', 'orderNumber', 'String', 'Y', 'Order number'],
    ['', 'title', 'String', 'Y', 'Title'],
    ['', 'message', 'String', 'Y', 'Message'],
    ['', 'metadata', 'Mixed', '', 'Default: {} - Additional data'],
    ['', 'readBy', '[ObjectId]', '', 'Ref: Admin - Admins who have read'],
  ]));

  // 18. FAQ
  s(heading(2, '18. Faq'));
  s(par([r('Frequently asked questions grouped by category. Timestamps: ', { size: FONT_SMALL }), r('createdAt, updatedAt', { size: FONT_SMALL, italics: true })], { indent: true }));
  s(entityTable([
    ['', 'question', 'String', 'Y', 'Question text'],
    ['', 'answer', 'String', 'Y', 'Answer text'],
    ['', 'category', 'String', '', 'Default: "general" - Categories: general|orders|payment|warranty|other'],
    ['', 'order', 'Number', '', 'Default: 0 - Display order'],
  ]));

  // 19. SUPPORTCONVERSATION
  s(heading(2, '19. SupportConversation'));
  s(par([r('1-to-1 support conversations (one per user, unique). Strict: true. Timestamps: ', { size: FONT_SMALL }), r('createdAt, updatedAt', { size: FONT_SMALL, italics: true })], { indent: true }));
  s(entityTable([
    ['', 'user', 'ObjectId', 'Y', 'Ref: User, Unique - Customer'],
    ['', 'assignedAdmin', 'ObjectId', '', 'Ref: Admin, Default: null - Assigned admin'],
    ['', 'archived', 'Boolean', '', 'Default: false - Archived status'],
    ['', 'lastMessagePreview', 'String', '', 'Default: "", Trimmed - Last message preview'],
    ['', 'lastMessageBy', 'String', '', 'Enum: user|admin. Default: user'],
    ['', 'lastMessageAt', 'Date', '', 'Default: null - Last message timestamp'],
    ['', 'unreadForAdmin', 'Number', '', 'Default: 0, Min: 0 - Unread count for admin'],
    ['', 'unreadForUser', 'Number', '', 'Default: 0, Min: 0 - Unread count for user'],
  ]));

  // 20. SUPPORTMESSAGE
  s(heading(2, '20. SupportMessage'));
  s(par([r('Messages within support conversations. Strict: true. Timestamps: ', { size: FONT_SMALL }), r('createdAt, updatedAt', { size: FONT_SMALL, italics: true })], { indent: true }));
  s(entityTable([
    ['', 'conversation', 'ObjectId', 'Y', 'Ref: SupportConversation - Parent conversation'],
    ['', 'senderType', 'String', 'Y', 'Enum: user|admin - Sender type'],
    ['', 'senderUser', 'ObjectId', '', 'Ref: User, Default: null - User sender'],
    ['', 'senderAdmin', 'ObjectId', '', 'Ref: Admin, Default: null - Admin sender'],
    ['', 'content', 'String', 'Y', 'Trimmed, MaxLength: 2000 - Message content'],
  ]));

  return sections;
}

async function main() {
  console.log('Generating AuraPC Entity Documentation (English)...');

  const summaryW = [600, 3200, 1600, 3960];
  const summaryHdr = ['#', 'Entity (Model)', 'Attributes', 'Functional Group'];
  const summaryData = [
    ['1', 'User', '19 + 8 (Address)', 'Users & Authentication'],
    ['2', 'Admin', '6', 'Users & Authentication'],
    ['3', 'Otp', '3', 'Users & Authentication'],
    ['4', 'Product', '21', 'Products & Categories'],
    ['5', 'Category', '15', 'Products & Categories'],
    ['6', 'ProductReview', '7', 'Products & Categories'],
    ['7', 'Order', '18 + 5 + 6', 'Orders & Payments'],
    ['8', 'Cart', '4', 'Orders & Payments'],
    ['9', 'Promotion', '11', 'Orders & Payments'],
    ['10', 'PromotionUsage', '4', 'Orders & Payments'],
    ['11', 'Post', '21 + 3 (Poll)', 'AuraHub Community'],
    ['12', 'HubComment', '8', 'AuraHub Community'],
    ['13', 'Share', '3', 'AuraHub Community'],
    ['14', 'Blog', '8', 'Content & Support'],
    ['15', 'Builder', '4', 'Content & Support'],
    ['16', 'SupportConversation', '8', 'Content & Support'],
    ['17', 'SupportMessage', '5', 'Content & Support'],
    ['18', 'Faq', '4', 'Content & Support'],
    ['19', 'UserNotification', '6', 'Notifications'],
    ['20', 'AdminNotification', '7', 'Notifications'],
  ];

  const doc = new Document({
    styles: {
      default: { document: { run: { font: FONT, size: FONT_BODY } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 32, bold: true, font: FONT }, paragraph: { spacing: { before: 400, after: 200 }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 28, bold: true, font: FONT }, paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 1 } },
      ],
    },
    numbering: { config: [{ reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }] },
    sections: [{
      properties: {
        page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } },
      },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [r('AuraPC - Database Entity Documentation', { size: 18, italics: true, color: '999999' })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [r('Page ', { size: 20 }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 20 })] })] }) },
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [r('DATABASE ENTITY SPECIFICATION', { size: 36, bold: true, color: '1A237E' })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [r('AURAPC E-COMMERCE SYSTEM', { size: 28, bold: true, color: '283593' })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 }, children: [r('MongoDB + Mongoose 9.1 - 20 Models', { size: 24, italics: true, color: '666666' })] }),

        heading(1, 'Entity Overview'),
        par([r('The AuraPC system uses MongoDB with 20 Mongoose models, organized into 6 functional groups:', { size: FONT_SMALL })], { indent: true }),

        new Table({
          width: { size: 9360, type: WidthType.DXA }, columnWidths: summaryW,
          rows: [
            new TableRow({ children: summaryHdr.map((h, i) => cell(`**${h}**`, summaryW[i], { header: true })) }),
            ...summaryData.map(row => new TableRow({ children: row.map((c, i) => cell(c, summaryW[i])) })),
          ],
        }),

        new Paragraph({ children: [new PageBreak()] }),
        heading(1, 'Detailed Entity Specifications'),
        ...allEntities(),
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  const outPath = __dirname + '/AuraPC-Dac-Ta-Thuc-The-Du-Lieu.docx';
  fs.writeFileSync(outPath, buffer);
  console.log(`Generated: ${outPath} (${(buffer.length / 1024).toFixed(0)} KB)`);
}

main().catch(err => { console.error('Error:', err); process.exit(1); });
