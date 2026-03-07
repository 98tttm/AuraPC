/**
 * Seed FAQs vào database. Chạy: node server/scripts/seedFaqs.js
 * (từ thư mục gốc dự án: node server/scripts/seedFaqs.js)
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Faq = require('../models/Faq');

const SAMPLE_FAQS = [
  {
    question: 'Làm thế nào để tra cứu đơn hàng của tôi?',
    answer: 'Bạn vào trang Hỗ trợ, mục "Tra mã đơn hàng", nhập mã đơn (dạng AP250307XXXX) rồi bấm Tra cứu. Mã đơn được gửi qua email/SMS khi đặt hàng thành công. Bạn cũng có thể xem toàn bộ đơn trong Tài khoản > Đơn hàng của tôi (sau khi đăng nhập).',
    category: 'don-hang',
    order: 1,
  },
  {
    question: 'Tôi có thể hủy hoặc đổi đơn sau khi đặt không?',
    answer: 'Đơn ở trạng thái "Chờ xác nhận" bạn có thể gửi yêu cầu hủy từ trang Đơn hàng của tôi. Sau khi đơn đã được xác nhận hoặc đang giao, vui lòng liên hệ tổng đài 0987 655 755 để được hướng dẫn. Chính sách đổi trả trong 60 ngày áp dụng cho sản phẩm đủ điều kiện – xem chi tiết tại trang Chính sách đổi trả.',
    category: 'don-hang',
    order: 2,
  },
  {
    question: 'AuraPC có những hình thức thanh toán nào?',
    answer: 'Chúng tôi hỗ trợ thanh toán khi nhận hàng (COD), chuyển khoản ngân hàng, ví MoMo, ZaloPay và thẻ ATM/QR. Bạn chọn phương thức tại bước thanh toán khi đặt hàng.',
    category: 'thanh-toan',
    order: 1,
  },
  {
    question: 'Thời gian giao hàng dự kiến là bao lâu?',
    answer: 'Thông thường từ 1–5 ngày làm việc tùy khu vực. Đơn lắp ráp trọn bộ có thể lâu hơn. Thời gian cụ thể hiển thị tại bước thanh toán và được xác nhận qua SMS/email sau khi đơn được xử lý.',
    category: 'don-hang',
    order: 3,
  },
  {
    question: 'Chính sách bảo hành sản phẩm tại AuraPC như thế nào?',
    answer: 'Sản phẩm được bảo hành theo chính sách của hãng và AuraPC. Bạn giữ hóa đơn và phiếu bảo hành để được hỗ trợ. Một số linh kiện có bảo hành đổi mới trong 30 ngày đầu – chi tiết xem tại trang sản phẩm hoặc liên hệ tổng đài.',
    category: 'bao-hanh',
    order: 1,
  },
  {
    question: 'Làm sao để cấu hình PC với Aura Builder?',
    answer: 'Bạn truy cập mục Aura Builder trên website, chọn từng linh kiện (CPU, main, RAM, VGA, nguồn, vỏ...) theo ngân sách và nhu cầu. Hệ thống gợi ý tương thích và tổng giá. Bạn có thể lưu cấu hình, chia sẻ link hoặc thêm vào giỏ để đặt hàng.',
    category: 'chung',
    order: 1,
  },
  {
    question: 'Tôi quên mật khẩu / không đăng nhập được tài khoản?',
    answer: 'AuraPC dùng đăng nhập bằng số điện thoại và OTP. Bạn nhập số điện thoại đã đăng ký, bấm "Gửi mã" và nhập mã OTP nhận qua SMS. Nếu không nhận được mã hoặc số điện thoại thay đổi, vui lòng liên hệ tổng đài 0987 655 755 hoặc email aurapcservice247@gmail.com để được hỗ trợ.',
    category: 'chung',
    order: 2,
  },
  {
    question: 'Làm thế nào để yêu cầu hóa đơn điện tử?',
    answer: 'Khi đặt hàng bạn có thể chọn "Xuất hóa đơn điện tử" và nhập email nhận hóa đơn. Sau khi đơn được xác nhận, hóa đơn sẽ gửi qua email. Bạn cũng có thể xem và tải hóa đơn trong Tài khoản > Đơn hàng của tôi > Xem chi tiết đơn.',
    category: 'don-hang',
    order: 4,
  },
  {
    question: 'Sản phẩm bị lỗi trong thời gian bảo hành thì xử lý thế nào?',
    answer: 'Bạn liên hệ tổng đài 0987 655 755 hoặc email aurapcservice247@gmail.com, cung cấp mã đơn và mô tả lỗi. Chúng tôi sẽ hướng dẫn bảo hành tại trung tâm hoặc đổi mới tùy chính sách từng sản phẩm. Vui lòng giữ hóa đơn và phiếu bảo hành.',
    category: 'bao-hanh',
    order: 2,
  },
  {
    question: 'Aura Hub là gì và tôi dùng nó như thế nào?',
    answer: 'Aura Hub là cộng đồng do AuraPC tạo ra để bạn chia sẻ kinh nghiệm build máy, hỏi đáp, và kết nối với người chơi cùng sở thích. Bạn đăng nhập bằng tài khoản AuraPC, vào mục Aura Hub trên website để đăng bài, bình luận và theo dõi chủ đề.',
    category: 'chung',
    order: 3,
  },
];

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Thiếu MONGODB_URI trong .env');
    process.exit(1);
  }
  await mongoose.connect(uri);
  const existing = await Faq.countDocuments();
  if (existing > 0) {
    console.log(`Đã có ${existing} FAQ trong DB. Bỏ qua seed (để tránh trùng). Xóa collection Faq nếu muốn seed lại.`);
    await mongoose.disconnect();
    return;
  }
  await Faq.insertMany(SAMPLE_FAQS);
  console.log(`Đã thêm ${SAMPLE_FAQS.length} FAQ mẫu.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
