# 📱 Hướng dẫn Cài đặt và Chạy App

## 🎯 Bước 1: Cài đặt Dependencies

Mở terminal tại folder `D:\DOAN\Social_app` và chạy:

```bash
npm install
```

**Lưu ý**: Quá trình cài đặt có thể mất 5-10 phút.

---

## ⚙️ Bước 2: Cấu hình Backend URL

### Tìm IP Address của máy tính

**Windows:**
```bash
ipconfig
```
Tìm dòng `IPv4 Address` (ví dụ: `192.168.1.100`)

**Mac/Linux:**
```bash
ifconfig | grep inet
```

### Cập nhật API URL

Mở file `src/services/api.ts` và thay đổi:

```typescript
// Dòng 5
const API_BASE_URL = 'http://192.168.1.100:3000'; // ⬅️ Thay bằng IP của bạn
```

**Các trường hợp:**
- **Android Emulator**: `http://10.0.2.2:3000`
- **iOS Simulator**: `http://localhost:3000`
- **Thiết bị thật** (cùng WiFi): `http://192.168.1.100:3000` (IP máy backend)

---

## 🚀 Bước 3: Chạy App

### Option 1: Chạy với Expo Go (Dễ nhất - Khuyến nghị)

1. **Cài đặt Expo Go trên điện thoại:**
   - Android: [Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)
   - iOS: [App Store](https://apps.apple.com/app/expo-go/id982107779)

2. **Start Metro bundler:**
   ```bash
   npm start
   ```

3. **Scan QR code:**
   - Android: Dùng app Expo Go để scan QR code
   - iOS: Dùng Camera app để scan QR code

### Option 2: Chạy trên Android Emulator

1. **Cài đặt Android Studio** và tạo emulator

2. **Start emulator**

3. **Chạy app:**
   ```bash
   npm run android
   ```

### Option 3: Chạy trên iOS Simulator (Mac only)

1. **Cài đặt Xcode**

2. **Chạy app:**
   ```bash
   npm run ios
   ```

### Option 4: Chạy trên Web

```bash
npm run web
```

---

## 🔐 Bước 4: Test Đăng Nhập

### Đảm bảo Backend đang chạy

```bash
cd D:\DOAN\AIAgent_crm_backend
npm run start:dev
```

Backend phải chạy ở `http://localhost:3000`

### Thông tin đăng nhập test

Sử dụng tài khoản có sẵn trong database:

```
Email: admin@example.com
Password: [mật khẩu trong database]
```

---

## 🐛 Troubleshooting

### Lỗi 1: "Unable to resolve module"

**Giải pháp:**
```bash
# Xóa cache
npm start -- --reset-cache

# Hoặc
rm -rf node_modules
npm install
```

### Lỗi 2: "Network request failed"

**Nguyên nhân**: Không kết nối được backend

**Giải pháp:**
1. Kiểm tra backend đang chạy: `http://localhost:3000`
2. Kiểm tra IP trong `src/services/api.ts`
3. Đảm bảo điện thoại và máy tính cùng WiFi
4. Tắt firewall Windows nếu cần:
   ```
   Control Panel → Windows Defender Firewall → Turn off
   ```

### Lỗi 3: "Expo Go not found"

**Giải pháp:**
```bash
npm install -g expo-cli
```

### Lỗi 4: Android build failed

**Giải pháp:**
```bash
cd android
./gradlew clean
cd ..
npm run android
```

### Lỗi 5: "Token không hợp lệ"

**Nguyên nhân**: Token hết hạn hoặc backend thay đổi secret

**Giải pháp:**
- Đăng xuất và đăng nhập lại
- Hoặc xóa app data và cài lại

---

## 📊 Kiểm tra Kết nối

### Test Backend API

Mở browser và truy cập:
```
http://localhost:3000/api
```

Nếu thấy Swagger docs → Backend OK ✅

### Test từ điện thoại

Mở browser trên điện thoại và truy cập:
```
http://192.168.1.100:3000/api
```
(Thay bằng IP máy backend)

Nếu thấy Swagger docs → Kết nối OK ✅

---

## 🎨 Cấu trúc Code

```
Social_app/
├── src/
│   ├── contexts/
│   │   └── AuthContext.tsx       # ✅ Quản lý state đăng nhập
│   ├── screens/
│   │   ├── LoginScreen.tsx       # ✅ Màn hình đăng nhập
│   │   └── HomeScreen.tsx        # ✅ Màn hình chính
│   └── services/
│       ├── api.ts                # ✅ Axios config + interceptors
│       └── authService.ts        # ✅ API calls (login, profile, logout)
├── App.tsx                       # ✅ Root + Navigation
├── package.json                  # Dependencies
└── README.md                     # Tài liệu
```

---

## 🔄 Luồng Đăng Nhập

```
1. User nhập email + password
   ↓
2. LoginScreen gọi login() từ AuthContext
   ↓
3. AuthContext gọi authService.login()
   ↓
4. authService POST /auth/login → Nhận access_token
   ↓
5. Lưu token vào AsyncStorage
   ↓
6. authService GET /auth/profile → Nhận user data
   ↓
7. Lưu user data vào AsyncStorage
   ↓
8. AuthContext setUser() → isAuthenticated = true
   ↓
9. Navigation tự động chuyển sang HomeScreen
```

---

## 📱 Screenshots

### Login Screen
- Gradient background xanh dương - tím
- Logo TLL
- Email + Password inputs
- Button "Đăng nhập"
- Button "Đăng nhập với Azure AD"

### Home Screen
- Header gradient với avatar
- 4 stats cards (Cuộc hội thoại, Tin nhắn, Khách hàng, Kênh)
- Quick actions (Chat, Khách hàng, Thống kê)
- Thông tin tài khoản
- Button đăng xuất

---

## 🚧 Tính năng Tiếp theo

- [ ] Chat interface
- [ ] Danh sách conversations
- [ ] Gửi/nhận tin nhắn real-time
- [ ] Push notifications
- [ ] Quản lý khách hàng
- [ ] Thống kê và báo cáo
- [ ] Dark mode
- [ ] Multi-language

---

## 📞 Hỗ trợ

Nếu gặp vấn đề:
1. Kiểm tra lại các bước setup
2. Xem phần Troubleshooting
3. Check console logs
4. Liên hệ team phát triển

---

## ✅ Checklist Hoàn thành

- [x] Cài đặt dependencies
- [x] Cấu hình backend URL
- [x] Chạy app thành công
- [x] Test đăng nhập
- [x] Hiển thị thông tin user
- [x] Test đăng xuất

**Chúc mừng! App đã sẵn sàng để phát triển thêm tính năng! 🎉**
