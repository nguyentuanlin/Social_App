import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert, Pressable, Dimensions, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import ReactionBadge from './ReactionBadge';
import { ReactionSummary } from '../../services/apiReactions';

interface MessageBubbleProps {
  content: string;
  contentType: 'text' | 'image' | 'file' | 'voice' | 'email';
  senderType: 'customer' | 'agent' | 'bot';
  sentAt: Date;
  attachments?: any;
  metadata?: any;
  messageId?: string;
  reactions?: ReactionSummary[];
  onOpenLabelPicker?: (messageId: string) => void;
  onReply?: (messageId: string) => void;
  onTranslate?: (messageId: string) => void;
  onMore?: (messageId: string) => void;
  onOpenContext?: (params: { id: string; anchor: { x: number; y: number; width: number; height: number }; isFromCustomer: boolean; content?: string }) => void;
  onAddReaction?: (messageId: string, emoji: string) => void;
  onRemoveReaction?: (messageId: string, emoji: string) => void;
  onShowReactions?: (messageId: string) => void;
  replyTo?: { author?: string; content?: string } | null;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  content,
  contentType,
  senderType,
  sentAt,
  attachments,
  metadata,
  messageId,
  reactions = [],
  onOpenLabelPicker,
  onReply,
  onTranslate,
  onMore,
  onOpenContext,
  onAddReaction,
  onRemoveReaction,
  onShowReactions,
  replyTo,
}) => {
  const isFromCustomer = senderType === 'customer';
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const containerRef = useRef<View>(null);
  const transcriptText =
    typeof metadata?.transcript === 'string'
      ? metadata.transcript
      : (metadata?.transcript?.text || '');
 
  // Determine if this message is an image message to render without bubble background
  const hasImageFiles = Array.isArray(attachments?.files) && attachments.files.some((f: any) => f?.mimeType?.startsWith('image/'));
  const isImageMessage = hasImageFiles || contentType === 'image';

  // Auto size image to a moderate box while keeping aspect ratio
  const AutoImage: React.FC<{ uri: string }> = ({ uri }) => {
    const [size, setSize] = useState<{ w: number; h: number } | null>(null);
    const screenW = Dimensions.get('window').width;
    const maxW = Math.min(Math.round(screenW * 0.55), 260); // moderate width
    const maxH = 320; // cap height

    useEffect(() => {
      let mounted = true;
      // Try read from caches (memory + sessionStorage on web)
      try {
        let cached: { w: number; h: number } | null = null;
        // Memory cache
        // @ts-ignore
        if (typeof (globalThis as any).__imgSizeCache === 'undefined') {
          // @ts-ignore
          (globalThis as any).__imgSizeCache = {} as Record<string, { w: number; h: number }>;
        }
        // @ts-ignore
        const memCache = (globalThis as any).__imgSizeCache as Record<string, { w: number; h: number }>;
        if (memCache[uri]) {
          cached = memCache[uri];
        } else if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
          const raw = window.sessionStorage.getItem('imgsize:' + uri);
          if (raw) {
            try { cached = JSON.parse(raw); } catch {}
            if (cached && cached.w && cached.h) memCache[uri] = cached;
          }
        }
        if (cached && cached.w && cached.h) {
          const scale = Math.min(maxW / cached.w, maxH / cached.h, 1);
          setSize({ w: Math.max(1, Math.round(cached.w * scale)), h: Math.max(1, Math.round(cached.h * scale)) });
          return () => { mounted = false; };
        }

        Image.getSize(
          uri,
          (w, h) => {
            if (!mounted) return;
            const scale = Math.min(maxW / w, maxH / h, 1);
            const computed = { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) };
            setSize(computed);
            try {
              // Save to caches
              memCache[uri] = { w, h };
              if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
                window.sessionStorage.setItem('imgsize:' + uri, JSON.stringify({ w, h }));
              }
            } catch {}
          },
          () => {
            if (!mounted) return;
            setSize({ w: maxW, h: Math.round(maxW * 9 / 16) });
          }
        );
      } catch {
        if (mounted) setSize({ w: maxW, h: Math.round(maxW * 9 / 16) });
      }
      return () => { mounted = false; };
    }, [uri]);

    return (
      <Image
        source={{ uri }}
        style={[
          styles.imageAttachment,
          size ? { width: size.w, height: size.h } : { width: maxW, height: Math.round(maxW * 9 / 16) }
        ]}
        resizeMode="contain"
      />
    );
  };

  // Cleanup sound on unmount
  // Compute readable text color for label background
  const getTextColorForBg = (hex: string) => {
    const c = hex?.replace('#', '');
    if (c?.length === 6) {
      const r = parseInt(c.slice(0, 2), 16);
      const g = parseInt(c.slice(2, 4), 16);
      const b = parseInt(c.slice(4, 6), 16);
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      return lum > 180 ? '#111827' : '#FFFFFF';
    }
    return '#FFFFFF';
  };

  // Cleanup sound on unmount
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  // no auto-hide needed, overlay handled by parent

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
    let msg = new Date(date);
    let diffMs = now.getTime() - msg.getTime();
    // Nếu server trả thời gian bị +7h (hoặc tương tự) khiến diff âm nhưng nhỏ hơn 12h, hiệu chỉnh về local
    if (diffMs < -5 * 60 * 1000 && Math.abs(diffMs) < 12 * 60 * 60 * 1000) {
      const tzMs = new Date().getTimezoneOffset() * 60 * 1000; // VN: -420 phút
      msg = new Date(msg.getTime() - (-tzMs)); // trừ (+7h) nếu offset âm
      diffMs = now.getTime() - msg.getTime();
    }

    if (diffMs < 0) diffMs = 0; // chặn trường hợp lệch nhỏ

    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;

    const dd = String(msg.getDate()).padStart(2, '0');
    const mm = String(msg.getMonth() + 1).padStart(2, '0');
    const yyyy = msg.getFullYear();
    const hh = String(msg.getHours()).padStart(2, '0');
    const mi = String(msg.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
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
                <React.Fragment key={index}>
                  <View>
                    <AutoImage uri={file.fileUrl} />
                    {content && !content.match(/^\[PHOTO\]$/i) && (
                      <Text style={styles.imageCaption}>{content}</Text>
                    )}
                  </View>
                </React.Fragment>
              );
            }

            // Render audio/voice
            if (isAudio) {
              return (
                <React.Fragment key={index}>
                  <View>
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
                    {transcriptText && (
                      <View style={styles.transcriptBox}>
                        <MaterialIcons name="subtitles" size={14} color="#6B7280" />
                        <Text style={styles.transcriptText}>{transcriptText}</Text>
                      </View>
                    )}
                  </View>
                </React.Fragment>
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
              <AutoImage uri={attachments[0].url} />
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
            {transcriptText && (
              <View style={styles.transcriptBox}>
                <MaterialIcons name="subtitles" size={14} color="#6B7280" />
                <Text style={styles.transcriptText}>{transcriptText}</Text>
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
        isImageMessage ? styles.imageContainer : null,
      ]}
    >
      <View ref={containerRef} style={{ position: 'relative' }}>
        {replyTo && (
          <View style={[
            styles.replyHeader,
            isFromCustomer ? styles.replyHeaderCustomer : styles.replyHeaderAgent
          ]}>
            <View style={styles.replyHeaderRow}>
              <MaterialIcons name="reply" size={16} color={isFromCustomer ? '#4B5563' : '#111827'} />
              <Text
                style={[
                  styles.replyHeaderText,
                  isFromCustomer ? styles.replyHeaderTextCustomer : styles.replyHeaderTextAgent
                ]}
                numberOfLines={1}
              >
                Bạn đã trả lời {replyTo.author || 'tin nhắn'}
              </Text>
            </View>
            {!!replyTo.content && (
              <Text
                style={[
                  styles.replyHeaderSnippet,
                  isFromCustomer ? styles.replyHeaderSnippetCustomer : styles.replyHeaderSnippetAgent
                ]}
                numberOfLines={1}
              >
                {replyTo.content}
              </Text>
            )}
          </View>
        )}

        <Pressable
          onLongPress={() => {
            const id = messageId || (metadata?.id as string);
            if (!id) return;
            try {
              containerRef.current?.measureInWindow((x, y, width, height) => {
                onOpenContext?.({ id, anchor: { x, y, width, height }, isFromCustomer, content });
              });
            } catch {}
          }}
          delayLongPress={250}
          style={({ pressed }) => [
            styles.messageBubble,
            isFromCustomer ? styles.messageBubbleCustomer : styles.messageBubbleAgent,
            isImageMessage ? styles.imageMessageWrapper : null,
            pressed ? { opacity: 0.98 } : null,
          ]}
        >
          {renderContent()}
          
          {/* Reaction Badge */}
          {reactions && reactions.length > 0 && messageId && (
            <ReactionBadge 
              reactions={reactions}
              onPress={() => onShowReactions?.(messageId)}
              isFromCustomer={isFromCustomer} 
            />
          )}

          {Array.isArray(metadata?.__labels) && metadata.__labels.length > 0 && (
            <View
              style={[
                styles.labelRow,
                isFromCustomer ? styles.labelRowCustomer : styles.labelRowAgent,
              ]}
            >
              {metadata.__labels.map((ml: any, idx: number) => {
                const label = ml.label || {};
                const bg = label.color || '#6B7280';
                const textColor = getTextColorForBg(bg);
                return (
                  <React.Fragment key={idx}>
                    <View
                      style={{
                        backgroundColor: bg,
                        borderRadius: 4,
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        minHeight: 20,
                        justifyContent: 'center',
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: 'rgba(0,0,0,0.08)'
                      }}
                    >
                      <Text style={{ color: textColor, fontSize: 11, fontWeight: '600' }}>
                        {label.name || ml.labelId}
                      </Text>
                    </View>
                  </React.Fragment>
                );
              })}
            </View>
          )}

          <Text
            style={[
              styles.messageTime,
              isImageMessage
                ? styles.messageTimeNeutral
                : (isFromCustomer ? styles.messageTimeCustomer : styles.messageTimeAgent),
            ]}
          >
            {formatTime(sentAt)}
          </Text>
        </Pressable>

        {/* Context overlay is handled by parent (ChatScreen) */}
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
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
    paddingTop: 6,
  },
  labelRowCustomer: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  labelRowAgent: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.25)',
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
  messageTimeNeutral: {
    color: '#6B7280',
  },
  imageMessageWrapper: {
    backgroundColor: 'transparent',
    padding: 0,
    borderRadius: 0,
  },
  imageContainer: {
    maxWidth: '100%',
  },
  imageAttachment: {
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
  actionBar: {
    position: 'absolute',
    top: -28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 20,
  },
  actionBarLeft: {
    left: 0,
  },
  actionBarRight: {
    right: 0,
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  reactionWrapper: {
    position: 'absolute',
    top: -46,
  },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(17, 24, 39, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  reactionEmoji: {
    fontSize: 18,
    marginHorizontal: 3,
  },
  reactionPlus: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  actionMenu: {
    position: 'absolute',
    bottom: -10,
    backgroundColor: 'rgba(17,24,39,0.96)',
    borderRadius: 12,
    paddingVertical: 6,
    minWidth: 180,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  actionMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  actionMenuText: {
    color: '#E5E7EB',
    fontSize: 14,
  },
  actionMenuDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 4,
  },
  actionMenuDanger: {
    color: '#EF4444',
    fontWeight: '600',
  },
  replyHeader: {
    marginBottom: 4,
  },
  replyHeaderCustomer: {
    alignSelf: 'flex-start',
  },
  replyHeaderAgent: {
    alignSelf: 'flex-end',
  },
  replyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  replyHeaderText: {
    fontSize: 14,
    fontWeight: '700',
  },
  replyHeaderTextCustomer: {
    color: '#1F2937',
  },
  replyHeaderTextAgent: {
    color: '#111827',
  },
  replyHeaderSnippet: {
    fontSize: 12,
    marginTop: 1,
  },
  replyHeaderSnippetCustomer: {
    color: '#374151',
  },
  replyHeaderSnippetAgent: {
    color: '#374151',
  },
  replyWrap: {
    marginBottom: 6,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
  },
  replyWrapCustomer: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
  },
  replyWrapAgent: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.25)',
  },
  replyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  replyLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  replyLabelCustomer: {
    color: '#374151',
  },
  replyLabelAgent: {
    color: 'rgba(255,255,255,0.95)',
  },
  replySnippet: {
    fontSize: 12,
  },
  replySnippetCustomer: {
    color: '#6B7280',
  },
  replySnippetAgent: {
    color: 'rgba(255,255,255,0.85)',
  },
});

export default MessageBubble;
