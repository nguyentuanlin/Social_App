import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import { uploadApi } from '../../services/apiUpload';
import FilePreview from './FilePreview';
import UploadProgress from './UploadProgress';
import EmojiPicker from './EmojiPicker';

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
  const [showActions, setShowActions] = useState(true);
  const [inputHeight, setInputHeight] = useState(40);
  const [emojiVisible, setEmojiVisible] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSec, setRecordingSec] = useState(0);
  const recordingRef = React.useRef<Audio.Recording | null>(null);
  const timerRef = React.useRef<any>(null);
  const inputRef = React.useRef<TextInput>(null);
  // Web recording
  const webStreamRef = React.useRef<MediaStream | null>(null);
  const webRecorderRef = React.useRef<MediaRecorder | null>(null);
  const webChunksRef = React.useRef<BlobPart[]>([]);

  const actionsAnim = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (Platform.OS === 'android' && (UIManager as any).setLayoutAnimationEnabledExperimental) {
      (UIManager as any).setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

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

      // Pick image (chỉ ảnh)
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
        setShowActions(false);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Lỗi', 'Không thể chọn ảnh');
    }
  };

  const handlePickFile = async () => {
    try {
      // Chỉ chọn tài liệu/âm thanh/video, KHÔNG nhận ảnh
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/*', 'text/*', 'audio/*', 'video/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const mime = asset.mimeType || '';
        if (mime.startsWith('image/')) {
          Alert.alert('Chọn sai loại', 'Vui lòng dùng nút Ảnh để chọn hình ảnh');
          return;
        }
        setSelectedFile({
          uri: asset.uri,
          name: asset.name || `file_${Date.now()}`,
          type: mime || 'application/octet-stream',
          size: asset.size,
        });
        setShowActions(false);
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
    setEmojiVisible(true);
  };

  const handleToggleActions = () => {
    if (isSending || isUploading) return;
    // Khi ô nhập trống, luôn hiển thị đầy đủ action => không toggle
    if (messageText.trim().length === 0) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowActions((prev) => !prev);
  };

  const handleSendLike = () => {
    if (isDisabled) return;
    onSendMessage('👍');
  };

  const isDisabled = isSending || isUploading;

  // Tự động hiển thị đầy đủ khi ô nhập trống, và thu vào khi người dùng bắt đầu gõ
  useEffect(() => {
    const empty = messageText.trim().length === 0;
    if (empty !== showActions) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setShowActions(empty);
    }
  }, [messageText]);

  useEffect(() => {
    Animated.timing(actionsAnim, {
      toValue: showActions ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [showActions]);

  const formatSec = (s: number) => {
    const m = Math.floor(s / 60);
    const ss = s % 60;
    return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  };

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setRecordingSec(0);
    timerRef.current = setInterval(() => setRecordingSec(prev => prev + 1), 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleStartVoice = async () => {
    try {
      if (Platform.OS === 'web') {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        webStreamRef.current = stream;
        const recorder = new MediaRecorder(stream);
        webChunksRef.current = [];
        (recorder as any).ondataavailable = (e: any) => {
          if (e?.data && e.data.size > 0) webChunksRef.current.push(e.data);
        };
        recorder.start();
        webRecorderRef.current = recorder;
      } else {
        const perm = await Audio.requestPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Cần quyền micro', 'Vui lòng cấp quyền ghi âm');
          return;
        }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const recording = new Audio.Recording();
        await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        await recording.startAsync();
        recordingRef.current = recording;
      }
      setIsRecording(true);
      startTimer();
    } catch (e) {
      console.error('Start voice error:', e);
      Alert.alert('Lỗi', 'Không thể bắt đầu ghi âm');
    }
  };

  const handleCancelVoice = async () => {
    try {
      stopTimer();
      setIsRecording(false);
      setRecordingSec(0);
      if (Platform.OS === 'web') {
        webRecorderRef.current?.stop();
        webRecorderRef.current = null;
        webStreamRef.current?.getTracks().forEach(t => t.stop());
        webStreamRef.current = null;
        webChunksRef.current = [];
      } else {
        if (recordingRef.current) {
          try { await recordingRef.current.stopAndUnloadAsync(); } catch {}
          recordingRef.current = null;
        }
      }
    } catch {}
  };

  const handleStopVoice = async () => {
    try {
      stopTimer();
      setIsRecording(false);
      let fileObj: any = null;
      if (Platform.OS === 'web') {
        const rec = webRecorderRef.current;
        if (rec && rec.state !== 'inactive') rec.stop();
        webRecorderRef.current = null;
        const blob = new Blob(webChunksRef.current, { type: 'audio/webm' });
        webChunksRef.current = [];
        webStreamRef.current?.getTracks().forEach(t => t.stop());
        webStreamRef.current = null;

        // Convert to data URL
        const dataUrl: string = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        fileObj = {
          uri: dataUrl,
          name: `voice_${Date.now()}.webm`,
          type: 'audio/webm',
          size: blob.size,
        };
      } else {
        const rec = recordingRef.current;
        if (!rec) return;
        await rec.stopAndUnloadAsync();
        const uri = rec.getURI();
        recordingRef.current = null;
        fileObj = {
          uri: uri!,
          name: `voice_${Date.now()}.m4a`,
          type: Platform.OS === 'ios' ? 'audio/mp4' : 'audio/m4a',
        };
      }

      if (fileObj) {
        setSelectedFile(fileObj);
        await handleUploadSelectedFile();
      }
    } catch (e) {
      console.error('Stop voice error:', e);
      Alert.alert('Lỗi', 'Không thể kết thúc ghi âm');
    }
  };

  return (
    <View style={styles.container}>
      {isRecording && (
        <View style={styles.recordBar}>
          <View style={styles.recordDot} />
          <Animated.Text style={styles.recordTime}>{formatSec(recordingSec)}</Animated.Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={[styles.recBtn, styles.recBtnCancel]} onPress={handleCancelVoice}>
            <MaterialIcons name="close" size={18} color="#EF4444" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.recBtn, styles.recBtnSend]} onPress={handleStopVoice}>
            <MaterialIcons name="send" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}
      <EmojiPicker
        visible={emojiVisible}
        onClose={() => setEmojiVisible(false)}
        multi
        onApply={(list) => {
          if (list && list.length > 0) {
            setMessageText(prev => (prev || '') + list.join(''));
          }
          setEmojiVisible(false);
        }}
        onSelect={(em) => {
          // fallback khi dùng chế độ single
          setMessageText(prev => (prev || '') + em);
          setEmojiVisible(false);
        }}
      />
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

      {/* Inline actions sẽ hiển thị trong dòng nhập ở dưới */}
      
      <View style={styles.inputRow}>
        {/* Left: inline actions OR plus button */}
        {showActions ? (
          <Animated.View
            style={[
              styles.actionsRow,
              {
                opacity: actionsAnim,
                transform: [
                  { translateY: actionsAnim.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) },
                  { scale: actionsAnim.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) },
                ],
              },
            ]}
          >
            <TouchableOpacity 
              style={[styles.actionCircle, isDisabled && styles.disabledButton]}
              onPress={handlePickImage}
              disabled={isDisabled}
              activeOpacity={0.7}
            >
              <MaterialIcons name="image" size={20} color={isDisabled ? "#9CA3AF" : "#0084FF"} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionCircle, isDisabled && styles.disabledButton]}
              onPress={handlePickFile}
              disabled={isDisabled}
              activeOpacity={0.7}
            >
              <MaterialIcons name="attach-file" size={20} color={isDisabled ? "#9CA3AF" : "#0084FF"} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionCircle, isDisabled && styles.disabledButton]}
              onPress={isRecording ? handleStopVoice : handleStartVoice}
              disabled={isDisabled}
              activeOpacity={0.7}
            >
              <MaterialIcons name={isRecording ? "stop" : "mic"} size={20} color={isDisabled ? "#9CA3AF" : (isRecording ? "#EF4444" : "#0084FF")} />
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <TouchableOpacity 
            style={[styles.attachButton, isDisabled && styles.disabledButton]}
            onPress={handleToggleActions}
            disabled={isDisabled}
            activeOpacity={0.7}
          >
            <MaterialIcons name="add" size={22} color={isDisabled ? "#9CA3AF" : "#0084FF"} />
          </TouchableOpacity>
        )}

        {/* Text Input */}
        <View style={styles.inputWrapper}>
          <View style={styles.inputInner}>
            <TextInput
              ref={inputRef}
              style={[
                styles.input,
                { height: inputHeight, textAlignVertical: inputHeight > 40 ? 'top' as any : 'center' as any }
              ]}
              placeholder=""
              placeholderTextColor="#B0B7C3"
              value={messageText}
              onChangeText={setMessageText}
              multiline
              editable={!isDisabled}
              onContentSizeChange={(e) => {
                const h = e.nativeEvent.contentSize.height;
                const next = Math.min(160, Math.max(40, h));
                if (next !== inputHeight) setInputHeight(next);
              }}
              scrollEnabled={inputHeight >= 160}
            />
            {messageText.trim().length === 0 && (
              <TouchableOpacity
                style={styles.placeholderWrap}
                activeOpacity={1}
                onPress={() => inputRef.current?.focus()}
              >
                <Animated.Text style={styles.placeholderCustom}>Aa</Animated.Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.emojiInsideBtn}
              onPress={handleEmojiPicker}
              disabled={isDisabled}
              activeOpacity={0.7}
            >
              <MaterialIcons name="emoji-emotions" size={18} color="#6B7280" />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Right Actions (đã chuyển emoji vào trong ô nhập) */}
        
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
            onPress={handleSendLike}
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
    paddingBottom: 14,
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
    marginBottom: 10,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 2,
  },
  actionCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'nowrap',
    marginBottom: 2,
  },
  iconButton: {
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 17,
  },
  iconButtonHover: {
    // Placeholder for hover effect (handled by activeOpacity)
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 20,
    paddingHorizontal: 0,
    paddingVertical: 2,
    marginHorizontal: 4,
    alignSelf: 'center',
    minHeight: 40,
    maxHeight: 160,
    maxWidth: '100%',
  },
  inputInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingLeft: 14,
    paddingRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    maxWidth: 680,
    width: '100%',
    boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  input: {
    fontSize: 14,
    color: '#111827',
    lineHeight: 18,
    padding: 0,
    margin: 0,
    textAlignVertical: 'top',
    flex: 1,
  },
  attachButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: '#F0F8FF',
    borderWidth: 1,
    borderColor: '#E1F5FE',
  },
  disabledButton: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E5E5E5',
  },
  emojiInsideBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
    backgroundColor: 'transparent',
  },
  placeholderWrap: {
    position: 'absolute',
    left: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  placeholderCustom: {
    color: '#C4CBD4',
    fontSize: 15,
    letterSpacing: 0.2,
  },
  recordBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 8,
  },
  recordDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  recordTime: {
    color: '#9A3412',
    fontWeight: '600',
  },
  recBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
    borderWidth: 1,
  },
  recBtnCancel: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FECACA',
  },
  recBtnSend: {
    backgroundColor: '#2563EB',
    borderColor: '#1D4ED8',
  },
});

export default ChatInputBar;
