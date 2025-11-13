import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { uploadApi } from '../../services/apiUpload';
import FilePreview from './FilePreview';
import UploadProgress from './UploadProgress';

interface ChatInputBarProps {
  onSendMessage: (message: string) => void;
  onFileUploaded?: (uploadResult: any) => void; // Callback khi upload thành công
  isSending?: boolean;
  conversationId?: string;
}

const ChatInputBar: React.FC<ChatInputBarProps> = ({
  onSendMessage,
  onFileUploaded,
  isSending = false,
  conversationId,
}) => {
  const [messageText, setMessageText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<any>(null);

  const handleSend = () => {
    if (selectedFile) {
      // Upload file if selected
      handleUploadSelectedFile();
    } else if (messageText.trim()) {
      // Send text message
      onSendMessage(messageText.trim());
      setMessageText('');
    }
  };

  const handlePickImage = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Cần quyền truy cập', 'Vui lòng cấp quyền truy cập thư viện ảnh');
        return;
      }

      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'Images' as any, // Sử dụng string thay vì deprecated enum
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setSelectedFile({
          uri: asset.uri,
          name: asset.fileName || `image_${Date.now()}.jpg`,
          type: asset.mimeType || 'image/jpeg',
          size: asset.fileSize,
        });
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Lỗi', 'Không thể chọn ảnh');
    }
  };

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        setSelectedFile({
          uri: asset.uri,
          name: asset.name || `file_${Date.now()}`,
          type: asset.mimeType || 'application/octet-stream',
          size: asset.size,
        });
      }
    } catch (error) {
      console.error('Error picking file:', error);
      Alert.alert('Lỗi', 'Không thể chọn file');
    }
  };


  const handleUploadSelectedFile = async () => {
    if (!selectedFile) return;
    
    setIsUploading(true);
    try {
      // Validate file
      const validation = uploadApi.validateFile(selectedFile);
      if (!validation.valid) {
        Alert.alert('Lỗi', validation.error);
        return;
      }

      // Upload file
      const uploadResult = await uploadApi.uploadFile(selectedFile, conversationId);
      
      if (uploadResult.success) {
        // Notify parent component về upload thành công
        onFileUploaded?.(uploadResult);
        // Clear selected file
        setSelectedFile(null);
      } else {
        Alert.alert('Lỗi tải lên', uploadResult.error || 'Không thể tải file lên');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      Alert.alert('Lỗi', 'Không thể tải file lên');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveSelectedFile = () => {
    setSelectedFile(null);
  };

  const handleEmojiPicker = () => {
    // TODO: Implement emoji picker
    Alert.alert('Emoji Picker', 'Tính năng đang phát triển');
  };

  const isDisabled = isSending || isUploading;

  return (
    <View style={styles.container}>
      {/* Upload Progress */}
      <UploadProgress 
        visible={isUploading} 
        fileName={selectedFile?.name}
      />
      
      {/* File Preview */}
      {selectedFile && (
        <FilePreview 
          file={selectedFile} 
          onRemove={handleRemoveSelectedFile}
        />
      )}
      
      <View style={styles.inputRow}>
        {/* Left Actions */}
        <TouchableOpacity 
          style={[styles.attachButton, isDisabled && styles.disabledButton]}
          onPress={handlePickImage}
          disabled={isDisabled}
          activeOpacity={0.7}
        >
          <MaterialIcons name="image" size={20} color={isDisabled ? "#9CA3AF" : "#0084FF"} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.attachButton, isDisabled && styles.disabledButton]}
          onPress={handlePickFile}
          disabled={isDisabled}
          activeOpacity={0.7}
        >
          <MaterialIcons name="attach-file" size={20} color={isDisabled ? "#9CA3AF" : "#0084FF"} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.iconButton, styles.iconButtonHover]}
          onPress={() => Alert.alert('Voice Recording', 'Tính năng ghi âm đang phát triển')}
          disabled={isDisabled}
          activeOpacity={0.7}
        >
          <MaterialIcons name="mic" size={24} color="#0084FF" />
        </TouchableOpacity>

        {/* Text Input */}
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Aa"
            placeholderTextColor="#9CA3AF"
            value={messageText}
            onChangeText={setMessageText}
            multiline
            maxLength={1000}
            editable={!isDisabled}
          />
        </View>
        
        {/* Right Actions */}
        <TouchableOpacity 
          style={[styles.iconButton, styles.iconButtonHover]}
          onPress={handleEmojiPicker}
          disabled={isDisabled}
          activeOpacity={0.7}
        >
          <MaterialIcons name="emoji-emotions" size={26} color="#0084FF" />
        </TouchableOpacity>
        
        {/* Send Button */}
        {(messageText.trim() || selectedFile) ? (
          <TouchableOpacity
            style={[styles.iconButton, styles.iconButtonHover]}
            onPress={handleSend}
            disabled={isDisabled}
            activeOpacity={0.7}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#0084FF" />
            ) : (
              <MaterialIcons name="send" size={24} color="#0084FF" />
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={[styles.iconButton, styles.iconButtonHover]}
            disabled={isDisabled}
            activeOpacity={0.7}
          >
            <MaterialIcons name="thumb-up" size={26} color="#0084FF" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    // Web-compatible shadow
    boxShadow: '0 -2px 4px rgba(0, 0, 0, 0.05)',
    // Native shadow (for mobile)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 5,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'nowrap',
  },
  iconButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  iconButtonHover: {
    // Placeholder for hover effect (handled by activeOpacity)
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: '#F0F2F5',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 4,
    minHeight: 36,
    maxWidth: '100%',
  },
  input: {
    fontSize: 15,
    color: '#1F2937',
    maxHeight: 80,
    lineHeight: 18,
    padding: 0,
    margin: 0,
  },
  attachButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: '#F0F8FF',
    borderWidth: 1,
    borderColor: '#E1F5FE',
  },
  disabledButton: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E5E5E5',
  },
});

export default ChatInputBar;
