const { h1, h2, h3, h4, p, bullet, numberedItem, spacer, pageBreak, makeTable, figureCaption } = require('./report-helpers');

module.exports = function chapter1() {
  return [
    h1('CHƯƠNG 1: TỔNG QUAN'),
    pageBreak(),

    // ===== 1.1 =====
    h2('1.1. Tổng quan về đồ án'),

    h3('1.1.1. Lý do chọn đề tài'),
    p('Trong những năm gần đây, ngành công nghiệp game và thể thao điện tử (esports) tại Việt Nam đã có sự phát triển vượt bậc. Theo báo cáo của Newzoo, Việt Nam nằm trong top 30 thị trường game lớn nhất thế giới với hơn 30 triệu người chơi game, trong đó phân khúc PC gaming chiếm tỷ trọng đáng kể. Sự gia tăng nhu cầu về phần cứng máy tính chuyên dụng cho gaming đã tạo ra một thị trường tiềm năng cho các nền tảng thương mại điện tử chuyên biệt.', { indent: true }),
    p('Tuy nhiên, trải nghiệm mua sắm linh kiện PC gaming trực tuyến tại Việt Nam hiện nay vẫn còn nhiều hạn chế. Phần lớn các website thương mại điện tử hiện tại thiếu công cụ hỗ trợ lắp ráp cấu hình PC (PC Builder), không có chatbot AI tư vấn sản phẩm thông minh, và giao diện chưa tối ưu cho trải nghiệm người dùng trên nền tảng di động. Ngoài ra, tính năng trực quan hóa 3D sản phẩm vẫn chưa được áp dụng phổ biến trong lĩnh vực này.', { indent: true }),
    p('Xuất phát từ thực tế trên, nhóm đã quyết định thực hiện đồ án **"Xây dựng website thương mại điện tử AuraPC — Nền tảng mua sắm PC Gaming"** nhằm giải quyết những thiếu sót trong trải nghiệm mua sắm linh kiện PC trực tuyến. Đồ án kết hợp các công nghệ web hiện đại bao gồm Angular, Node.js, MongoDB, Three.js và tích hợp AI chatbot để tạo ra một nền tảng thương mại điện tử toàn diện, đáp ứng nhu cầu thực tiễn của thị trường Việt Nam.', { indent: true }),
    p('Các lý do cụ thể cho việc lựa chọn đề tài bao gồm:', { indent: true }),
    bullet('**Nhu cầu thị trường rõ ràng:** Thị trường PC gaming Việt Nam tăng trưởng mạnh, đặc biệt sau đại dịch COVID-19 khi nhu cầu làm việc và giải trí tại nhà tăng cao.'),
    bullet('**Thiếu nền tảng chuyên biệt:** Các sàn TMĐT lớn (Shopee, Lazada) không có công cụ chuyên biệt cho phân khúc PC gaming như PC Builder, so sánh cấu hình, hay tư vấn AI.'),
    bullet('**Cơ hội áp dụng công nghệ mới:** Đồ án là môi trường lý tưởng để nghiên cứu và ứng dụng các công nghệ tiên tiến như 3D visualization (Three.js), AI chatbot (Qwen 3), thanh toán trực tuyến (MoMo, ZaloPay), và real-time communication (Socket.IO).'),
    bullet('**Giá trị thực tiễn cao:** Sản phẩm đầu ra có thể được triển khai thực tế, phục vụ nhu cầu mua sắm của cộng đồng game thủ Việt Nam.'),
    spacer(),

    h3('1.1.2. Mục tiêu đồ án'),
    p('Đồ án đặt ra các mục tiêu cụ thể như sau:', { indent: true }),
    numberedItem('**Xây dựng website thương mại điện tử hoàn chỉnh** cho lĩnh vực PC gaming với đầy đủ chức năng: quản lý sản phẩm, giỏ hàng, đặt hàng, thanh toán trực tuyến, theo dõi đơn hàng, đánh giá sản phẩm.'),
    numberedItem('**Phát triển công cụ PC Builder (Aura Builder)** cho phép người dùng tự chọn và lắp ráp cấu hình PC theo nhu cầu, với khả năng trực quan hóa 3D, xuất PDF, chia sẻ cấu hình qua link hoặc email.'),
    numberedItem('**Tích hợp AI Chatbot (AruBot)** sử dụng mô hình ngôn ngữ lớn Qwen 3 235B để tư vấn sản phẩm thông minh, đề xuất cấu hình phù hợp dựa trên nhu cầu và ngân sách của khách hàng.'),
    numberedItem('**Xây dựng cộng đồng AuraHub** — mạng xã hội mini cho cộng đồng game thủ với tính năng đăng bài, bình luận, thích, bình chọn (poll), repost và theo dõi người dùng.'),
    numberedItem('**Tích hợp thanh toán trực tuyến** thông qua các cổng thanh toán phổ biến tại Việt Nam: MoMo, ZaloPay, chuyển khoản ATM/QR và thanh toán khi nhận hàng (COD) với xác thực OTP.'),
    numberedItem('**Phát triển hệ thống quản trị viên (Admin Panel)** toàn diện với dashboard thống kê doanh thu, quản lý sản phẩm, đơn hàng, khách hàng, bài viết, khuyến mãi, kiểm duyệt nội dung cộng đồng và hỗ trợ khách hàng real-time.'),
    numberedItem('**Thiết kế giao diện responsive** thân thiện với người dùng Việt Nam, hỗ trợ đa nền tảng (desktop, tablet, mobile) với trải nghiệm trực quan 3D trên trang chủ.'),
    numberedItem('**Triển khai hệ thống thông báo real-time** sử dụng Socket.IO để cập nhật trạng thái đơn hàng, tin nhắn hỗ trợ và tương tác cộng đồng theo thời gian thực.'),
    spacer(),

    // ===== 1.2 =====
    h2('1.2. Tổng quan về AuraPC'),

    h3('1.2.1. Ý nghĩa thương hiệu'),

    h4('1.2.1.1. Tên thương hiệu và ý nghĩa'),
    p('**AuraPC** là sự kết hợp giữa hai yếu tố mang ý nghĩa sâu sắc:', { indent: true }),
    bullet('**"Aura"** (hào quang, ánh sáng bao quanh): Trong tiếng Latin, "Aura" có nghĩa là làn gió nhẹ hoặc hào quang bao phủ xung quanh một vật thể. Trong ngữ cảnh gaming, "Aura" gợi lên hình ảnh về sức mạnh tiềm ẩn, năng lượng và sự nổi bật — những đặc tính mà mọi game thủ đều mong muốn từ bộ PC của mình.'),
    bullet('**"PC"** (Personal Computer): Đại diện cho sản phẩm cốt lõi — máy tính cá nhân, đặc biệt là PC gaming.'),
    p('Kết hợp lại, **AuraPC** mang ý nghĩa: *"Hào quang của chiếc PC — nơi mỗi bộ máy tính đều tỏa sáng và thể hiện cá tính riêng của người sở hữu"*. Tên thương hiệu phản ánh triết lý rằng mỗi chiếc PC gaming không chỉ là công cụ, mà còn là tác phẩm nghệ thuật công nghệ mang dấu ấn cá nhân.', { indent: true }),
    spacer(),

    h4('1.2.1.2. Câu chuyện thương hiệu'),
    p('AuraPC được hình thành từ niềm đam mê gaming và mong muốn mang đến trải nghiệm mua sắm PC chuyên nghiệp cho cộng đồng game thủ Việt Nam. Trong bối cảnh thị trường linh kiện PC tại Việt Nam đang phát triển mạnh nhưng trải nghiệm mua sắm trực tuyến còn nhiều bất cập, AuraPC ra đời với sứ mệnh trở thành cầu nối tin cậy giữa người dùng và thế giới phần cứng gaming.', { indent: true }),
    p('Với slogan **"Build Your Dream PC"** (Xây dựng chiếc PC trong mơ), AuraPC không chỉ đơn thuần là một cửa hàng bán linh kiện mà còn là nền tảng giúp người dùng hiện thực hóa ý tưởng về chiếc máy tính hoàn hảo thông qua công cụ Aura Builder — nơi mọi người có thể tự tay lựa chọn từng linh kiện, xem trước cấu hình 3D và nhận tư vấn từ AI thông minh.', { indent: true }),
    spacer(),

    h3('1.2.2. Tầm nhìn - Sứ mệnh - Mục tiêu - Triết lý'),

    h4('1.2.2.1. Tầm nhìn'),
    p('Trở thành nền tảng thương mại điện tử PC gaming hàng đầu tại Việt Nam, nơi kết nối công nghệ tiên tiến với trải nghiệm mua sắm trực quan và thông minh. AuraPC hướng đến việc xây dựng một hệ sinh thái toàn diện cho cộng đồng game thủ, từ mua sắm sản phẩm, lắp ráp cấu hình đến chia sẻ kiến thức và kết nối cộng đồng.', { indent: true }),
    spacer(),

    h4('1.2.2.2. Sứ mệnh'),
    p('Mang đến trải nghiệm mua sắm PC gaming tối ưu cho người Việt bằng cách:', { indent: true }),
    bullet('Cung cấp sản phẩm chất lượng với giá cả minh bạch và cạnh tranh.'),
    bullet('Ứng dụng công nghệ hiện đại (3D, AI, real-time) để nâng cao trải nghiệm người dùng.'),
    bullet('Hỗ trợ tư vấn chuyên môn thông qua AI chatbot và đội ngũ hỗ trợ trực tuyến.'),
    bullet('Xây dựng cộng đồng game thủ gắn kết thông qua nền tảng AuraHub.'),
    spacer(),

    h4('1.2.2.3. Mục tiêu'),
    bullet('**Ngắn hạn:** Hoàn thiện nền tảng TMĐT với đầy đủ tính năng cốt lõi, đảm bảo trải nghiệm mua sắm mượt mà và an toàn cho người dùng.'),
    bullet('**Trung hạn:** Mở rộng danh mục sản phẩm, tích hợp thêm phương thức thanh toán và dịch vụ vận chuyển, phát triển ứng dụng di động.'),
    bullet('**Dài hạn:** Trở thành nền tảng tham chiếu cho thị trường PC gaming Việt Nam, mở rộng sang các thị trường Đông Nam Á.'),
    spacer(),

    h4('1.2.2.4. Triết lý'),
    p('AuraPC hoạt động dựa trên ba trụ cột triết lý chính:', { indent: true }),
    bullet('**Đơn giản (Simplicity):** Giao diện trực quan, quy trình mua hàng đơn giản, giảm thiểu bước thao tác không cần thiết.'),
    bullet('**Thông minh (Intelligence):** Tích hợp AI để tư vấn, gợi ý sản phẩm phù hợp, cá nhân hóa trải nghiệm cho từng người dùng.'),
    bullet('**Đáng tin cậy (Reliability):** Đảm bảo bảo mật thông tin, thanh toán an toàn, giao hàng đúng cam kết và chính sách hậu mãi rõ ràng.'),
    spacer(),

    h3('1.2.4. Sản phẩm'),
    p('AuraPC cung cấp đa dạng sản phẩm phục vụ nhu cầu gaming và công nghệ, bao gồm các danh mục chính:', { indent: true }),

    makeTable(
      [1200, 3600, 4560],
      ['STT', 'Danh mục sản phẩm', 'Mô tả chi tiết'],
      [
        ['1', 'PC Gaming', 'Máy tính bàn gaming lắp sẵn với nhiều phân khúc từ phổ thông đến cao cấp'],
        ['2', 'Laptop Gaming', 'Laptop chuyên gaming từ các thương hiệu: ASUS, MSI, Lenovo, Acer, Dell'],
        ['3', 'Linh kiện PC', 'CPU, GPU (Card đồ họa), Mainboard, RAM, SSD/HDD, PSU, Case, Tản nhiệt'],
        ['4', 'Màn hình Gaming', 'Màn hình tần số quét cao (144Hz, 240Hz), độ phân giải 2K/4K'],
        ['5', 'Phụ kiện Gaming', 'Bàn phím cơ, chuột gaming, tai nghe, bàn di chuột, ghế gaming'],
        ['6', 'Thiết bị mạng', 'Router, switch, card mạng cho gaming'],
      ]
    ),
    spacer(),

    // ===== 1.3 =====
    h2('1.3. Phân tích kinh doanh'),

    h3('1.3.1. Khách hàng mục tiêu'),
    p('AuraPC xác định các nhóm khách hàng mục tiêu chính như sau:', { indent: true }),

    p('**Nhóm 1 — Game thủ trẻ (18–30 tuổi):**', { indent: true }),
    bullet('Đặc điểm: Sinh viên, nhân viên văn phòng trẻ có đam mê gaming, thường xuyên tìm hiểu về phần cứng và linh kiện PC.'),
    bullet('Nhu cầu: Tìm kiếm cấu hình PC phù hợp ngân sách, công cụ so sánh và tự lắp ráp, tham gia cộng đồng gaming.'),
    bullet('Hành vi: Mua sắm trực tuyến, đọc review, xem benchmark, tham khảo ý kiến từ cộng đồng.'),
    spacer(),

    p('**Nhóm 2 — Chuyên gia CNTT và Content Creator (25–40 tuổi):**', { indent: true }),
    bullet('Đặc điểm: Lập trình viên, designer, video editor cần workstation hiệu suất cao.'),
    bullet('Nhu cầu: PC mạnh cho công việc chuyên môn (render 3D, biên tập video 4K, AI/ML), ưu tiên chất lượng và ổn định.'),
    bullet('Hành vi: Nghiên cứu kỹ trước khi mua, sẵn sàng chi trả cho sản phẩm chất lượng.'),
    spacer(),

    p('**Nhóm 3 — Phụ huynh mua cho con (35–50 tuổi):**', { indent: true }),
    bullet('Đặc điểm: Không am hiểu sâu về phần cứng, cần tư vấn để chọn sản phẩm phù hợp cho con em.'),
    bullet('Nhu cầu: Giao diện dễ sử dụng, tư vấn AI thông minh, sản phẩm uy tín với giá hợp lý.'),
    bullet('Hành vi: Tin tưởng vào thương hiệu, đánh giá sản phẩm và chính sách bảo hành.'),
    spacer(),

    h3('1.3.2. Phân tích thị trường'),
    p('Thị trường phần cứng PC gaming tại Việt Nam đang trong giai đoạn tăng trưởng mạnh mẽ với nhiều yếu tố thuận lợi:', { indent: true }),

    p('**Quy mô và tốc độ tăng trưởng:**', { indent: true }),
    bullet('Thị trường game Việt Nam đạt doanh thu ước tính trên 600 triệu USD/năm, với tốc độ tăng trưởng trung bình 15–20%/năm.'),
    bullet('Số lượng game thủ PC tại Việt Nam ước tính trên 20 triệu người, chiếm khoảng 65% tổng số người chơi game.'),
    bullet('Nhu cầu nâng cấp phần cứng tăng mạnh nhờ sự ra mắt liên tục của các tựa game AAA đòi hỏi cấu hình cao.'),
    spacer(),

    p('**Xu hướng thị trường:**', { indent: true }),
    bullet('Chuyển dịch từ mua sắm offline sang online: Đặc biệt sau đại dịch COVID-19, người tiêu dùng Việt Nam ngày càng quen thuộc với mua sắm trực tuyến.'),
    bullet('Nhu cầu cá nhân hóa: Game thủ muốn tự build PC theo sở thích, không muốn mua máy lắp sẵn cố định.'),
    bullet('Tích hợp AI trong mua sắm: Chatbot AI và recommendation system đang trở thành xu thế trong TMĐT.'),
    bullet('Cộng đồng hóa: Người dùng muốn chia sẻ kinh nghiệm, đánh giá sản phẩm và kết nối với người cùng sở thích.'),
    spacer(),

    h3('1.3.3. Phân tích đối thủ cạnh tranh'),
    p('Để hiểu rõ hơn về bối cảnh cạnh tranh, nhóm đã phân tích các đối thủ chính trong thị trường TMĐT linh kiện PC tại Việt Nam:', { indent: true }),

    makeTable(
      [1800, 2200, 2200, 3160],
      ['Đối thủ', 'Ưu điểm', 'Hạn chế', 'So sánh với AuraPC'],
      [
        ['Phong Vũ\n(phongvu.vn)', 'Thương hiệu lâu đời, kho hàng lớn, nhiều chi nhánh offline', 'Giao diện web phức tạp, không có PC Builder trực quan, thiếu AI chatbot', 'AuraPC có PC Builder 3D, AI chatbot tư vấn, UX hiện đại hơn'],
        ['GearVN\n(gearvn.com)', 'Chuyên gaming, content marketing tốt, đội ngũ tư vấn chuyên nghiệp', 'PC Builder đơn giản, chưa có AI tư vấn, chưa có cộng đồng tích hợp', 'AuraPC tích hợp cộng đồng AuraHub, Builder 3D, chatbot AI'],
        ['An Phát\n(anphatpc.com.vn)', 'Giá cạnh tranh, chính sách bảo hành tốt, mạng lưới phân phối rộng', 'UX cơ bản, thiếu tính năng hiện đại, không có cộng đồng', 'AuraPC ưu việt về UX, 3D visualization, real-time features'],
        ['Memoryzone\n(memoryzone.com.vn)', 'Chuyên sâu linh kiện, giá cạnh tranh, thông tin kỹ thuật chi tiết', 'Giao diện truyền thống, thiếu trải nghiệm mua sắm hiện đại', 'AuraPC vượt trội về trải nghiệm: 3D, AI, community'],
      ]
    ),
    spacer(),
    p('**Lợi thế cạnh tranh của AuraPC** nằm ở sự kết hợp độc đáo giữa công nghệ hiện đại (3D visualization, AI chatbot, real-time communication) với trải nghiệm mua sắm chuyên biệt cho gaming. Không đối thủ nào hiện tại có đầy đủ bộ tính năng: PC Builder 3D + AI Chatbot + Cộng đồng tích hợp + Thanh toán đa kênh + Thông báo real-time trong cùng một nền tảng.', { indent: true }),
  ];
};
