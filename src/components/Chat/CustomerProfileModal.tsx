import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Linking,
  Dimensions,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import CSIChart from './CSIChart';
import EditCustomerModal from './EditCustomerModal';
import { chatApi } from '../../services/apiChat';

interface CustomerProfileModalProps {
  visible: boolean;
  onClose: () => void;
  customer: any;
  conversation: any;
}

const CustomerProfileModal: React.FC<CustomerProfileModalProps> = ({
  visible,
  onClose,
  customer,
  conversation,
}) => {
  const [expandedSections, setExpandedSections] = useState<{[key: string]: boolean}>({
    csi: false,
    notes: false,
    media: false,
    voice: false,
    files: false,
  });
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [customerData, setCustomerData] = useState(customer);
  const [mediaFiles, setMediaFiles] = useState<any[]>([]);
  const [voiceFiles, setVoiceFiles] = useState<any[]>([]);
  const [documentFiles, setDocumentFiles] = useState<any[]>([]);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const screen = Dimensions.get('window');
  const screenW = screen.width;
  const screenH = screen.height;
  const insets = useSafeAreaInsets();

  const imageItems = React.useMemo(() => mediaFiles.filter((m) => m.type === 'image'), [mediaFiles]);
  const viewerListRef = React.useRef<FlatList>(null);

  const openImageViewer = (fileId: string) => {
    const idx = imageItems.findIndex((it) => it.id === fileId);
    if (idx >= 0) {
      setViewerIndex(idx);
      setViewerVisible(true);
    }
  };

  useEffect(() => {
    if (viewerVisible && viewerListRef.current && imageItems.length > 0) {
      setTimeout(() => {
        try {
          viewerListRef.current?.scrollToIndex({ index: Math.min(Math.max(viewerIndex, 0), imageItems.length - 1), animated: false });
        } catch {}
      }, 0);
    }
  }, [viewerVisible, viewerIndex, imageItems.length]);

  // Load media files from conversation messages
  useEffect(() => {
    if (visible && conversation?.id) {
      loadMediaFiles();
    }
  }, [visible, conversation?.id]);

  const loadMediaFiles = async () => {
    try {
      setIsLoadingMedia(true);
      // Fetch messages from conversation
      const conversationData: any = await chatApi.getConversation(conversation.id);
      const messages = conversationData.messages || [];

      // Helpers
      const isValidUrl = (val?: string) => typeof val === 'string' && /^https?:\/\//.test(val);
      const guessTypeByUrl = (url: string): 'image' | 'video' | 'file' => {
        const lower = url.toLowerCase();
        if (/(\.jpg|\.jpeg|\.png|\.gif|\.webp)(\?|$)/.test(lower)) return 'image';
        if (/(\.mp4|\.mov|\.webm|\.mkv)(\?|$)/.test(lower)) return 'video';
        return 'file';
      };

      // Buckets
      const media: any[] = [];
      const voice: any[] = [];
      const docs: any[] = [];

      messages.forEach((msg: any) => {
        const files = (msg?.metadata?.attachments?.files || msg?.attachments?.files || []) as any[];

        if (Array.isArray(files) && files.length > 0) {
          files.forEach((f) => {
            const mime: string = f?.mimeType || '';
            const url: string = f?.fileUrl || f?.url || '';
            if (!url) return;

            if (mime.startsWith('image/')) {
              media.push({ id: `${msg.id}:${url}`, type: 'image', url, sentAt: msg.sentAt });
            } else if (mime.startsWith('video/')) {
              media.push({ id: `${msg.id}:${url}`, type: 'video', url, sentAt: msg.sentAt });
            } else if (mime.startsWith('audio/')) {
              voice.push({ id: `${msg.id}:${url}`, type: 'audio', url, sentAt: msg.sentAt });
            } else {
              docs.push({
                id: `${msg.id}:${url}`,
                name: f?.originalName || f?.fileName || 'Tệp đính kèm',
                url,
                sentAt: msg.sentAt,
              });
            }
          });
        } else {
          // Fallbacks: contentType + content URL or extract URL from text
          if ((msg.contentType === 'image' || msg.contentType === 'video') && isValidUrl(msg.content)) {
            media.push({ id: msg.id, type: msg.contentType, url: msg.content, sentAt: msg.sentAt });
          } else if (typeof msg.content === 'string') {
            const match = msg.content.match(/https?:\/\/\S+/);
            if (match && match[0]) {
              const url = match[0];
              const t = guessTypeByUrl(url);
              if (t === 'image' || t === 'video') {
                media.push({ id: msg.id, type: t, url, sentAt: msg.sentAt });
              } else {
                docs.push({ id: msg.id, name: msg.content, url, sentAt: msg.sentAt });
              }
            }
          }
        }
      });

      setMediaFiles(media);
      setVoiceFiles(voice);
      setDocumentFiles(docs);
    } catch (error) {
      console.error('Error loading media files:', error);
    } finally {
      setIsLoadingMedia(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const getPlatformIcon = (platform?: string) => {
    switch (platform?.toLowerCase()) {
      case 'facebook':
        return 'facebook';
      case 'telegram':
        return 'telegram';
      case 'instagram':
        return 'camera';
      case 'gmail':
        return 'email';
      default:
        return 'chat';
    }
  };

  const getPlatformColor = (platform?: string) => {
    switch (platform?.toLowerCase()) {
      case 'facebook':
        return '#1877F2';
      case 'telegram':
        return '#0088CC';
      case 'instagram':
        return '#E4405F';
      case 'gmail':
        return '#EA4335';
      default:
        return '#6B7280';
    }
  };

  const platform = conversation?.channel?.socialNetwork?.name || 
                   conversation?.channel?.social?.platform || 
                   'Unknown';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <MaterialIcons name="close" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Thông tin khách hàng</Text>
          <TouchableOpacity style={styles.editButton}>
            <MaterialIcons name="edit" size={20} color="#0084FF" />
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.content}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 96 + insets.bottom, minHeight: screenH + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
          scrollIndicatorInsets={{ bottom: 36 + insets.bottom }}
          contentInset={{ bottom: 96 + insets.bottom }}
          nestedScrollEnabled
          contentInsetAdjustmentBehavior="always"
        >
          {/* Customer Info */}
          <View style={styles.customerInfo}>
            {customer?.avatarUrl ? (
              <Image
                source={{ uri: customer.avatarUrl }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {(customer?.fullName || customer?.name || 'K').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}

            <Text style={styles.customerName}>
              {customer?.fullName || customer?.name || 'Khách hàng'}
            </Text>

            {/* Platform Badge */}
            <View style={[styles.platformBadge, { backgroundColor: getPlatformColor(platform) }]}>
              <MaterialIcons 
                name={getPlatformIcon(platform) as any} 
                size={14} 
                color="#FFFFFF" 
              />
              <Text style={styles.platformText}>{platform}</Text>
            </View>

            {/* Status Badge */}
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Đang hoạt động</Text>
            </View>
          </View>

          {/* Contact Info */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Thông tin cá nhân</Text>
              <TouchableOpacity 
                style={styles.updateButton}
                onPress={() => setEditModalVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.updateButtonText}>Cập nhật</Text>
                <MaterialIcons name="edit" size={14} color="#0084FF" />
              </TouchableOpacity>
            </View>
            
            {/* Name */}
            <View style={styles.infoRow}>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Họ và tên</Text>
                <Text style={styles.infoValue}>
                  {customerData?.fullName || customerData?.name || 'Chưa cập nhật'}
                </Text>
              </View>
            </View>

            {/* Phone */}
            {customerData?.phone ? (
              <TouchableOpacity 
                style={styles.infoRow}
                onPress={() => Linking.openURL(`tel:${customerData.phone}`)}
                activeOpacity={0.7}
              >
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Số điện thoại</Text>
                  <Text style={styles.infoValue}>{customerData.phone}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color="#D1D5DB" />
              </TouchableOpacity>
            ) : (
              <View style={styles.infoRow}>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Số điện thoại</Text>
                  <Text style={styles.infoValueEmpty}>Chưa cập nhật</Text>
                </View>
              </View>
            )}

            {/* Email */}
            {customerData?.email ? (
              <TouchableOpacity 
                style={styles.infoRow}
                onPress={() => Linking.openURL(`mailto:${customerData.email}`)}
                activeOpacity={0.7}
              >
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Email</Text>
                  <Text style={styles.infoValue}>{customerData.email}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color="#D1D5DB" />
              </TouchableOpacity>
            ) : (
              <View style={styles.infoRow}>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Email</Text>
                  <Text style={styles.infoValueEmpty}>Chưa cập nhật</Text>
                </View>
              </View>
            )}

            {/* Address */}
            <View style={styles.infoRow}>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Địa chỉ</Text>
                <Text style={styles.infoValue}>
                  {customerData?.address || 'Chưa có địa chỉ'}
                </Text>
              </View>
            </View>
          </View>

          {/* CSI Section */}
          <View style={styles.expandableSection}>
            <TouchableOpacity 
              style={styles.expandableHeader}
              onPress={() => toggleSection('csi')}
              activeOpacity={0.7}
            >
              <Text style={styles.expandableTitle}>Biểu đồ CSI</Text>
              <MaterialIcons 
                name={expandedSections.csi ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} 
                size={24} 
                color="#9CA3AF" 
              />
            </TouchableOpacity>
            {expandedSections.csi && (
              <View style={styles.expandableContent}>
                <CSIChart />
              </View>
            )}
          </View>

          {/* Notes Section */}
          <View style={styles.expandableSection}>
            <TouchableOpacity 
              style={styles.expandableHeader}
              onPress={() => toggleSection('notes')}
              activeOpacity={0.7}
            >
              <View style={styles.expandableTitleRow}>
                <Text style={styles.expandableTitle}>Ghi chú</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>0</Text>
                </View>
              </View>
              <MaterialIcons 
                name={expandedSections.notes ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} 
                size={24} 
                color="#9CA3AF" 
              />
            </TouchableOpacity>
            {expandedSections.notes && (
              <View style={styles.expandableContent}>
                <View style={styles.emptyState}>
                  <MaterialIcons name="note" size={40} color="#D1D5DB" />
                  <Text style={styles.emptyStateText}>Chưa có ghi chú</Text>
                </View>
              </View>
            )}
          </View>

          {/* Media Section */}
          <View style={styles.expandableSection}>
            <TouchableOpacity 
              style={styles.expandableHeader}
              onPress={() => toggleSection('media')}
              activeOpacity={0.7}
            >
              <View style={styles.expandableTitleRow}>
                <Text style={styles.expandableTitle}>Ảnh/Video</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{mediaFiles.length}</Text>
                </View>
              </View>
              <MaterialIcons 
                name={expandedSections.media ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} 
                size={24} 
                color="#9CA3AF" 
              />
            </TouchableOpacity>
            {expandedSections.media && (
              <View style={styles.expandableContent}>
                {mediaFiles.length > 0 ? (
                  <View style={styles.mediaGrid}>
                    {mediaFiles.map((file) => (
                      <TouchableOpacity 
                        key={file.id} 
                        style={styles.mediaItem}
                        activeOpacity={0.8}
                        onPress={() => {
                          if (file.type === 'image') {
                            openImageViewer(file.id);
                          } else if (file.type === 'video') {
                            Linking.openURL(file.url);
                          }
                        }}
                      >
                        <Image
                          source={{ uri: file.url }}
                          style={styles.mediaThumbnail}
                          resizeMode="cover"
                        />
                        {file.type === 'video' && (
                          <View style={styles.videoOverlay}>
                            <MaterialIcons name="play-circle-filled" size={32} color="#FFFFFF" />
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyState}>
                    <MaterialIcons name="photo-library" size={40} color="#D1D5DB" />
                    <Text style={styles.emptyStateText}>Chưa có ảnh/video</Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Voice Section */}
          <View style={styles.expandableSection}>
            <TouchableOpacity 
              style={styles.expandableHeader}
              onPress={() => toggleSection('voice')}
              activeOpacity={0.7}
            >
              <View style={styles.expandableTitleRow}>
                <Text style={styles.expandableTitle}>Voice/Audio</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{voiceFiles.length}</Text>
                </View>
              </View>
              <MaterialIcons 
                name={expandedSections.voice ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} 
                size={24} 
                color="#9CA3AF" 
              />
            </TouchableOpacity>
            {expandedSections.voice && (
              <View style={styles.expandableContent}>
                {voiceFiles.length > 0 ? (
                  <View>
                    {voiceFiles.map((file) => (
                      <View key={file.id} style={styles.voiceItem}>
                        <View style={styles.voiceContent}>
                          <Text style={styles.voiceLabel}>[VOICE]</Text>
                          <Text style={styles.voiceDate}>
                            {new Date(file.sentAt).toLocaleDateString('vi-VN', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            })}
                          </Text>
                        </View>
                        <TouchableOpacity style={styles.playButton}>
                          <MaterialIcons name="play-arrow" size={20} color="#3B82F6" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyState}>
                    <MaterialIcons name="mic" size={40} color="#D1D5DB" />
                    <Text style={styles.emptyStateText}>Chưa có voice/audio</Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Files Section */}
          <View style={styles.expandableSection}>
            <TouchableOpacity 
              style={styles.expandableHeader}
              onPress={() => toggleSection('files')}
              activeOpacity={0.7}
            >
              <View style={styles.expandableTitleRow}>
                <Text style={styles.expandableTitle}>Liên kết/File</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{documentFiles.length}</Text>
                </View>
              </View>
              <MaterialIcons 
                name={expandedSections.files ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} 
                size={24} 
                color="#9CA3AF" 
              />
            </TouchableOpacity>
            {expandedSections.files && (
              <View style={styles.expandableContent}>
                {documentFiles.length > 0 ? (
                  <View>
                    {documentFiles.map((file) => (
                      <TouchableOpacity key={file.id} style={styles.fileItem}>
                        <View style={styles.fileIcon}>
                          <MaterialIcons name="insert-drive-file" size={24} color="#6B7280" />
                        </View>
                        <View style={styles.fileInfo}>
                          <Text style={styles.fileName} numberOfLines={1}>
                            {file.name || 'Document'}
                          </Text>
                          <Text style={styles.fileDate}>
                            {new Date(file.sentAt).toLocaleDateString('vi-VN')}
                          </Text>
                        </View>
                        <MaterialIcons name="download" size={24} color="#6B7280" />
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyState}>
                    <MaterialIcons name="insert-drive-file" size={40} color="#D1D5DB" />
                    <Text style={styles.emptyStateText}>Chưa có file</Text>
                  </View>
                )}
              </View>
            )}
          </View>
          {/* Spacer để tránh bị che ở đáy và giúp kéo tới hết */}
          <View style={{ height: 12 + insets.bottom }} />
        </ScrollView>
      </View>

      {/* Fullscreen Image Viewer (absolute overlay to avoid being covered) */}
      {viewerVisible && (
        <View style={[styles.viewerOverlayAbs, { paddingBottom: 24 + insets.bottom }]}>
          {/* Close button */}
          <TouchableOpacity style={styles.viewerClose} onPress={() => setViewerVisible(false)}>
            <MaterialIcons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Images pager */}
          <FlatList
            ref={viewerListRef as any}
            data={imageItems}
            horizontal
            pagingEnabled
            keyExtractor={(item) => item.id}
            initialScrollIndex={Math.min(Math.max(viewerIndex, 0), Math.max(0, imageItems.length - 1))}
            getItemLayout={(_, index) => ({ length: screenW, offset: screenW * index, index })}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / screenW);
              if (!Number.isNaN(idx)) setViewerIndex(idx);
            }}
            renderItem={({ item }) => (
              <View style={{ width: screenW, height: screenH, justifyContent: 'center', alignItems: 'center' }}>
                <Image source={{ uri: item.url }} style={styles.viewerImage} resizeMode="contain" />
              </View>
            )}
            showsHorizontalScrollIndicator={false}
          />

          {/* Thumbnails bar */}
          <ScrollView 
            horizontal 
            style={[styles.viewerThumbBar, { bottom: 28 + insets.bottom }]} 
            contentContainerStyle={styles.viewerThumbContent}
            showsHorizontalScrollIndicator={false}
          >
            {imageItems.map((it, idx) => (
              <TouchableOpacity
                key={it.id}
                onPress={() => {
                  setViewerIndex(idx);
                  try { viewerListRef.current?.scrollToIndex({ index: idx, animated: true }); } catch {}
                }}
              >
                <Image 
                  source={{ uri: it.url }} 
                  style={[styles.viewerThumb, idx === viewerIndex && styles.viewerThumbActive]} 
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Edit Customer Modal */}
      <EditCustomerModal
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        customer={customerData}
        onSave={(updatedCustomer) => {
          setCustomerData(updatedCustomer);
          setEditModalVisible(false);
        }}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1F2937',
  },
  editButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 220,
  },
  customerInfo: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 12,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#6B7280',
  },
  customerName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  platformBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
    marginBottom: 8,
  },
  platformText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  statusText: {
    fontSize: 13,
    color: '#6B7280',
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginTop: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  updateButtonText: {
    fontSize: 13,
    color: '#0084FF',
    fontWeight: '500',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    color: '#1F2937',
  },
  infoValueEmpty: {
    fontSize: 15,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  expandableSection: {
    backgroundColor: '#FFFFFF',
    marginTop: 12,
  },
  expandableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  expandableTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  expandableTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  countBadge: {
    backgroundColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  countText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  expandableContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  csiPlaceholder: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 12,
  },
  // Fullscreen viewer
  viewerOverlayAbs: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
    paddingBottom: 24,
  },
  viewerImage: {
    width: '90%',
    height: '80%',
  },
  viewerClose: {
    position: 'absolute',
    top: 40,
    right: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerThumbBar: {
    position: 'absolute',
    bottom: 28,
    left: 0,
    right: 0,
  },
  viewerThumbContent: {
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 8,
  },
  viewerThumb: {
    width: 54,
    height: 54,
    borderRadius: 8,
    marginHorizontal: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  viewerThumbActive: {
    borderColor: '#3B82F6',
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  placeholderText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 12,
  },
  // Media styles
  mediaItem: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
  },
  mediaThumbnail: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  // Voice styles
  voiceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    marginBottom: 8,
  },
  voiceContent: {
    flex: 1,
  },
  voiceLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  voiceDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  // File styles
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginBottom: 8,
    gap: 12,
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 2,
  },
  fileDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});

export default CustomerProfileModal;
