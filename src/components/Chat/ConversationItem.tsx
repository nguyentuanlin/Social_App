import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { FontAwesome, FontAwesome5, MaterialIcons, Ionicons } from '@expo/vector-icons';

interface ConversationItemProps {
  conversation: any;
  isActive?: boolean;
  onPress: () => void;
}

const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  isActive = false,
  onPress,
}) => {
  // Get customer name
  const customerName = conversation.customer?.fullName || 
                      conversation.customer?.name || 
                      conversation.title || 
                      'Khách hàng';
  
  // Get platform
  const platform = conversation.channel?.socialNetwork?.name || 
                  conversation.channel?.socialNetwork?.platform ||
                  conversation.channel?.social?.name ||
                  conversation.channel?.social?.platform ||
                  conversation.channel?.platform ||
                  'unknown';
  
  // Get last message time
  let lastTime: Date | null = null;
  
  if (conversation.lastActivityAt) {
    const parsed = new Date(conversation.lastActivityAt);
    if (!isNaN(parsed.getTime())) {
      lastTime = parsed;
    }
  }
  
  if (!lastTime && conversation.lastMessageAt) {
    const parsed = new Date(conversation.lastMessageAt);
    if (!isNaN(parsed.getTime())) {
      lastTime = parsed;
    }
  }
  
  if (!lastTime && conversation.updatedAt) {
    const parsed = new Date(conversation.updatedAt);
    if (!isNaN(parsed.getTime())) {
      lastTime = parsed;
    }
  }
  
  if (!lastTime) {
    lastTime = new Date();
  }

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

  const getPlatformColor = (platform?: string) => {
    switch (platform?.toLowerCase()) {
      case 'facebook':
        return '#1877F2';
      case 'instagram':
        return '#E4405F';
      case 'telegram':
        return '#0088CC';
      case 'gmail':
      case 'email':
        return '#EA4335';
      case 'zalo':
        return '#0068FF';
      case 'whatsapp':
        return '#25D366';
      case 'viber':
        return '#7360F2';
      case 'messenger':
        return '#00B2FF';
      default:
        return '#6B7280';
    }
  };

  const renderPlatformIcon = (platform?: string) => {
    const iconSize = 12;
    const iconColor = '#FFFFFF';
    
    switch (platform?.toLowerCase()) {
      case 'facebook':
        return <FontAwesome name="facebook" size={iconSize} color={iconColor} />;
      case 'instagram':
        return <FontAwesome name="instagram" size={iconSize} color={iconColor} />;
      case 'telegram':
        return <FontAwesome name="telegram" size={iconSize} color={iconColor} />;
      case 'gmail':
      case 'email':
        return <MaterialIcons name="email" size={iconSize} color={iconColor} />;
      case 'zalo':
        // Use a generic chat icon for Zalo instead of an image asset
        return <FontAwesome5 name="comment-dots" size={iconSize} color={iconColor} />;
      case 'whatsapp':
        return <FontAwesome name="whatsapp" size={iconSize} color={iconColor} />;
      case 'viber':
        return <FontAwesome5 name="viber" size={iconSize} color={iconColor} />;
      case 'messenger':
        return <Ionicons name="chatbubble" size={iconSize} color={iconColor} />;
      default:
        return <MaterialIcons name="chat" size={iconSize} color={iconColor} />;
    }
  };

  return (
    <TouchableOpacity
      style={[styles.container, isActive && styles.containerActive]}
      onPress={onPress}
    >
      <View style={styles.avatarContainer}>
        {conversation.customer?.avatarUrl ? (
          <Image
            source={{ uri: conversation.customer.avatarUrl }}
            style={styles.avatar}
          />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>
              {customerName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View
          style={[
            styles.platformBadge,
            { backgroundColor: getPlatformColor(platform) },
          ]}
        >
          {renderPlatformIcon(platform)}
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.customerName} numberOfLines={1}>
            {customerName}
          </Text>
          <Text style={styles.timestamp}>
            {formatTime(lastTime)}
          </Text>
        </View>
        <View style={styles.footer}>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {conversation.title || 'Cuộc hội thoại mới'}
          </Text>
          {conversation.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadCount}>{conversation.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  containerActive: {
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#6B7280',
  },
  platformBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  customerName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  timestamp: {
    fontSize: 12,
    color: '#9CA3AF',
    marginLeft: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
    color: '#6B7280',
  },
  unreadBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadCount: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});

export default ConversationItem;
