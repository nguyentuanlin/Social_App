# ⚡ Quick Start - 3 Bước Chạy App

## 1️⃣ Cài đặt (5-10 phút)

```bash
cd D:\DOAN\Social_app
npm install
```

## 2️⃣ Cấu hình Backend URL

**Mở file:** `src/services/api.ts`

**Thay đổi dòng 5:**
```typescript
const API_BASE_URL = 'http://192.168.1.100:3000'; // ⬅️ Thay IP của bạn
```

**Chọn URL phù hợp:**
- Android Emulator: `http://10.0.2.2:3000`
- iOS Simulator: `http://localhost:3000`
- Thiết bị thật: `http://192.168.1.100:3000` (IP máy backend)

## 3️⃣ Chạy App

### Cách 1: Expo Go (Khuyến nghị)

```bash
npm start
```

Sau đó scan QR code bằng app **Expo Go** trên điện thoại.

### Cách 2: Android Emulator

```bash
npm run android
```

### Cách 3: iOS Simulator (Mac)

```bash
npm run ios
```

---

## ✅ Test Đăng Nhập

1. Đảm bảo backend đang chạy: `http://localhost:3000`
2. Nhập email và password từ database
3. Click "Đăng nhập"

---

## 🐛 Lỗi thường gặp

### "Network request failed"
→ Kiểm tra IP trong `src/services/api.ts`
→ Đảm bảo backend đang chạy
→ Điện thoại và máy tính cùng WiFi

### "Unable to resolve module"
```bash
npm start -- --reset-cache
```

---

**Xem hướng dẫn chi tiết:** `SETUP_GUIDE.md`
