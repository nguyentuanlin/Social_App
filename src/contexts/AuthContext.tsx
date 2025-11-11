import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService, User } from '../services/authService';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  updateUserLocal: (data: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Kiểm tra authentication khi app khởi động
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      setIsLoading(true);
      const isAuth = await authService.isAuthenticated();
      
      if (isAuth) {
        // Thử lấy user từ cache trước
        const cachedUser = await authService.getCachedUser();
        if (cachedUser) {
          setUser(cachedUser);
        }
        
        // Sau đó fetch profile mới từ server
        try {
          const profile = await authService.getProfile();
          setUser(profile);
        } catch (profileError) {
          console.error('Error fetching profile:', profileError);
          // Nếu lỗi, vẫn giữ cached user
        }
      }
    } catch (err) {
      console.error('Auth check error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Cập nhật cục bộ user (avatar, coverImage, fullname, ...), đồng bộ AsyncStorage
  const updateUserLocal = async (data: Partial<User>) => {
    const merged = { ...(user || ({} as User)), ...data } as User;
    setUser(merged);
    try {
      await AsyncStorage.setItem('userData', JSON.stringify(merged));
    } catch {}
  };

  const login = async (email: string, password: string) => {
    try {
      console.log('[AuthContext] 🚀 Bắt đầu login flow...');
      setIsLoading(true);
      setError(null);

      // Đăng nhập
      console.log('[AuthContext] 📝 Gọi authService.login...');
      await authService.login(email, password);
      console.log('[AuthContext] ✅ Login service hoàn thành');

      // Lấy thông tin profile
      console.log('[AuthContext] 📝 Gọi authService.getProfile...');
      const profile = await authService.getProfile();
      console.log('[AuthContext] ✅ GetProfile hoàn thành');
      
      setUser(profile);
      console.log('[AuthContext] 🎉 Login flow hoàn thành! User đã được set.');
    } catch (err: any) {
      console.error('[AuthContext] ❌ Login flow thất bại:', err.message);
      const errorMessage = err.message || 'Đăng nhập thất bại';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
      console.log('[AuthContext] 🏁 Login flow kết thúc');
    }
  };

  const logout = async () => {
    try {
      console.log('='.repeat(60));
      console.log('[AuthContext] 🚪 LOGOUT FUNCTION ĐƯỢC GỌI');
      console.log('[AuthContext] 📊 Current user:', user?.email);
      console.log('[AuthContext] 📊 Current isAuthenticated:', !!user);
      
      // Không set loading = true để không block UI
      // setIsLoading(true);
      
      // Clear user state ngay lập tức để trigger navigation
      console.log('[AuthContext] 📍 Bước 1: Clear user state...');
      setUser(null);
      console.log('[AuthContext] ✅ setUser(null) đã được gọi');
      console.log('[AuthContext] 📊 New isAuthenticated should be:', false);
      
      // Gọi API logout ở background (không chờ)
      console.log('[AuthContext] 📍 Bước 2: Gọi authService.logout() background...');
      authService.logout()
        .then(() => {
          console.log('[AuthContext] ✅ API logout thành công');
        })
        .catch((err) => {
          console.error('[AuthContext] ⚠️ API logout lỗi (đã clear local):', err);
        });
      
      console.log('[AuthContext] 🎉 Đăng xuất thành công!');
      console.log('[AuthContext] 🔄 Navigation should trigger now...');
      console.log('='.repeat(60));
    } catch (err) {
      console.error('[AuthContext] ❌ Lỗi đăng xuất:', err);
      console.error('[AuthContext] ❌ Error details:', err);
      // Vẫn clear user state ngay cả khi có lỗi
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        login,
        logout,
        isAuthenticated: !!user,
        updateUserLocal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
