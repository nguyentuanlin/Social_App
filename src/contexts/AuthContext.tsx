import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { authService, User } from '../services/authService';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
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
      setIsLoading(true);
      await authService.logout();
      setUser(null);
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setIsLoading(false);
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
