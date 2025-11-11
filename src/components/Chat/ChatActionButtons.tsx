import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Modal, Text, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface ChatActionButtonsProps {
  onPinConversation?: () => void;
  onViewHistory?: () => void;
  onComposeEmail?: () => void;
  onArchive?: () => void;
  onViewInfo?: () => void;
  onTranslate?: () => void;
  isTranslating?: boolean;
}

const ChatActionButtons: React.FC<ChatActionButtonsProps> = ({
  onPinConversation,
  onViewHistory,
  onComposeEmail,
  onArchive,
  onViewInfo,
  onTranslate,
  isTranslating = false,
}) => {
  const [menuVisible, setMenuVisible] = useState(false);

  const actions = [
    {
      icon: 'push-pin',
      label: 'Ghim',
      onPress: onPinConversation,
      color: '#64748b',
    },
    {
      icon: 'history',
      label: 'Lịch sử',
      onPress: onViewHistory,
      color: '#64748b',
    },
    {
      icon: 'email',
      label: 'Email',
      onPress: onComposeEmail,
      color: '#64748b',
    },
    {
      icon: 'archive',
      label: 'Lưu trữ',
      onPress: onArchive,
      color: '#64748b',
    },
    {
      icon: 'info',
      label: 'Thông tin',
      onPress: onViewInfo,
      color: '#64748b',
    },
    {
      icon: 'translate',
      label: isTranslating ? 'Đang dịch...' : 'Dịch',
      onPress: onTranslate,
      color: isTranslating ? '#0084FF' : '#64748b',
    },
  ];

  return (
    <>
      {/* Action Buttons Row */}
      <View style={styles.container}>
        {actions.slice(0, 5).map((action, index) => (
          <TouchableOpacity
            key={index}
            style={styles.actionButton}
            onPress={action.onPress}
            activeOpacity={0.7}
          >
            <MaterialIcons 
              name={action.icon as any} 
              size={20} 
              color={action.color} 
            />
          </TouchableOpacity>
        ))}
        
        {/* Menu Button */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setMenuVisible(true)}
          activeOpacity={0.7}
        >
          <MaterialIcons name="more-horiz" size={20} color="#64748b" />
        </TouchableOpacity>
      </View>

      {/* Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        >
          <View style={styles.menuContainer}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>Thao tác</Text>
              <TouchableOpacity onPress={() => setMenuVisible(false)}>
                <MaterialIcons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.menuContent}>
              {actions.map((action, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.menuItem}
                  onPress={() => {
                    action.onPress?.();
                    setMenuVisible(false);
                  }}
                >
                  <MaterialIcons 
                    name={action.icon as any} 
                    size={22} 
                    color={action.color} 
                  />
                  <Text style={styles.menuItemText}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 4,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  menuContent: {
    padding: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 4,
    gap: 12,
  },
  menuItemText: {
    fontSize: 16,
    color: '#1F2937',
  },
});

export default ChatActionButtons;
