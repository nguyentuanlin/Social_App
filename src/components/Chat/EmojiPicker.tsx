import React, { useMemo, useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface EmojiPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect?: (emoji: string) => void;
  multi?: boolean;
  onApply?: (emojis: string[]) => void;
}

const CATEGORIES: { key: string; label: string; emojis: string[] }[] = [
  {
    key: 'smileys',
    label: 'Mặt cười',
    emojis: '😀 😃 😄 😁 😆 😅 😂 🙂 🙃 😉 😊 😇 🙂‍↕️ 🥲 😍 😘 😗 😙 😚 😜 🤪 🤨 🤓 😎 🤩 🥳 😏 😒 😞 😔 😟 😢 😭 😤 😠 😡 🤬 🤯 😱 😨 😰 😥 😓 🤗 🤔 🤫 🤭 🤥 😶 😐 😑 😬 🙄 🥹'.split(/\s+/)
  },
  {
    key: 'hands',
    label: 'Cử chỉ',
    emojis: '👍 👎 👋 🤚 ✋ 🖐 🖖 👌 ✌ 🤞 🤟 🤘 🤙 👏 🙌 👐 🤲 🙏 👉 👈 👆 👇 👊 🤛 🤜 ✊ 🫶'.split(/\s+/)
  },
  {
    key: 'hearts',
    label: 'Cảm xúc',
    emojis: '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💖 💗 💓 💞 💕 💘 💝 💟 💔 ❣️ 💌 💢'.split(/\s+/)
  },
  {
    key: 'animals',
    label: 'Động vật',
    emojis: '🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐵 🐔 🐧 🐦 🐤 🐣 🐥 🐺 🐗 🐴 🦄 🐝 🐛 🦋'.split(/\s+/)
  },
  {
    key: 'foods',
    label: 'Đồ ăn',
    emojis: '🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍒 🍑 🍍 🥭 🍅 🍆 🥑 🥦 🥕 🌽 🥔 🧄 🧅 🍞 🥐 🥖 🧀 🍔 🍟 🍕 🌭 🌮 🌯 🥙 🍣 🍜 🍲 🍱'.split(/\s+/)
  },
  {
    key: 'objects',
    label: 'Đồ vật',
    emojis: '⌚️ 📱 💻 ⌨️ 🖱️ 🖨️ 🖥️ 🕹️ 💾 💿 📷 🎥 📺 📻 🎧 🎤 🎹 🥁 🎸 🎻 📚 📝 ✏️ ✒️ 📌 📎 ✂️ 🧷 🧻 🧼 🔑 🔒 🔓 🔨 🔧'.split(/\s+/)
  },
];

const EmojiPicker: React.FC<EmojiPickerProps> = ({ visible, onClose, onSelect, multi = true, onApply }) => {
  const [category, setCategory] = useState<string>('smileys');
  const [query, setQuery] = useState('');
  const insets = useSafeAreaInsets();
  const [recent, setRecent] = useState<string[]>([]);
  const RECENT_KEY = 'emoji:recent';
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    let m = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(RECENT_KEY);
        if (!m) return;
        if (raw) {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) setRecent(arr.filter((x: any) => typeof x === 'string').slice(0, 24));
        }
      } catch {}
    })();
    return () => { m = false; };
  }, [visible]);

  useEffect(() => {
    if (visible) setSelected([]);
  }, [visible]);

  const pushRecent = async (em: string) => {
    try {
      const next = [em, ...recent.filter(e => e !== em)].slice(0, 24);
      setRecent(next);
      await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {}
  };

  const toggleSelect = (em: string) => {
    setSelected(prev => (prev.includes(em) ? prev.filter(x => x !== em) : [...prev, em]));
  };

  const allEmojis = useMemo(() => CATEGORIES.flatMap(c => c.emojis), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CATEGORIES.find(c => c.key === category)?.emojis || [];
    if (['cuoi', 'cười', 'smile', 'mat cuoi'].some(k => q.includes(k))) return CATEGORIES.find(c => c.key === 'smileys')!.emojis;
    if (['tim', 'love', 'heart'].some(k => q.includes(k))) return CATEGORIES.find(c => c.key === 'hearts')!.emojis;
    if (['tay', 'hand'].some(k => q.includes(k))) return CATEGORIES.find(c => c.key === 'hands')!.emojis;
    if (['dong vat', 'animal', 'meo', 'cho'].some(k => q.includes(k))) return CATEGORIES.find(c => c.key === 'animals')!.emojis;
    if (['do an', 'food', 'an', 'pizza', 'banh'].some(k => q.includes(k))) return CATEGORIES.find(c => c.key === 'foods')!.emojis;
    if (['do vat', 'object', 'key', 'lock', 'book'].some(k => q.includes(k))) return CATEGORIES.find(c => c.key === 'objects')!.emojis;
    return allEmojis;
  }, [category, query]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[
          styles.panel,
          { paddingBottom: 10 + insets.bottom, marginBottom: Math.max(16, insets.bottom) }
        ]}>
          <View style={styles.headerRow}>
            <TextInput
              placeholder="Tìm kiếm biểu tượng cảm xúc"
              placeholderTextColor="#9CA3AF"
              style={styles.search}
              value={query}
              onChangeText={setQuery}
              autoFocus={false}
            />
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <MaterialIcons name="close" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Grid emoji */}

          {recent.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Gần đây</Text>
              <View style={styles.grid}>
                {recent.map((em, idx) => (
                  <TouchableOpacity key={`r-${em}-${idx}`} style={[styles.emojiBtn, selected.includes(em) && styles.emojiBtnActive]} onPress={() => { multi ? toggleSelect(em) : (onSelect?.(em), pushRecent(em), onClose()); }}>
                    <Text style={styles.emoji}>{em}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <ScrollView style={{ maxHeight: 320 }}>
            <View style={styles.grid}>
              {filtered.map((em, idx) => (
                <TouchableOpacity key={`${em}-${idx}`} style={[styles.emojiBtn, selected.includes(em) && styles.emojiBtnActive]} onPress={() => { multi ? toggleSelect(em) : (onSelect?.(em), pushRecent(em), onClose()); }}>
                  <Text style={styles.emoji}>{em}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {multi && (
            <View style={styles.selectedBar}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                <View style={styles.selectedRow}>
                  {selected.map((em, idx) => (
                    <TouchableOpacity key={`s-${em}-${idx}`} style={styles.selectedChip} onPress={() => toggleSelect(em)}>
                      <Text style={styles.selectedEmoji}>{em}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <View style={styles.selectedActions}>
                <TouchableOpacity disabled={selected.length === 0} style={[styles.applyBtn, selected.length === 0 && styles.btnDisabled]} onPress={() => { if (selected.length > 0) { onApply?.(selected); selected.forEach(pushRecent); onClose(); } }}>
                  <Text style={styles.applyText}>Chèn</Text>
                </TouchableOpacity>
                <TouchableOpacity disabled={selected.length === 0} style={[styles.clearBtn, selected.length === 0 && styles.btnDisabled]} onPress={() => setSelected([])}>
                  <Text style={styles.clearText}>Xóa</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Category icon bar (bottom) */}
          <View style={styles.catBar}>
            <TouchableOpacity onPress={() => { setCategory('smileys'); setQuery(''); }} style={[styles.catBtn, category === 'smileys' && styles.catBtnActive]}>
              <MaterialIcons name="emoji-emotions" size={18} color={category === 'smileys' ? '#FFFFFF' : '#9CA3AF'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setCategory('hands'); setQuery(''); }} style={[styles.catBtn, category === 'hands' && styles.catBtnActive]}>
              <Text style={{ color: category === 'hands' ? '#FFFFFF' : '#9CA3AF', fontSize: 16 }}>✋</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setCategory('hearts'); setQuery(''); }} style={[styles.catBtn, category === 'hearts' && styles.catBtnActive]}>
              <MaterialIcons name="favorite" size={18} color={category === 'hearts' ? '#FFFFFF' : '#9CA3AF'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setCategory('animals'); setQuery(''); }} style={[styles.catBtn, category === 'animals' && styles.catBtnActive]}>
              <MaterialIcons name="pets" size={18} color={category === 'animals' ? '#FFFFFF' : '#9CA3AF'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setCategory('foods'); setQuery(''); }} style={[styles.catBtn, category === 'foods' && styles.catBtnActive]}>
              <MaterialIcons name="restaurant" size={18} color={category === 'foods' ? '#FFFFFF' : '#9CA3AF'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setCategory('objects'); setQuery(''); }} style={[styles.catBtn, category === 'objects' && styles.catBtnActive]}>
              <MaterialIcons name="category" size={18} color={category === 'objects' ? '#FFFFFF' : '#9CA3AF'} />
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
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  backdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
  },
  panel: {
    backgroundColor: '#111827',
    padding: 12,
    paddingTop: 10,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    width: '96%',
    maxWidth: 560,
    borderWidth: 1,
    borderColor: '#1F2937',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  search: {
    flex: 1,
    backgroundColor: '#1F2937',
    color: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: '#374151',
  },
  tabs: {
    marginBottom: 8,
  },
  sectionTitle: {
    color: '#D1D5DB',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 2,
  },
  tab: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#1F2937',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  tabActive: {
    backgroundColor: '#2563EB',
    borderColor: '#1D4ED8',
  },
  tabText: {
    color: '#D1D5DB',
    fontSize: 12,
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  emojiBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    margin: 4,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  emojiBtnActive: {
    borderColor: '#2563EB',
    backgroundColor: '#0B1220',
  },
  emoji: {
    fontSize: 26,
  },
  catBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
    paddingTop: 8,
    marginTop: 8,
  },
  catBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: '#374151',
    marginHorizontal: 4,
  },
  catBtnActive: {
    backgroundColor: '#2563EB',
    borderColor: '#1D4ED8',
  },
  selectedBar: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
    paddingTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  selectedChip: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1F2937',
    marginRight: 6,
  },
  selectedEmoji: {
    fontSize: 20,
  },
  selectedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  applyBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  applyText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
  clearBtn: {
    backgroundColor: '#1F2937',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  clearText: {
    color: '#E5E7EB',
    fontWeight: '600',
    fontSize: 12,
  },
  btnDisabled: {
    opacity: 0.5,
  },
});

export default EmojiPicker;
