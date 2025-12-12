import React, { useCallback, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Alert, Text, Platform } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';

const WEB_BASE_URL =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:3001'
    : 'http://localhost:3001';

const SSO_WEB_URL = `${WEB_BASE_URL}/auth/signin?mobile=1`;

const SSOWebViewScreen: React.FC = () => {
  const { completeSsoLogin } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);

  console.log('==================== [SSO WebView] RENDER ====================');
  console.log('[SSO WebView] 🌐 WEB_BASE_URL:', WEB_BASE_URL);
  console.log('[SSO WebView] 🔗 SSO_WEB_URL:', SSO_WEB_URL);
  console.log('[SSO WebView] 📱 Platform:', Platform.OS);

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 24 }] }>
        <Text style={{ color: '#DC2626', fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
          SSO WebView không hỗ trợ chạy trên phiên bản Web.
        </Text>
        <Text style={{ color: '#4B5563', fontSize: 14, textAlign: 'center' }}>
          Vui lòng chạy ứng dụng trên Android hoặc iOS (device hoặc emulator) để sử dụng đăng nhập SSO Azure.
        </Text>
      </View>
    );
  }

  const handleMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      try {
        const rawData = event.nativeEvent.data;
        console.log('-------------------- [SSO WebView] onMessage --------------------');
        console.log('[SSO WebView] 📩 rawData từ web:', rawData);
        if (!rawData) {
          return;
        }

        let parsed: any;
        try {
          parsed = JSON.parse(rawData);
          console.log('[SSO WebView] ✅ Parsed message:', parsed);
        } catch {
          console.log('[SSO WebView] ⚠️ Không parse được JSON, bỏ qua message');
          return;
        }

        if (!parsed || parsed.type !== 'AZURE_SSO' || !parsed.token) {
          console.log('[SSO WebView] ⚠️ Message không phải AZURE_SSO hợp lệ, bỏ qua');
          return;
        }

        if (isProcessing) {
          console.log('[SSO WebView] ⏳ Đã có request đang xử lý, bỏ qua message mới');
          return;
        }

        setIsProcessing(true);

        const provider = typeof parsed.provider === 'string' ? parsed.provider : 'azure';
        console.log('[SSO WebView] 🔑 Bắt đầu exchange SSO token với provider:', provider);
        await authService.exchangeSsoToken(provider, parsed.token);
        console.log('[SSO WebView] ✅ Exchange SSO token thành công, gọi getProfile');
        const profile = await authService.getProfile();
        console.log('[SSO WebView] ✅ Lấy profile thành công:', {
          email: profile.email,
          fullname: profile.fullname,
          roles: profile.roles,
        });
        await completeSsoLogin(profile);
        console.log('[SSO WebView] 🎉 completeSsoLogin hoàn tất, user đã đăng nhập trong app');
      } catch (error: any) {
        console.error('[SSO WebView] ❌ Lỗi trong handleMessage:', error?.message || error);
        Alert.alert('Lỗi', error?.message || 'Không thể hoàn tất đăng nhập SSO');
        setIsProcessing(false);
      }
    },
    [completeSsoLogin, isProcessing],
  );

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: SSO_WEB_URL }}
        onMessage={handleMessage}
        startInLoadingState
        onLoadStart={() => {
          console.log('-------------------- [SSO WebView] onLoadStart --------------------');
          console.log('[SSO WebView] ⏳ Bắt đầu load URL:', SSO_WEB_URL);
        }}
        onLoadEnd={() => {
          console.log('-------------------- [SSO WebView] onLoadEnd --------------------');
          console.log('[SSO WebView] ✅ Load xong URL:', SSO_WEB_URL);
        }}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('-------------------- [SSO WebView] onError --------------------');
          console.error('[SSO WebView] ❌ Lỗi khi load WebView:', nativeEvent);
          Alert.alert('Lỗi', 'Không thể tải trang đăng nhập SSO. Vui lòng kiểm tra frontend đang chạy trên cổng 3001.');
        }}
      />
      {isProcessing && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
});

export default SSOWebViewScreen;
