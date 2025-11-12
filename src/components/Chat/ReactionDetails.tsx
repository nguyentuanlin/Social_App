import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableWithoutFeedback,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ReactionSummary } from '../../services/apiReactions';

interface ReactionDetailsProps {
  visible: boolean;
  onClose: () => void;
  reactions: ReactionSummary[];
  messageId: string;
  onAddReaction?: (messageId: string, emoji: string) => Promise<void>;
  onRemoveReaction?: (messageId: string, emoji: string) => Promise<void>;
}

const COMMON_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡'];

const ReactionDetails: React.FC<ReactionDetailsProps> = ({
  visible,
  onClose,
  reactions = [],
  messageId,
  onAddReaction,
  onRemoveReaction,
}) => {
  // Grouped by emoji for display
  const reactionsByEmoji = reactions.reduce((acc, r) => {
    if (!acc[r.emoji]) {
      acc[r.emoji] = { ...r };
    }
    return acc;
  }, {} as Record<string, ReactionSummary>);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalBackdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              <View style={styles.header}>
                <Text style={styles.title}>Tất cả cảm xúc</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <MaterialIcons name="close" size={24} color="#1F2937" />
                </TouchableOpacity>
              </View>

              {/* Common emojis */}
              <View style={styles.commonEmojis}>
                {COMMON_EMOJIS.map((emoji) => {
                  const isSelected = !!reactionsByEmoji[emoji];
                  return (
                    <TouchableOpacity
                      key={emoji}
                      style={[
                        styles.emojiButton,
                        isSelected && styles.selectedEmojiButton
                      ]}
                      onPress={async () => {
                        if (isSelected && onRemoveReaction) {
                          await onRemoveReaction(messageId, emoji);
                        } else if (onAddReaction) {
                          await onAddReaction(messageId, emoji);
                        }
                      }}
                    >
                      <Text style={styles.emoji}>{emoji}</Text>
                      {isSelected && (
                        <View style={styles.selectedIndicator} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.divider} />

              {/* Reactions list */}
              <ScrollView style={styles.reactionsList}>
                {reactions.length > 0 ? (
                  reactions.map((reaction, index) => (
                    <View key={index} style={styles.reactionItem}>
                      <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                      <View style={styles.reactionDetails}>
                        <Text style={styles.reactionCount}>
                          {reaction.count} {reaction.count > 1 ? 'người' : 'người'}
                        </Text>
                        <Text style={styles.reactionUsers}>
                          {reaction.users.map(u => u.userName || 'Người dùng').join(', ')}
                        </Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>Chưa có cảm xúc nào</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    minHeight: 300,
    maxHeight: '70%',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  closeButton: {
    padding: 4,
  },
  commonEmojis: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  emojiButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  selectedEmojiButton: {
    backgroundColor: '#EBF5FF',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  emoji: {
    fontSize: 22,
  },
  selectedIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#3B82F6',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
  },
  reactionsList: {
    flex: 1,
  },
  reactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  reactionEmoji: {
    fontSize: 24,
    marginRight: 16,
  },
  reactionDetails: {
    flex: 1,
  },
  reactionCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  reactionUsers: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  emptyContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
  },
});

export default ReactionDetails;
