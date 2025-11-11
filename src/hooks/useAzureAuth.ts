import { useEffect, useState } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { authService } from '../services/authService';

// Hoàn thành WebBrowser session khi component unmount
WebBrowser.maybeCompleteAuthSession();

// Azure AD Configuration
const AZURE_TENANT_ID = '67f466ec-d460-4f90-9465-f88465e460ef';
const AZURE_CLIENT_ID = '0f263b0c-86ad-46c8-a583-0381ec2c8be3';

// Discovery document cho Azure AD
const discovery = {
  authorizationEndpoint: `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/authorize`,
  tokenEndpoint: `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`,
};

export const useAzureAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tạo redirect URI
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'socialapp',
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
        
        // Lấy profile
        await authService.getProfile();
        
        // AuthContext sẽ tự động update và navigate
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
