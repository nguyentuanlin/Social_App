import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';

interface MessageBubbleProps {
  content: string;
  contentType: 'text' | 'image' | 'file' | 'voice' | 'email';
  senderType: 'customer' | 'agent' | 'bot';
  sentAt: Date;
  attachments?: any;
  metadata?: any;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  content,
  contentType,
  senderType,
  sentAt,
  attachments,
  metadata,
}) => {
  const isFromCustomer = senderType === 'customer';
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);

  // Cleanup sound on unmount
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const handlePlayPause = async (audioUrl: string) => {
    try {
      if (sound) {
        // If sound exists, toggle play/pause
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          if (isPlaying) {
            await sound.pauseAsync();
            setIsPlaying(false);
          } else {
            await sound.playAsync();
            setIsPlaying(true);
          }
        }
      } else {
        // Load and play new sound
        console.log('Loading audio from:', audioUrl);
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { shouldPlay: true },
          (status: any) => {
            if (status.isLoaded) {
              setPlaybackPosition(status.positionMillis);
              setPlaybackDuration(status.durationMillis || 0);
              if (status.didJustFinish) {
                setIsPlaying(false);
                setPlaybackPosition(0);
              }
            }
          }
        );
        setSound(newSound);
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      Alert.alert('Lỗi', 'Không thể phát audio. Vui lòng thử lại.');
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const messageDate = new Date(date);
    const diffMs = now.getTime() - messageDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút`;
    if (diffHours < 24) return `${diffHours} giờ`;
    if (diffDays < 7) return `${diffDays} ngày`;
    
    return messageDate.toLocaleDateString('vi-VN');
  };

  const renderContent = () => {
    // Check for attachments.files (backend format)
    const files = attachments?.files;
    const hasFiles = Array.isArray(files) && files.length > 0;

    // Render files if they exist
    if (hasFiles) {
      return (
        <View>
          {files.map((file: any, index: number) => {
            const isImage = file.mimeType?.startsWith('image/');
            const isVideo = file.mimeType?.startsWith('video/');
            const isAudio = file.mimeType?.startsWith('audio/');

            // Render image
            if (isImage) {
              return (
                <View key={index}>
                  <Image
                    source={{ uri: file.fileUrl }}
                    style={styles.imageAttachment}
                    resizeMode="cover"
                  />
                  {content && !content.match(/^\[PHOTO\]$/i) && (
                    <Text style={styles.imageCaption}>{content}</Text>
                  )}
                </View>
              );
            }

            // Render audio/voice
            if (isAudio) {
              return (
                <View key={index}>
                  <View style={styles.voicePlayer}>
                    <TouchableOpacity 
                      style={styles.playButton}
                      onPress={() => handlePlayPause(file.fileUrl)}
                    >
                      <MaterialIcons 
                        name={isPlaying ? "pause" : "play-arrow"} 
                        size={20} 
                        color="#3B82F6" 
                      />
                    </TouchableOpacity>
                    <View style={styles.waveformContainer}>
                      <View style={styles.waveform}>
                        <View style={[styles.waveformBar, { height: 12 }]} />
                        <View style={[styles.waveformBar, { height: 20 }]} />
                        <View style={[styles.waveformBar, { height: 16 }]} />
                        <View style={[styles.waveformBar, { height: 24 }]} />
                        <View style={[styles.waveformBar, { height: 14 }]} />
                        <View style={[styles.waveformBar, { height: 22 }]} />
                        <View style={[styles.waveformBar, { height: 18 }]} />
                        <View style={[styles.waveformBar, { height: 20 }]} />
                        <View style={[styles.waveformBar, { height: 16 }]} />
                        <View style={[styles.waveformBar, { height: 24 }]} />
                        <View style={[styles.waveformBar, { height: 12 }]} />
                        <View style={[styles.waveformBar, { height: 20 }]} />
                      </View>
                      <Text style={styles.voiceDuration}>
                        {isPlaying && playbackDuration > 0
                          ? `${Math.floor(playbackPosition / 60000)}:${String(Math.floor((playbackPosition % 60000) / 1000)).padStart(2, '0')}`
                          : file.duration 
                            ? `${Math.floor(file.duration / 60)}:${String(Math.floor(file.duration % 60)).padStart(2, '0')}` 
                            : '0:01'
                        }
                      </Text>
                    </View>
                  </View>
                  {metadata?.transcript && (
                    <View style={styles.transcriptBox}>
                      <MaterialIcons name="subtitles" size={14} color="#6B7280" />
                      <Text style={styles.transcriptText}>{metadata.transcript}</Text>
                    </View>
                  )}
                </View>
              );
            }

            // Render other files
            return (
              <TouchableOpacity key={index} style={styles.fileContainer}>
                <MaterialIcons name="insert-drive-file" size={32} color="#3B82F6" />
                <View style={styles.fileInfo}>
                  <Text style={styles.fileName} numberOfLines={1}>
                    {file.originalName || 'File đính kèm'}
                  </Text>
                  <Text style={styles.fileSize}>
                    {file.size ? `${(file.size / 1024).toFixed(1)} KB` : 'Unknown size'}
                  </Text>
                </View>
                <MaterialIcons name="download" size={20} color="#6B7280" />
              </TouchableOpacity>
            );
          })}
        </View>
      );
    }

    // Fallback to content-based rendering (old format)
    switch (contentType) {
      case 'image':
        return (
          <View>
            {attachments && Array.isArray(attachments) && attachments.length > 0 && (
              <Image
                source={{ uri: attachments[0].url }}
                style={styles.imageAttachment}
                resizeMode="cover"
              />
            )}
            {content && <Text style={styles.imageCaption}>{content}</Text>}
          </View>
        );

      case 'voice':
        return (
          <View>
            <View style={styles.voicePlayer}>
              <TouchableOpacity 
                style={styles.playButton}
                onPress={() => {
                  // Fallback for old format - need audio URL
                  Alert.alert('Thông báo', 'Voice message cần có URL để phát');
                }}
              >
                <MaterialIcons 
                  name={isPlaying ? "pause" : "play-arrow"} 
                  size={20} 
                  color="#3B82F6" 
                />
              </TouchableOpacity>
              <View style={styles.waveformContainer}>
                <View style={styles.waveform}>
                  <View style={[styles.waveformBar, { height: 12 }]} />
                  <View style={[styles.waveformBar, { height: 20 }]} />
                  <View style={[styles.waveformBar, { height: 16 }]} />
                  <View style={[styles.waveformBar, { height: 24 }]} />
                  <View style={[styles.waveformBar, { height: 14 }]} />
                  <View style={[styles.waveformBar, { height: 22 }]} />
                  <View style={[styles.waveformBar, { height: 18 }]} />
                  <View style={[styles.waveformBar, { height: 20 }]} />
                  <View style={[styles.waveformBar, { height: 16 }]} />
                  <View style={[styles.waveformBar, { height: 24 }]} />
                  <View style={[styles.waveformBar, { height: 12 }]} />
                  <View style={[styles.waveformBar, { height: 20 }]} />
                </View>
                <Text style={styles.voiceDuration}>
                  {metadata?.duration || '0:01'}
                </Text>
              </View>
            </View>
            {metadata?.transcript && (
              <View style={styles.transcriptBox}>
                <MaterialIcons name="subtitles" size={14} color="#6B7280" />
                <Text style={styles.transcriptText}>{metadata.transcript}</Text>
              </View>
            )}
          </View>
        );

      case 'file':
        return (
          <TouchableOpacity style={styles.fileContainer}>
            <MaterialIcons name="insert-drive-file" size={32} color="#3B82F6" />
            <View style={styles.fileInfo}>
              <Text style={styles.fileName} numberOfLines={1}>
                {metadata?.fileName || 'File đính kèm'}
              </Text>
              <Text style={styles.fileSize}>
                {metadata?.fileSize || 'Unknown size'}
              </Text>
            </View>
            <MaterialIcons name="download" size={20} color="#6B7280" />
          </TouchableOpacity>
        );

      default:
        // Only show text if it's not a placeholder
        const upper = content?.toUpperCase() || '';
        const isPlaceholder = ['[PHOTO]', '[VOICE]', '[VIDEO]', '[DOCUMENT]', '[AUDIO]', '[STICKER]'].includes(upper);
        if (isPlaceholder) return null;
        
        return (
          <Text
            style={[
              styles.messageText,
              isFromCustomer ? styles.messageTextCustomer : styles.messageTextAgent,
            ]}
          >
            {content}
          </Text>
        );
    }
  };

  return (
    <View
      style={[
        styles.messageContainer,
        isFromCustomer ? styles.messageLeft : styles.messageRight,
      ]}
    >
      <View
        style={[
          styles.messageBubble,
          isFromCustomer ? styles.messageBubbleCustomer : styles.messageBubbleAgent,
        ]}
      >
        {renderContent()}
        <Text
          style={[
            styles.messageTime,
            isFromCustomer ? styles.messageTimeCustomer : styles.messageTimeAgent,
          ]}
        >
          {formatTime(sentAt)}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  messageContainer: {
    marginBottom: 12,
    maxWidth: '80%',
  },
  messageLeft: {
    alignSelf: 'flex-start',
  },
  messageRight: {
    alignSelf: 'flex-end',
  },
  messageBubble: {
    borderRadius: 16,
    padding: 12,
  },
  messageBubbleCustomer: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
  },
  messageBubbleAgent: {
    backgroundColor: '#3B82F6',
    borderBottomRightRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageTextCustomer: {
    color: '#1F2937',
  },
  messageTextAgent: {
    color: '#FFFFFF',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  messageTimeCustomer: {
    color: '#9CA3AF',
  },
  messageTimeAgent: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  imageAttachment: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 8,
  },
  imageCaption: {
    fontSize: 14,
    color: '#1F2937',
  },
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 12,
    gap: 12,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  fileSize: {
    fontSize: 12,
    color: '#6B7280',
  },
  voiceLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  voicePlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F0F4FF',
    borderRadius: 20,
    padding: 8,
    marginBottom: 4,
  },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  waveformContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  waveform: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 28,
  },
  waveformBar: {
    width: 3,
    backgroundColor: '#3B82F6',
    borderRadius: 2,
  },
  voiceDuration: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  voiceFormat: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
  },
  transcriptBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 8,
    padding: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3B82F6',
  },
  transcriptText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
});

export default MessageBubble;
