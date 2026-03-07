import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

export interface VeAurapcPage {
  slug: string;
  title: string;
  content: { type: 'paragraph' | 'section'; title?: string; text: string }[];
}

const PAGES: VeAurapcPage[] = [
  {
    slug: 'gioi-thieu',
    title: 'Giới thiệu AuraPC',
    content: [
      { type: 'section', title: 'I. Về chúng tôi', text: 'AuraPC là nền tảng thương mại điện tử chuyên cung cấp linh kiện máy tính, PC gaming và thiết bị ngoại vi chất lượng cao tại thị trường Việt Nam. Chúng tôi hướng tới đối tượng game thủ và người dùng yêu cầu hiệu năng, với cam kết hàng chính hãng, bảo hành minh bạch và trải nghiệm mua sắm tin cậy.' },
      { type: 'section', title: 'II. Sứ mệnh', text: 'Với sứ mệnh "Mang công nghệ đỉnh cao đến mọi game thủ", AuraPC không ngừng mở rộng danh mục sản phẩm từ các thương hiệu hàng đầu như Corsair, Razer, ASUS, MSI... Chúng tôi hỗ trợ khách hàng từ tư vấn cấu hình, lắp ráp trọn bộ đến bảo hành hậu mãi, góp phần phát triển cộng đồng gaming Việt.' },
      { type: 'section', title: 'III. Tầm nhìn', text: 'AuraPC hướng tới trở thành địa chỉ mua sắm tin cậy nhất cho game thủ Việt Nam, kết hợp giữa chuyên môn kỹ thuật và trải nghiệm mua sắm trực tuyến hiện đại. Chúng tôi đầu tư vào Aura Builder (cấu hình PC trực tuyến), Aura Hub (cộng đồng chia sẻ) và dịch vụ giao hàng – bảo hành minh bạch để khách hàng an tâm sử dụng sản phẩm lâu dài.' },
    ],
  },
  {
    slug: 'quy-che-hoat-dong',
    title: 'Quy chế hoạt động',
    content: [
      { type: 'paragraph', text: 'Quy chế hoạt động của AuraPC quy định các nguyên tắc sử dụng nền tảng, quyền và nghĩa vụ của người mua và bên bán, nhằm đảm bảo giao dịch minh bạch và bảo vệ quyền lợi hai bên.' },
      { type: 'section', title: '1. Đối tượng áp dụng', text: 'Quy chế áp dụng cho mọi khách hàng đăng ký tài khoản, truy cập website và thực hiện giao dịch trên nền tảng AuraPC, bao gồm mua sắm sản phẩm, sử dụng Aura Builder, tham gia Aura Hub và các dịch vụ liên quan.' },
      { type: 'section', title: '2. Nguyên tắc chung', text: 'Khách hàng cam kết cung cấp thông tin chính xác, tuân thủ pháp luật Việt Nam và không sử dụng nền tảng cho mục đích gian lận hoặc vi phạm quyền sở hữu trí tuệ. AuraPC có quyền từ chối giao dịch hoặc khóa tài khoản nếu phát hiện vi phạm.' },
      { type: 'section', title: '3. Cập nhật', text: 'AuraPC có quyền cập nhật quy chế khi cần thiết. Phiên bản mới sẽ được công bố trên trang này và có hiệu lực từ thời điểm đăng tải trừ khi có quy định khác.' },
    ],
  },
  {
    slug: 'chinh-sach-dat-coc',
    title: 'Chính sách đặt cọc',
    content: [
      { type: 'paragraph', text: 'Chính sách đặt cọc áp dụng cho các đơn hàng đặc biệt: cấu hình PC lắp ráp theo yêu cầu, đơn số lượng lớn hoặc sản phẩm cần đặt trước.' },
      { type: 'section', title: '1. Mức đặt cọc', text: 'Mức đặt cọc thường từ 20% – 50% giá trị đơn hàng, tùy loại sản phẩm và thời gian giao hàng dự kiến. Nhân viên sẽ thông báo cụ thể khi xác nhận đơn.' },
      { type: 'section', title: '2. Thanh toán cọc', text: 'Khách hàng có thể thanh toán cọc qua chuyển khoản ngân hàng, ví MoMo, ZaloPay hoặc thanh toán trực tiếp tại cửa hàng. Đơn hàng chỉ được tiến hành lắp ráp/đặt mua sau khi AuraPC xác nhận đã nhận đủ số tiền cọc.' },
      { type: 'section', title: '3. Hoàn cọc và hủy đơn', text: 'Khi giao hàng thành công, số tiền cọc được trừ vào tổng đơn; khách thanh toán phần còn lại theo phương thức đã chọn. Nếu khách hủy đơn sau khi đã đặt cọc, AuraPC có quyền giữ lại một phần hoặc toàn bộ tiền cọc tùy theo giai đoạn đã thực hiện (đã đặt hàng nhà cung cấp, đã lắp ráp, v.v.) theo thông báo cụ thể khi đặt cọc.' },
    ],
  },
  {
    slug: 'chinh-sach-noi-dung',
    title: 'Chính sách nội dung',
    content: [
      { type: 'paragraph', text: 'Chính sách nội dung quy định cách AuraPC quản lý thông tin đăng tải trên website, blog và cộng đồng Aura Hub.' },
      { type: 'section', title: '1. Nội dung do AuraPC đăng', text: 'Mọi mô tả sản phẩm, bài viết hướng dẫn và tin tức do AuraPC đăng tải nhằm mục đích cung cấp thông tin chính xác, không gây hiểu lầm. AuraPC nỗ lực cập nhật thông tin kịp thời nhưng không đảm bảo mọi chi tiết luôn đúng ở mọi thời điểm; khách hàng nên kiểm tra lại tại trang sản phẩm hoặc liên hệ tổng đài trước khi quyết định mua.' },
      { type: 'section', title: '2. Nội dung người dùng (Aura Hub)', text: 'Nội dung do thành viên đăng trên Aura Hub thuộc trách nhiệm của người đăng. AuraPC có quyền gỡ bỏ hoặc chỉnh sửa nội dung vi phạm pháp luật, quy định cộng đồng hoặc quyền của bên thứ ba mà không cần báo trước.' },
      { type: 'section', title: '3. Bản quyền', text: 'Mọi nội dung trên nền tảng AuraPC (logo, hình ảnh, bài viết do AuraPC đăng) thuộc quyền sở hữu của AuraPC hoặc đối tác được cấp phép. Khách hàng không được sao chép, phân phối hoặc sử dụng thương mại mà không có sự đồng ý bằng văn bản.' },
    ],
  },
  {
    slug: 'chinh-sach-doi-tra',
    title: 'Chính sách đổi trả',
    content: [
      { type: 'paragraph', text: 'AuraPC áp dụng chính sách đổi trả trong vòng 60 ngày đổi trả miễn phí cho sản phẩm đủ điều kiện, nhằm đảm bảo quyền lợi người mua.' },
      { type: 'section', title: '1. Điều kiện đổi trả', text: 'Sản phẩm còn nguyên seal, hộp, phụ kiện; chưa qua sử dụng (hoặc lỗi do nhà sản xuất/nhầm lẫn giao hàng). Một số sản phẩm đặc thù (ví dụ phần mềm đã kích hoạt, đồ đã qua lắp ráp tùy chỉnh) có thể không áp dụng đổi trả – xem tại trang sản phẩm hoặc hỏi bộ phận CSKH.' },
      { type: 'section', title: '2. Thời hạn và cách thức', text: 'Khách hàng liên hệ tổng đài hoặc email trong vòng 60 ngày kể từ ngày nhận hàng để đăng ký đổi trả. AuraPC hướng dẫn thủ tục và địa điểm gửi hàng (nếu áp dụng). Chi phí vận chuyển đổi trả do lỗi nhà sản xuất/nhầm lẫn bên bán do AuraPC chịu; đổi trả do nhu cầu khách hàng có thể do khách thanh toán theo bảng phí được công bố.' },
      { type: 'section', title: '3. Hoàn tiền', text: 'Sau khi kiểm tra và chấp nhận đổi trả, AuraPC hoàn tiền qua phương thức thanh toán ban đầu trong vòng 7–14 ngày làm việc tùy ngân hàng/ví.' },
    ],
  },
  {
    slug: 'chinh-sach-giao-hang',
    title: 'Chính sách giao hàng',
    content: [
      { type: 'paragraph', text: 'AuraPC cam kết giao hàng nhanh chóng, an toàn trong phạm vi hỗ trợ.' },
      { type: 'section', title: '1. Phạm vi và thời gian', text: 'Chúng tôi giao hàng toàn quốc. Thời gian giao dự kiến từ 1–5 ngày làm việc tùy khu vực và loại sản phẩm (có thể dài hơn với đơn lắp ráp trọn bộ). Thời gian cụ thể được hiển thị tại bước thanh toán và có thể được xác nhận lại qua SMS/email.' },
      { type: 'section', title: '2. Phí vận chuyển', text: 'Phí vận chuyển được tính theo địa chỉ nhận và trọng lượng/kích thước đơn hàng. Một số chương trình miễn phí ship theo điều kiện (ví dụ đơn từ một mức giá nhất định) – chi tiết xem tại trang thanh toán hoặc chương trình khuyến mãi hiện hành.' },
      { type: 'section', title: '3. Kiểm tra và nhận hàng', text: 'Khách hàng nên kiểm tra tình trạng bên ngoài thùng hàng trước khi ký nhận. Nếu có dấu hiệu hư hỏng hoặc thiếu hàng, vui lòng ghi rõ trên biên nhận và liên hệ AuraPC ngay để xử lý bảo hiểm/đổi trả theo chính sách.' },
    ],
  },
  {
    slug: 'chinh-sach-bao-mat',
    title: 'Chính sách bảo mật',
    content: [
      { type: 'paragraph', text: 'AuraPC coi trọng bảo mật thông tin khách hàng và áp dụng các biện pháp kỹ thuật cùng quy trình phù hợp để bảo vệ dữ liệu thu thập trên nền tảng.' },
      { type: 'section', title: '1. Thông tin thu thập', text: 'Chúng tôi thu thập thông tin cần thiết cho giao dịch và trải nghiệm dịch vụ: họ tên, số điện thoại, email, địa chỉ giao hàng, lịch sử đơn hàng và tương tác với website. Dữ liệu thanh toán (thẻ, ví) được xử lý qua đối tác cổng thanh toán đạt chuẩn bảo mật.' },
      { type: 'section', title: '2. Mục đích sử dụng', text: 'Thông tin được dùng để xử lý đơn hàng, giao hàng, hỗ trợ khách hàng, gửi thông báo khuyến mãi (nếu bạn đồng ý) và cải thiện trải nghiệm. AuraPC không bán dữ liệu cá nhân cho bên thứ ba vì mục đích tiếp thị.' },
      { type: 'section', title: '3. Bảo vệ và quyền của bạn', text: 'Chúng tôi áp dụng mã hóa (HTTPS), kiểm soát truy cập và quy định nội bộ về bảo mật. Bạn có quyền yêu cầu truy cập, chỉnh sửa hoặc xóa dữ liệu cá nhân theo quy định pháp luật; vui lòng liên hệ qua email hoặc tổng đài.' },
    ],
  },
  {
    slug: 'chinh-sach-thanh-toan',
    title: 'Chính sách thanh toán',
    content: [
      { type: 'paragraph', text: 'AuraPC hỗ trợ nhiều phương thức thanh toán để khách hàng lựa chọn thuận tiện và an toàn.' },
      { type: 'section', title: '1. Các phương thức', text: 'Bao gồm: thanh toán khi nhận hàng (COD), chuyển khoản ngân hàng, ví điện tử (MoMo, ZaloPay), thẻ ATM nội địa/QR và các cổng thanh toán được tích hợp theo từng thời kỳ. Lựa chọn cụ thể hiển thị tại bước thanh toán.' },
      { type: 'section', title: '2. Bảo mật giao dịch', text: 'Giao dịch trực tuyến được thực hiện qua các đối tác cổng thanh toán đạt chuẩn. AuraPC không lưu trữ thông tin thẻ hoặc mật khẩu ví của bạn.' },
      { type: 'section', title: '3. Xác nhận và khiếu nại', text: 'Đơn hàng được xác nhận qua email/SMS sau khi thanh toán thành công. Nếu có sai sót về số tiền hoặc trạng thái thanh toán, vui lòng giữ lại mã giao dịch và liên hệ tổng đài/email để được đối soát.' },
    ],
  },
  {
    slug: 'kiem-tra-hoa-don-dien-tu',
    title: 'Kiểm tra hóa đơn điện tử',
    content: [
      { type: 'paragraph', text: 'AuraPC cung cấp hóa đơn điện tử cho đơn hàng theo quy định pháp luật về hóa đơn điện tử.' },
      { type: 'section', title: '1. Cấp hóa đơn', text: 'Sau khi hoàn tất thanh toán và giao hàng, hóa đơn điện tử (nếu có áp dụng) sẽ được gửi qua email đăng ký của khách hàng hoặc tra cứu trong mục "Đơn hàng" tại tài khoản AuraPC.' },
      { type: 'section', title: '2. Tra cứu và in hóa đơn', text: 'Khách hàng đăng nhập tài khoản, vào mục "Đơn hàng của tôi", chọn đơn cần xem và sử dụng chức năng "Xem / Tải hóa đơn điện tử" (nếu có). Hóa đơn có thể được tải về và in để lưu trữ hoặc xuất trình khi cần.' },
      { type: 'section', title: '3. Khiếu nại', text: 'Nếu thông tin trên hóa đơn không khớp với đơn hàng hoặc chưa nhận được hóa đơn trong thời hạn thông báo, vui lòng liên hệ bộ phận CSKH hoặc email để được hướng dẫn và cấp lại (nếu đủ điều kiện).' },
    ],
  },
  {
    slug: 'chinh-sach-bao-mat-du-lieu-ca-nhan',
    title: 'Chính sách bảo mật dữ liệu cá nhân',
    content: [
      { type: 'paragraph', text: 'Chính sách này bổ sung và chi tiết hóa việc xử lý dữ liệu cá nhân theo Nghị định 13/2023/NĐ-CP (bảo vệ dữ liệu cá nhân) và các quy định pháp luật liên quan.' },
      { type: 'section', title: '1. Dữ liệu cá nhân thu thập', text: 'Bao gồm: định danh (họ tên, số điện thoại, email, địa chỉ), dữ liệu giao dịch (đơn hàng, thanh toán), dữ liệu kỹ thuật (địa chỉ IP, cookie, lịch sử duyệt web trên nền tảng AuraPC). Chúng tôi thu thập qua form đăng ký, đặt hàng, cookie và các kênh hỗ trợ chính thức.' },
      { type: 'section', title: '2. Mục đích và căn cứ pháp lý', text: 'Dữ liệu được xử lý để thực hiện hợp đồng mua bán, giao hàng, chăm sóc khách hàng, marketing (khi có đồng ý), phân tích cải thiện dịch vụ và tuân thủ pháp luật. Căn cứ pháp lý gồm sự đồng ý của bạn, thực hiện hợp đồng và lợi ích chính đáng của AuraPC trong giới hạn pháp luật cho phép.' },
      { type: 'section', title: '3. Quyền của chủ thể dữ liệu', text: 'Bạn có quyền được thông báo, truy cập, chỉnh sửa, xóa hoặc thu hồi đồng ý đối với dữ liệu cá nhân của mình; khiếu nại với AuraPC hoặc cơ quan quản lý nếu cho rằng việc xử lý vi phạm. Để thực hiện quyền, vui lòng gửi yêu cầu qua email hoặc tổng đài; chúng tôi sẽ xử lý trong thời hạn theo quy định.' },
      { type: 'section', title: '4. Lưu trữ và bảo mật', text: 'Dữ liệu được lưu trữ trong môi trường có kiểm soát truy cập và mã hóa phù hợp. Thời gian lưu trữ tương ứng với mục đích (ví dụ hồ sơ giao dịch theo luật thuế, dữ liệu tài khoản cho đến khi bạn yêu cầu xóa). Chúng tôi không chuyển dữ liệu ra nước ngoài trừ khi có căn cứ pháp lý và biện pháp bảo vệ phù hợp.' },
    ],
  },
];

@Component({
  selector: 'app-ve-aurapc',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './ve-aurapc.component.html',
  styleUrl: './ve-aurapc.component.css',
})
export class VeAurapcComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly sidebarItems = PAGES.map(p => ({ slug: p.slug, title: p.title }));

  slug = signal<string | null>(null);
  currentPage = computed(() => {
    const s = this.slug();
    return PAGES.find(p => p.slug === (s || 'gioi-thieu')) ?? PAGES[0];
  });

  constructor() {
    this.route.params.subscribe(params => {
      const slug = params['slug'] as string | undefined;
      this.slug.set(slug || 'gioi-thieu');
    });
  }

  getPageTitle(): string {
    return this.currentPage().title;
  }

  getPageContent() {
    return this.currentPage().content;
  }

  isActive(slug: string): boolean {
    return (this.slug() || 'gioi-thieu') === slug;
  }
}
