import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface FilePreviewProps {
  file: {
    uri: string;
    name?: string;
    type?: string;
    size?: number;
  };
  onRemove: () => void;
}

const FilePreview: React.FC<FilePreviewProps> = ({ file, onRemove }) => {
  const isImage = file.type?.startsWith('image/');
  
  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const getFileIcon = (mimeType?: string): string => {
    if (!mimeType) return 'insert-drive-file';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'videocam';
    if (mimeType.startsWith('audio/')) return 'audiotrack';
    if (mimeType.includes('pdf')) return 'picture-as-pdf';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'description';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'grid-on';
    return 'insert-drive-file';
  };

  return (
    <View style={styles.container}>
      <View style={styles.previewCard}>
        {/* Remove button */}
        <TouchableOpacity style={styles.removeButton} onPress={onRemove}>
          <MaterialIcons name="close" size={18} color="#FFFFFF" />
        </TouchableOpacity>

        {/* File content */}
        {isImage ? (
          <Image source={{ uri: file.uri }} style={styles.imagePreview} resizeMode="cover" />
        ) : (
          <View style={styles.fileIconContainer}>
            <MaterialIcons 
              name={getFileIcon(file.type) as any} 
              size={40} 
              color="#0084FF" 
            />
          </View>
        )}

        {/* File info */}
        <View style={styles.fileInfo}>
          <Text style={styles.fileName} numberOfLines={2}>
            {file.name || 'Unnamed file'}
          </Text>
          {file.size && (
            <Text style={styles.fileSize}>
              {formatFileSize(file.size)}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 12,
    marginVertical: 8,
  },
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    position: 'relative',
    maxWidth: width * 0.7,
  },
  removeButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  imagePreview: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginBottom: 8,
  },
  fileIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 80,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    marginBottom: 8,
  },
  fileInfo: {
    alignItems: 'center',
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 4,
  },
  fileSize: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
});

export default FilePreview;
