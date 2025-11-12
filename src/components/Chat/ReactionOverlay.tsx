import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';

interface ReactionOverlayProps {
  visible: boolean;
  onSelectEmoji: (emoji: string) => void;
  onClose: () => void;
  scale: Animated.Value;
}

const REACTIONS = [
  { emoji: '👍', label: 'Thích' },
  { emoji: '❤️', label: 'Yêu thích' },
  { emoji: '😂', label: 'Haha' },
  { emoji: '😮', label: 'Wow' },
  { emoji: '😢', label: 'Buồn' },
  { emoji: '😡', label: 'Tức giận' },
];

const ReactionOverlay: React.FC<ReactionOverlayProps> = ({
  visible,
  onSelectEmoji,
  onClose,
  scale,
}) => {
  if (!visible) return null;

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          transform: [{ scale }],
        }
      ]}
    >
      {REACTIONS.map((reaction, index) => (
        <TouchableOpacity
          key={index}
          style={styles.emojiButton}
          onPress={() => onSelectEmoji(reaction.emoji)}
          activeOpacity={0.7}
        >
          <Text style={styles.emojiText}>{reaction.emoji}</Text>
        </TouchableOpacity>
      ))}
      
      <TouchableOpacity 
        style={styles.addButton}
        onPress={onClose}
        activeOpacity={0.7}
      >
        <Text style={styles.addText}>+</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: 'rgba(17,24,39,0.95)',
    borderRadius: 30,
    padding: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  emojiButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  emojiText: {
    fontSize: 24,
  },
  addButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  addText: {
    fontSize: 18,
    color: 'white',
    fontWeight: 'bold',
  },
});

export default ReactionOverlay;
