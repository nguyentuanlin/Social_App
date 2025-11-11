import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface EditCustomerModalProps {
  visible: boolean;
  onClose: () => void;
  customer: any;
  onSave: (updatedCustomer: any) => void;
}

const EditCustomerModal: React.FC<EditCustomerModalProps> = ({
  visible,
  onClose,
  customer,
  onSave,
}) => {
  const [fullName, setFullName] = useState(customer?.fullName || customer?.name || '');
  const [phone, setPhone] = useState(customer?.phone || '');
  const [email, setEmail] = useState(customer?.email || '');
  const [address, setAddress] = useState(customer?.address || '');
  const [isSaving, setIsSaving] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const handleSave = async () => {
    // Validate
    if (!fullName.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập họ và tên');
      return;
    }

    try {
      setIsSaving(true);
      
      const updatedCustomer = {
        ...customer,
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
      };

      // Call API to update customer
      // await apiCustomer.update(customer.id, updatedCustomer);
      
      onSave(updatedCustomer);
      Alert.alert('Thành công', 'Đã cập nhật thông tin khách hàng');
      onClose();
    } catch (error) {
      console.error('Error updating customer:', error);
      Alert.alert('Lỗi', 'Không thể cập nhật thông tin');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
          {/* Header with Gradient */}
          <LinearGradient
            colors={['#3B82F6', '#8B5CF6']}
            style={styles.header}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Chỉnh sửa thông tin</Text>
            <TouchableOpacity 
              onPress={handleSave} 
              style={styles.saveButton}
              disabled={isSaving}
              activeOpacity={0.7}
            >
              <MaterialIcons 
                name="check" 
                size={24} 
                color={isSaving ? 'rgba(255,255,255,0.5)' : '#FFFFFF'} 
              />
            </TouchableOpacity>
          </LinearGradient>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Full Name */}
          <View style={styles.formGroup}>
            <View style={styles.labelRow}>
              <MaterialIcons name="person" size={18} color="#6B7280" />
              <Text style={styles.label}>
                Họ và tên <Text style={styles.required}>*</Text>
              </Text>
            </View>
            <View style={[
              styles.inputContainer,
              focusedField === 'fullName' && styles.inputContainerFocused
            ]}>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Nhập họ và tên"
                placeholderTextColor="#9CA3AF"
                onFocus={() => setFocusedField('fullName')}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          </View>

          {/* Phone */}
          <View style={styles.formGroup}>
            <View style={styles.labelRow}>
              <MaterialIcons name="phone" size={18} color="#6B7280" />
              <Text style={styles.label}>Số điện thoại</Text>
            </View>
            <View style={[
              styles.inputContainer,
              focusedField === 'phone' && styles.inputContainerFocused
            ]}>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="Nhập số điện thoại"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
                onFocus={() => setFocusedField('phone')}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          </View>

          {/* Email */}
          <View style={styles.formGroup}>
            <View style={styles.labelRow}>
              <MaterialIcons name="email" size={18} color="#6B7280" />
              <Text style={styles.label}>Email</Text>
            </View>
            <View style={[
              styles.inputContainer,
              focusedField === 'email' && styles.inputContainerFocused
            ]}>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Nhập email"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          </View>

          {/* Address */}
          <View style={styles.formGroup}>
            <View style={styles.labelRow}>
              <MaterialIcons name="location-on" size={18} color="#6B7280" />
              <Text style={styles.label}>Địa chỉ</Text>
            </View>
            <View style={[
              styles.inputContainer,
              styles.textAreaContainer,
              focusedField === 'address' && styles.inputContainerFocused
            ]}>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={address}
                onChangeText={setAddress}
                placeholder="Nhập địa chỉ"
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                onFocus={() => setFocusedField('address')}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          </View>

          <View style={styles.note}>
            <MaterialIcons name="info" size={16} color="#6B7280" />
            <Text style={styles.noteText}>
              Thông tin sẽ được cập nhật vào hệ thống CRM
            </Text>
          </View>
        </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  saveButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  formGroup: {
    marginBottom: 24,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  required: {
    color: '#EF4444',
  },
  inputContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  inputContainerFocused: {
    borderColor: '#3B82F6',
    shadowColor: '#3B82F6',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#1F2937',
  },
  textAreaContainer: {
    minHeight: 100,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
});

export default EditCustomerModal;
