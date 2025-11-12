import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ReactionSummary } from '../../services/apiReactions';

interface ReactionBadgeProps {
  reactions: ReactionSummary[];
  onPress?: () => void;
  isFromCustomer?: boolean;
}

const ReactionBadge: React.FC<ReactionBadgeProps> = ({
  reactions,
  onPress,
  isFromCustomer = true
}) => {
  if (!reactions || reactions.length === 0) {
    return null;
  }

  // Sắp xếp emoji theo số lượng và lấy 2 emoji đầu tiên
  const sortedReactions = [...reactions].sort((a, b) => b.count - a.count);
  const displayEmojis = sortedReactions.slice(0, 2).map(r => r.emoji);
  
  // Tổng số reaction
  const totalCount = reactions.reduce((acc, r) => acc + r.count, 0);

  return (
    <TouchableOpacity
      style={[
        styles.container,
        isFromCustomer ? styles.customerContainer : styles.agentContainer
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.emojisContainer}>
        {displayEmojis.map((emoji, idx) => (
          <View
            key={`${emoji}-${idx}`}
            style={[
              styles.emojiCircle,
              idx > 0 && styles.overlappingEmoji
            ]}
          >
            <Text style={styles.emoji}>{emoji}</Text>
          </View>
        ))}
      </View>
      
      <Text style={styles.count}>{totalCount}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: -10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  customerContainer: {
    left: 8,
  },
  agentContainer: {
    right: 8,
  },
  emojisContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 4,
  },
  emojiCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,138,149,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,138,149,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlappingEmoji: {
    marginLeft: -6,
  },
  emoji: {
    fontSize: 12,
  },
  count: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#475569',
  },
});

export default ReactionBadge;
