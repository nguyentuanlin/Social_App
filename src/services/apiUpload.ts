import apiClient, { API_BASE_URL } from './api';
import { Platform } from 'react-native';

export interface UploadResponse {
  success: boolean;
  fileUrl?: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
  error?: string;
  message?: {
    id: string;
    content: string;
    contentType: string;
    attachments: {
      files: Array<{
        id: string;
        originalName: string;
        fileName: string;
        fileUrl: string;
        mimeType: string;
        size: number;
        category: string;
      }>;
    };
    createdAt: string;
  };
}

export const uploadApi = {
  /**
   * Upload single file (image or document)
   */
  uploadFile: async (
    file: {
      uri: string;
      name?: string;
      type?: string;
      size?: number;
    },
    conversationId?: string
  ): Promise<UploadResponse> => {
    try {
      // console.log('[Upload API] Uploading file:', file);
      
      const formData = new FormData();

      // Helper: convert data URL to Blob
      const dataURLToBlob = (dataURL: string): Blob => {
        const [meta, base64Data] = dataURL.split(',');
        const mimeMatch = /data:(.*?);base64/.exec(meta || '');
        const mimeType = mimeMatch?.[1] || 'application/octet-stream';
        const byteChars = typeof atob === 'function' ? atob(base64Data) : Buffer.from(base64Data, 'base64').toString('binary');
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mimeType });
      };

      // Build file part differently on web vs native
      if (Platform.OS === 'web') {
        let blob: Blob;
        if (file.uri.startsWith('data:')) {
          blob = dataURLToBlob(file.uri);
        } else {
          // In case we have an http(s)/blob/file URL on web
          const res = await fetch(file.uri);
          blob = await res.blob();
        }
        const fileName = file.name || `upload_${Date.now()}`;
        const mimeType = file.type || blob.type || 'application/octet-stream';
        // Use File if available for better compatibility
        const webFile = typeof File !== 'undefined' ? new File([blob], fileName, { type: mimeType }) : blob;
        formData.append('file', webFile as any, fileName);
      } else {
        // React Native (iOS/Android)
        formData.append('file', {
          uri: file.uri,
          name: file.name || 'upload',
          type: file.type || 'application/octet-stream',
        } as any);
      }
      
      if (conversationId) {
        formData.append('conversationId', conversationId);
      }

      // Derive contentType for backend (image/video/audio/file)
      const mt = (file.type || '').toLowerCase();
      let derivedContentType: 'image' | 'video' | 'audio' | 'file' = 'file';
      if (mt.startsWith('image/')) derivedContentType = 'image';
      else if (mt.startsWith('video/')) derivedContentType = 'video';
      else if (mt.startsWith('audio/')) derivedContentType = 'audio';
      formData.append('contentType', derivedContentType);
      // Optional: include a simple content using filename
      if (file.name) formData.append('content', `📎 ${file.name}`);
      
      let responseData: any;
      if (Platform.OS === 'web') {
        // Use fetch on web (same as web app)
        const res = await fetch(`${API_BASE_URL}/chat/messages/upload`, {
          method: 'POST',
          body: formData,
        });
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw { response: { status: res.status, data: errJson } };
        }
        responseData = await res.json();
      } else {
        // Use axios on native
        const response = await apiClient.post('/chat/messages/upload', formData, {
          // Clear default json content-type
          transformRequest: [(data, headers) => {
            if (headers) {
              delete (headers as any)['Content-Type'];
              delete (headers as any)['content-type'];
            }
            return data as any;
          }],
          timeout: 30000,
        });
        responseData = response.data;
      }

      // console.log('[Upload API] Upload response:', responseData);
      
      // Web app trả về structure phức tạp với message và file info
      
      // Lấy file info từ response (có thể ở nhiều nơi)
      const fileInfo = responseData.file || 
                      (responseData.message?.attachments?.files?.[0]) || 
                      responseData;
      
      return {
        success: true,
        fileUrl: fileInfo.fileUrl,
        fileName: fileInfo.fileName || fileInfo.originalName,
        mimeType: fileInfo.mimeType || file.type,
        size: fileInfo.size || file.size,
        message: responseData.message, // Trả về message nếu có
      };
      
    } catch (error: any) {
      // Log detailed server error to help diagnose 400
      const serverData = error?.response?.data;
      console.error('[Upload API] Upload error:', error);
      if (serverData) {
        try {
          console.error('[Upload API] Server response:', JSON.stringify(serverData));
        } catch {}
      }
      
      let errorMessage = 'Không thể tải file lên';
      
      if (error.response?.status === 413) {
        errorMessage = 'File quá lớn. Vui lòng chọn file nhỏ hơn';
      } else if (error.response?.status === 415) {
        errorMessage = 'Định dạng file không được hỗ trợ';
      } else if (error.response?.status === 400) {
        const msg = serverData?.message || serverData?.error || error.message;
        if (typeof msg === 'string') errorMessage = msg;
      } else if (error.code === 'NETWORK_ERROR' || error.message?.includes('timeout')) {
        errorMessage = 'Lỗi kết nối. Vui lòng thử lại';
      }
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  },

  /**
   * Validate file before upload
   */
  validateFile: (file: {
    uri: string;
    name?: string;
    type?: string;
    size?: number;
  }): { valid: boolean; error?: string } => {
    // Check file size (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size && file.size > maxSize) {
      return {
        valid: false,
        error: 'File quá lớn. Kích thước tối đa là 50MB',
      };
    }

    // Check file type
    const allowedTypes = [
      // Images
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      // Documents
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain', 'text/csv',
      // Archives
      'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
      // Audio
      'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4',
      // Video
      'video/mp4', 'video/avi', 'video/quicktime',
    ];

    if (file.type && !allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: 'Định dạng file không được hỗ trợ',
      };
    }

    return { valid: true };
  },
};
