# 🔍 Debug Logout - Hướng dẫn Test

## Đã thêm logging chi tiết vào toàn bộ flow

### 1. ProfileModal - Nút Đăng xuất
```
[ProfileModal] 🖱️ NÚT ĐĂNG XUẤT ĐƯỢC CLICK!
[ProfileModal] 🔍 handleLogout function: function
[ProfileModal] 🎯 handleLogout được gọi
```

### 2. Alert Dialog
```
[ProfileModal] ❌ User hủy đăng xuất  (nếu nhấn Hủy)
HOẶC
[ProfileModal] 🚪 User XÁC NHẬN đăng xuất  (nếu nhấn Đăng xuất)
```

### 3. ProfileModal - Đóng modal
```
[ProfileModal] 📍 Bước 1: Đóng modal...
[ProfileModal] ✅ Modal đã gọi onClose()
[ProfileModal] ⏳ Đợi 300ms...
[ProfileModal] ✅ Đã đợi xong
```

### 4. ProfileModal - Gọi logout
```
[ProfileModal] 📍 Bước 2: Gọi logout()...
[ProfileModal] 🔍 logout function: function
```

### 5. AuthContext - Logout function
```
============================================================
[AuthContext] 🚪 LOGOUT FUNCTION ĐƯỢC GỌI
[AuthContext] 📊 Current user: admin@example.com
[AuthContext] 📊 Current isAuthenticated: true
[AuthContext] 📍 Bước 1: Clear user state...
[AuthContext] ✅ setUser(null) đã được gọi
[AuthContext] 📊 New isAuthenticated should be: false
[AuthContext] 📍 Bước 2: Gọi authService.logout() background...
[AuthContext] 🎉 Đăng xuất thành công!
[AuthContext] 🔄 Navigation should trigger now...
============================================================
```

### 6. App Navigation - Re-render
```
[App/Navigation] 🔄 Re-render
[App/Navigation] 📊 isAuthenticated: false
[App/Navigation] 📊 isLoading: false
[App/Navigation] 📊 user: null
[App/Navigation] 🎬 Will show: LoginScreen
```

### 7. AuthService - Background cleanup
```
[AuthService] 🚪 Đang đăng xuất...
[AuthService] ✅ API logout thành công
[AuthService] 🗑️ Đã xóa access_token
[AuthService] 🗑️ Đã xóa userData
[AuthService] ✅ Logout hoàn thành!
```

### 8. ProfileModal - Hoàn thành
```
[ProfileModal] ✅ Logout hoàn thành
============================================================
```

---

## 🧪 Cách Test

1. **Mở app** và đăng nhập
2. **Mở Developer Console** để xem logs
3. **Click vào avatar** → ProfileModal mở
4. **Click nút "Đăng xuất"** (nút đỏ ở dưới)
5. **Click "Đăng xuất"** trong Alert dialog

## 📊 Kết quả mong đợi

✅ Console hiển thị đầy đủ logs theo thứ tự trên
✅ App chuyển về màn hình Login
✅ Không có lỗi trong console

## ❌ Nếu không hoạt động

### Trường hợp 1: Không thấy log đầu tiên
```
[ProfileModal] 🖱️ NÚT ĐĂNG XUẤT ĐƯỢC CLICK!
```
→ **Vấn đề:** Nút không được click hoặc bị che bởi element khác
→ **Giải pháp:** Kiểm tra z-index, TouchableOpacity có hoạt động không

### Trường hợp 2: Thấy log nhưng dừng ở Alert
```
[ProfileModal] 🎯 handleLogout được gọi
```
→ **Vấn đề:** User chưa nhấn "Đăng xuất" trong Alert
→ **Giải pháp:** Đảm bảo nhấn nút "Đăng xuất" (màu đỏ) trong Alert

### Trường hợp 3: Thấy AuthContext log nhưng không navigate
```
[AuthContext] 🔄 Navigation should trigger now...
```
Nhưng KHÔNG thấy:
```
[App/Navigation] 🔄 Re-render
[App/Navigation] 📊 isAuthenticated: false
```
→ **Vấn đề:** Navigation component không re-render
→ **Giải pháp:** 
  - Kiểm tra AuthContext Provider có wrap đúng không
  - Kiểm tra useAuth() hook có hoạt động không
  - Có thể cần reload app

### Trường hợp 4: Navigation re-render nhưng vẫn hiển thị HomeScreen
```
[App/Navigation] 📊 isAuthenticated: false
[App/Navigation] 🎬 Will show: LoginScreen
```
Nhưng vẫn thấy HomeScreen
→ **Vấn đề:** React Navigation cache hoặc animation issue
→ **Giải pháp:** Reload app hoặc check React Navigation config

---

## 📝 Gửi logs cho developer

Nếu vẫn không hoạt động, copy **TẤT CẢ** logs từ console và gửi kèm:
1. Logs đầy đủ từ khi click nút đến khi kết thúc
2. Screenshot màn hình hiện tại
3. Có thấy Alert dialog không?
4. Có thấy loading spinner không?

---

**Ngày tạo:** 11/11/2025
**Mục đích:** Debug logout flow với logging chi tiết
