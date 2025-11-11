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

interface ChatInputBarProps {
  onSendMessage: (message: string) => void;
  onSendImage?: (imageUri: string) => void;
  onSendFile?: (file: any) => void;
  isSending?: boolean;
}

const ChatInputBar: React.FC<ChatInputBarProps> = ({
  onSendMessage,
  onSendImage,
  onSendFile,
  isSending = false,
}) => {
  const [messageText, setMessageText] = useState('');

  const handleSend = () => {
    if (messageText.trim()) {
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
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        onSendImage?.(result.assets[0].uri);
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

      if (result.type === 'success') {
        onSendFile?.(result);
      }
    } catch (error) {
      console.error('Error picking file:', error);
      Alert.alert('Lỗi', 'Không thể chọn file');
    }
  };

  const handleEmojiPicker = () => {
    // TODO: Implement emoji picker
    Alert.alert('Emoji Picker', 'Tính năng đang phát triển');
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        {/* Left Actions */}
        <TouchableOpacity 
          style={[styles.iconButton, styles.iconButtonHover]}
          onPress={handlePickImage}
          disabled={isSending}
          activeOpacity={0.7}
        >
          <MaterialIcons name="add-circle" size={28} color="#0084FF" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.iconButton, styles.iconButtonHover]}
          onPress={handlePickImage}
          disabled={isSending}
          activeOpacity={0.7}
        >
          <MaterialIcons name="photo-camera" size={24} color="#0084FF" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.iconButton, styles.iconButtonHover]}
          onPress={handlePickImage}
          disabled={isSending}
          activeOpacity={0.7}
        >
          <MaterialIcons name="image" size={24} color="#0084FF" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.iconButton, styles.iconButtonHover]}
          onPress={handlePickFile}
          disabled={isSending}
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
            editable={!isSending}
          />
        </View>
        
        {/* Right Actions */}
        <TouchableOpacity 
          style={[styles.iconButton, styles.iconButtonHover]}
          onPress={handleEmojiPicker}
          disabled={isSending}
          activeOpacity={0.7}
        >
          <MaterialIcons name="emoji-emotions" size={26} color="#0084FF" />
        </TouchableOpacity>
        
        {/* Send Button */}
        {messageText.trim() ? (
          <TouchableOpacity
            style={[styles.iconButton, styles.iconButtonHover]}
            onPress={handleSend}
            disabled={isSending}
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
            disabled={isSending}
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
});

export default ChatInputBar;
