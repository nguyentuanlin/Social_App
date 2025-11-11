import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

interface CustomAlertProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'danger' | 'warning' | 'info';
}

const CustomAlert: React.FC<CustomAlertProps> = ({
  visible,
  title,
  message,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy',
  onConfirm,
  onCancel,
  type = 'danger',
}) => {
  const getIconConfig = () => {
    switch (type) {
      case 'danger':
        return {
          name: 'logout' as const,
          colors: ['#EF4444', '#DC2626'] as const,
          bgColor: '#FEE2E2',
        };
      case 'warning':
        return {
          name: 'warning' as const,
          colors: ['#F59E0B', '#D97706'] as const,
          bgColor: '#FEF3C7',
        };
      case 'info':
        return {
          name: 'info' as const,
          colors: ['#3B82F6', '#2563EB'] as const,
          bgColor: '#DBEAFE',
        };
    }
  };

  const iconConfig = getIconConfig();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <TouchableOpacity 
          style={styles.overlayTouchable}
          activeOpacity={1}
          onPress={onCancel}
        />
        
        <View style={styles.alertContainer}>
          {/* Icon */}
          <View style={[styles.iconContainer, { backgroundColor: iconConfig.bgColor }]}>
            <LinearGradient
              colors={iconConfig.colors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconGradient}
            >
              <MaterialIcons name={iconConfig.name} size={32} color="#FFFFFF" />
            </LinearGradient>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>
          </View>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelButtonText}>{cancelText}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.confirmButton]}
              onPress={onConfirm}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={iconConfig.colors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.confirmButtonGradient}
              >
                <Text style={styles.confirmButtonText}>{confirmText}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  overlayTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  alertContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 10,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  iconGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  confirmButton: {
    overflow: 'hidden',
  },
  confirmButtonGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});

export default CustomAlert;
