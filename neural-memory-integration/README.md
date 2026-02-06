# NeuralMemory Integration for AuraPC

Thư mục này chứa mã nguồn tích hợp hệ thống bộ nhớ thần kinh (NeuralMemory) vào AI Agent của dự án AuraPC. Hệ thống này cho phép AI Agent lưu trữ kinh nghiệm dưới dạng các neuron liên kết và truy xuất thông qua kích hoạt lan tỏa (spreading activation), mô phỏng cách não người hoạt động.

## Cấu trúc thư mục

- `memory_manager.py`: Lớp quản lý chính để khởi tạo, lưu trữ và truy xuất bộ nhớ.
- `example_usage.py`: File ví dụ hướng dẫn cách sử dụng hệ thống bộ nhớ.
- `neural_memory.db`: File cơ sở dữ liệu SQLite lưu trữ bộ nhớ (sẽ được tạo sau khi chạy).

## Cài đặt

Yêu cầu Python 3.11+.

```bash
pip install neural-memory
```

## Cách sử dụng

### 1. Khởi tạo và Lưu trữ bộ nhớ

```python
from memory_manager import memory_manager
import asyncio

async def store():
    await memory_manager.initialize()
    await memory_manager.remember("Nội dung cần nhớ", memory_type="fact")

asyncio.run(store())
```

### 2. Truy xuất bộ nhớ (Recall)

```python
async def recall():
    context = await memory_manager.recall("Câu hỏi liên quan?")
    print(context)

asyncio.run(recall())
```

## Tại sao sử dụng NeuralMemory?

Thay vì sử dụng RAG (Vector Search) truyền thống chỉ tìm kiếm theo độ tương đồng văn bản, NeuralMemory cho phép:
- **Truy xuất theo liên tưởng**: Kích hoạt các khái niệm liên quan.
- **Chuỗi nhân quả**: Theo dõi tại sao một quyết định được đưa ra.
- **Bộ nhớ dài hạn**: Tồn tại qua các phiên làm việc khác nhau.

---
Dự án tích hợp bởi AI Agent.
