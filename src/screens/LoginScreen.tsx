import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [rememberEmail, setRememberEmail] = useState(false);
  const { login, isLoading: isLoginLoading } = useAuth();
  const navigation = useNavigation();
  const isLoading = isLoginLoading;

  // Load email đã lưu (nếu có) khi mở màn
  useEffect(() => {
    const loadRememberedEmail = async () => {
      try {
        const stored = await AsyncStorage.getItem('remembered_email');
        if (stored) {
          setEmail(stored);
          setRememberEmail(true);
        }
      } catch {
        // ignore
      }
    };
    loadRememberedEmail();
  }, []);

  const handleLogin = async () => {
    // console.log('[LoginScreen] 🔘 Nút đăng nhập được nhấn');
    // console.log('[LoginScreen] 📧 Email:', email);
    // console.log('[LoginScreen] 🔑 Password:', password ? '***' : 'empty');
    
    // Clear previous error
    setErrorMessage('');
    
    if (!email || !password) {
      console.warn('[LoginScreen] ⚠️ Email hoặc password trống');
      setErrorMessage('Vui lòng nhập đầy đủ email và mật khẩu');
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ email và mật khẩu');
      return;
    }

    try {
      // console.log('[LoginScreen] 📝 Gọi login từ AuthContext...');
      await login(email, password);
      // Lưu hoặc xoá email tuỳ theo lựa chọn
      try {
        if (rememberEmail) {
          await AsyncStorage.setItem('remembered_email', email);
        } else {
          await AsyncStorage.removeItem('remembered_email');
        }
      } catch {}
      // console.log('[LoginScreen] ✅ Login thành công! Navigation sẽ tự động xử lý.');
      // Navigation sẽ được xử lý tự động bởi App.tsx
    } catch (error: any) {
      console.error('[LoginScreen] ❌ Login thất bại:', error.message);
      setErrorMessage(error.message || 'Đăng nhập thất bại');
      Alert.alert('Đăng nhập thất bại', error.message);
    }
  };

  const handleAzureLogin = async () => {
    // Chuyển sang màn hình WebView SSO, nơi web sẽ xử lý Azure SSO và trả token về app
    navigation.navigate('SSOLogin' as never);
  };

  return (
    <View style={styles.container}>
      {/* Decorative gradient background */}
      <LinearGradient
        colors={['#0f172a', '#0ea5e9', '#4f46e5']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={styles.heroGlowTop} />
      <View pointerEvents="none" style={styles.heroGlowBottom} />
      <View pointerEvents="none" style={styles.heroRing} />
      <View pointerEvents="none" style={styles.heroCardShadow} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo và Title */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <LinearGradient
                colors={['#38bdf8', '#6366f1']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.logoGradient}
              >
                <MaterialCommunityIcons name="chat-processing" size={34} color="#FFFFFF" />
              </LinearGradient>
            </View>
            <View style={styles.badgeRow}>
              <View style={styles.brandBadge}>
                <Text style={styles.brandBadgeText}>AI Agent Mobile</Text>
              </View>
              <View style={styles.brandBadgeSecondary}>
                <MaterialIcons name="verified" size={14} color="#10B981" />
                <Text style={styles.brandBadgeSecondaryText}>Enterprise</Text>
              </View>
            </View>
            <Text style={styles.title}>Social Media CRM</Text>
            <Text style={styles.subtitle}>Hệ thống AI quản trị mạng xã hội đa kênh</Text>

            <View style={styles.metricsRow}>
              <View style={styles.metricPill}>
                <MaterialCommunityIcons name="shield-lock-outline" size={16} color="#10B981" />
                <Text style={styles.metricText}>Bảo mật JWT</Text>
              </View>
              <View style={styles.metricPill}>
                <MaterialCommunityIcons name="rocket-launch" size={16} color="#F59E0B" />
                <Text style={styles.metricText}>Tốc độ cao</Text>
              </View>
              <View style={styles.metricPill}>
                <MaterialCommunityIcons name="microsoft-azure" size={16} color="#2563EB" />
                <Text style={styles.metricText}>Azure SSO</Text>
              </View>
            </View>
          </View>

          {/* Form Card */}
          <View style={styles.formCard}>
            <LinearGradient
              colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.02)']}
              style={styles.cardBorder}
            />
            <Text style={styles.formTitle}>Đăng nhập</Text>

            {/* Error Message */}
            {errorMessage ? (
              <View style={styles.errorContainer}>
                <MaterialIcons name="error-outline" size={20} color="#EF4444" />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputWrapper}>
                <MaterialIcons name="email" size={20} color="#6B7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Nhập địa chỉ email"
                  placeholderTextColor="#9CA3AF"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (errorMessage) setErrorMessage('');
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                />
              </View>
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Mật khẩu</Text>
              <View style={styles.inputWrapper}>
                <MaterialIcons name="lock" size={20} color="#6B7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Nhập mật khẩu"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errorMessage) setErrorMessage('');
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIcon}
                >
                  <MaterialIcons 
                    name={showPassword ? 'visibility' : 'visibility-off'} 
                    size={20} 
                    color="#6B7280" 
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Remember email + Forgot Password */}
            <View style={styles.rememberRow}>
              <TouchableOpacity
                style={styles.rememberToggle}
                onPress={() => setRememberEmail(!rememberEmail)}
                disabled={isLoading}
              >
                <View
                  style={[
                    styles.rememberCheckbox,
                    rememberEmail && styles.rememberCheckboxActive,
                  ]}
                >
                  {rememberEmail && (
                    <MaterialIcons name="check" size={14} color="#FFFFFF" />
                  )}
                </View>
                <Text style={styles.rememberLabel}>Ghi nhớ email</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.forgotPassword}>
                <Text style={styles.forgotPasswordText}>Quên mật khẩu?</Text>
              </TouchableOpacity>
            </View>

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              <LinearGradient
                colors={['#2563EB', '#7C3AED']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.loginButtonGradient}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.loginButtonText}>Đăng nhập</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>hoặc</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* SSO Button */}
            <TouchableOpacity 
              style={styles.ssoButton} 
              disabled={isLoading}
              onPress={handleAzureLogin}
            >
              <MaterialCommunityIcons name="microsoft-azure" size={20} color="#374151" style={styles.ssoIcon} />
              <Text style={styles.ssoButtonText}>Đăng nhập với Azure AD</Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Bạn chưa có tài khoản?{' '}
              <Text style={styles.footerLink}>Liên hệ quản trị viên</Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 18,
  },
  keyboardView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 28,
    alignItems: 'center',
  },
  heroGlowTop: {
    position: 'absolute',
    top: -120,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#38bdf8',
    opacity: 0.25,
  },
  heroGlowBottom: {
    position: 'absolute',
    bottom: -140,
    left: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: '#6366f1',
    opacity: 0.25,
  },
  heroRing: {
    position: 'absolute',
    top: 80,
    right: 10,
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  heroCardShadow: {
    position: 'absolute',
    top: 180,
    alignSelf: 'center',
    width: '80%',
    height: 60,
    backgroundColor: '#000',
    opacity: 0.15,
    borderRadius: 30,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
    width: '100%',
    maxWidth: 430,
  },
  logoContainer: {
    width: 82,
    height: 82,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  logoGradient: {
    width: 62,
    height: 62,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  brandBadge: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  brandBadgeText: {
    fontSize: 11,
    letterSpacing: 0.5,
    color: '#E0E7FF',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  brandBadgeSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  brandBadgeSecondaryText: {
    color: '#D1FAE5',
    fontSize: 11,
    fontWeight: '700',
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    paddingHorizontal: 36,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  metricPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  metricText: {
    color: '#E5E7EB',
    fontSize: 12,
    fontWeight: '600',
  },
  formCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.97)',
    borderRadius: 26,
    padding: 24,
    width: '100%',
    maxWidth: 430,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.6)',
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24,
    shadowRadius: 30,
    elevation: 10,
  },
  cardBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 26,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 22,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  errorText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#DC2626',
    fontWeight: '500',
  },
  inputContainer: {
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    height: 54,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 52,
    fontSize: 16,
    color: '#111827',
  },
  eyeIcon: {
    padding: 8,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotPasswordText: {
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '700',
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  rememberToggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rememberCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5F5',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  rememberCheckboxActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  rememberLabel: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
  },
  loginButton: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  ssoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 14,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  ssoIcon: {
    marginRight: 10,
  },
  ssoButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  footer: {
    marginTop: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  footerLink: {
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
});

export default LoginScreen;
