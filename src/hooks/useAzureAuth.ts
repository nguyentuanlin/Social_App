import { useEffect, useState } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { authService } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';

// Hoàn thành WebBrowser session khi component unmount
WebBrowser.maybeCompleteAuthSession();

// Azure AD Configuration
const AZURE_TENANT_ID = process.env.EXPO_PUBLIC_AZURE_AD_TENANT_ID || '67f466ec-d460-4f90-9465-f88465e460ef';
const AZURE_CLIENT_ID = process.env.EXPO_PUBLIC_AZURE_AD_CLIENT_ID || 'a1722b59-b11d-4113-8a96-4d18ebf3e6c1';

// Discovery document cho Azure AD
const discovery = {
  authorizationEndpoint: `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/authorize`,
  tokenEndpoint: `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`,
};

export const useAzureAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { completeSsoLogin } = useAuth();

  // Tạo redirect URI
  const redirectScheme = process.env.EXPO_PUBLIC_AZURE_AD_REDIRECT_SCHEME || 'socialapp';
  const redirectPath = process.env.EXPO_PUBLIC_AZURE_AD_REDIRECT_PATH || 'redirect';

  const redirectUri = AuthSession.makeRedirectUri({
    scheme: redirectScheme,
    path: redirectPath,
  });

  console.log('[Azure Auth] Redirect URI:', redirectUri);

  // Cấu hình OAuth request
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: AZURE_CLIENT_ID,
      scopes: ['openid', 'profile', 'email', 'User.Read'],
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
      extraParams: {
        prompt: 'select_account',
      },
    },
    discovery
  );

  // Xử lý response từ Azure
  useEffect(() => {
    if (response?.type === 'success') {
      handleAzureCallback(response.params.code);
    } else if (response?.type === 'error') {
      setError('Đăng nhập Azure thất bại');
      setIsLoading(false);
    } else if (response?.type === 'dismiss' || response?.type === 'cancel') {
      setIsLoading(false);
    }
  }, [response]);

  const handleAzureCallback = async (code: string) => {
    try {
      setIsLoading(true);
      setError(null);

      // Exchange authorization code for access token
      const tokenResponse = await AuthSession.exchangeCodeAsync(
        {
          clientId: AZURE_CLIENT_ID,
          code,
          redirectUri,
          extraParams: {
            code_verifier: request?.codeVerifier || '',
          },
        },
        discovery
      );

      if (tokenResponse.accessToken) {
        // Gọi backend để exchange Azure token thành JWT của hệ thống
        await authService.exchangeSsoToken('azure', tokenResponse.accessToken);

        // Lấy profile và cập nhật AuthContext để app native trở thành chủ phiên
        const profile = await authService.getProfile();
        await completeSsoLogin(profile);
      }
    } catch (err: any) {
      console.error('Azure auth error:', err);
      setError(err.message || 'Đăng nhập thất bại');
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithAzure = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await promptAsync();
    } catch (err: any) {
      setError(err.message || 'Không thể mở trình duyệt');
      setIsLoading(false);
    }
  };

  return {
    signInWithAzure,
    isLoading,
    error,
  };
};
