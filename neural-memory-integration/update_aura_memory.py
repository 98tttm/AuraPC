"""
Cập nhật bộ nhớ NeuralMemory với thông tin thực của dự án AuraPC.
Chạy: python update_aura_memory.py
"""
import asyncio
from memory_manager import NeuralMemoryManager

# Dùng brain riêng cho dự án AuraPC
MEMORY = NeuralMemoryManager(brain_name="aurapc_project", db_path="neural_memory.db")

AURAPC_MEMORIES = [
    # --- 1. Tổng quan dự án ---
    "AuraPC là dự án web thương mại điện tử (e-com) đang được phát triển để deploy lên internet.",
    "Mục đích chính của AuraPC: trải nghiệm khách hàng và mua hàng trên website, chuyên về PC, PC part, linh kiện, CPU, mainboard.",
    "Đối tượng người dùng AuraPC: tất cả mọi người đều có thể xem và trải nghiệm dịch vụ của website.",
    # --- 2. Công nghệ & Kiến trúc ---
    "Tech stack AuraPC: Frontend và Backend dùng Angular framework và NodeJS.",
    "Database của AuraPC: MongoDB.",
    "Dự định tích hợp n8n workflow vào website: cho người dùng build PC, tạo ảnh từ part đã chọn, và chatbot tư vấn.",
    "Quyết định kỹ thuật: chọn Framework Angular cho dự án AuraPC.",
    # --- 3. Nhóm phát triển ---
    "Team Leader và Dev Full Stack chính của AuraPC: Trần Thanh Thịnh.",
    "Trần Thanh Thịnh là Team Leader của nhóm sinh viên và là Dev Full Stack chính cho dự án AuraPC.",
    # --- 4. Trạng thái hiện tại ---
    "AuraPC đang ở giai đoạn mới bắt đầu.",
    "Các tính năng chính chưa hoàn thành hẳn.",
    "Tính năng đang/sắp làm: chức năng cơ bản e-com (lướt xem, mua, thanh toán), tích hợp không gian 3D để custom phụ kiện linh kiện.",
    # --- 5. Sitemap & AuraLab ---
    "AuraLab là tính năng Build PC cá nhân hóa của AuraPC; route chính /aura-lab.",
    "AuraLab gồm: /aura-lab/builder (công cụ build PC), /aura-lab/saved-builds, /aura-lab/presets (gaming, workstation, budget).",
    "Admin quản lý AuraLab tại /admin/aura-lab: presets, compatibility rules.",
    "Sitemap AuraPC: Client (Homepage, Products, AuraLab, Search, Cart & Checkout, Account, Auth, Support, Tutorials, News, Promotions); Admin (Dashboard, Products, Orders, Users, Content, Interactions, Promotions, Appearance, System, Analytics, AuraLab, Chatbot).",
    # --- 6. Chức năng (từ FunctionRequirement) ---
    "Chức năng cơ bản AuraPC: hiển thị sản phẩm/video, gợi ý sản phẩm, thanh toán và vận chuyển, đánh giá sản phẩm, FAQ, hỗ trợ và chính sách đổi trả.",
    "Chức năng admin AuraPC: quản lý nội dung, người dùng, hệ thống và bảo mật, tương tác, giao diện.",
    "Chức năng nâng cao: Tutorial, tìm kiếm nâng cao, giỏ hàng và yêu thích, mobile-friendly, mạng xã hội, AuraLab, Chatbot.",
    # --- 7. Quy tắc & Quy ước ---
    "Quy tắc code AuraPC: code phải thống nhất một nguyên tắc, rõ ràng sạch sẽ, liên kết chặt chẽ, không gây nhầm lẫn.",
    "Cấu trúc thư mục AuraPC có quy tắc riêng; AI Agent sẽ là người cấu hình.",
    # --- 8. Nguyên tắc cho AI Agent ---
    "Nguyên tắc bắt buộc cho AI Agent khi làm việc với AuraPC: phải làm đúng theo chỉ dẫn, không được tự ý làm việc ngoài phạm vi cho phép.",
]

async def main():
    print("--- Updating NeuralMemory for AuraPC project ---\n")
    await MEMORY.initialize()
    print(f"Brain: {MEMORY.brain_name}\n")
    for i, text in enumerate(AURAPC_MEMORIES, 1):
        print(f"  [{i}/{len(AURAPC_MEMORIES)}] stored.")
        await MEMORY.remember(text)
    print("\n--- Done. Testing recall ---\n")
    for q in [
        "AuraPC là gì?",
        "Tech stack và database?",
        "Ai là Team Leader?",
        "AuraLab là gì?",
        "Nguyên tắc AI Agent phải tuân thủ?",
    ]:
        ctx = await MEMORY.recall(q)
        print(f"Q: {q}")
        print(f"A: {ctx.strip()[:200]}...\n" if len(ctx) > 200 else f"A: {ctx}\n")

if __name__ == "__main__":
    asyncio.run(main())
