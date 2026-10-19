import React, { useState, useEffect } from 'react';
import { StyleSheet, View, SafeAreaView, ScrollView, FlatList, TouchableOpacity,
  Text, TextInput, StatusBar } from 'react-native';
import { FAB } from 'react-native-paper';
import { collection, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../firebase';

const OPPORTUNITY_CATEGORIES = [
  { label: 'All', value: 'all' },
  { label: 'Cleanup', value: 'cleanup' },
  { label: 'Safety Training', value: 'safety' },
  { label: 'Neighborhood Watch', value: 'neighborhood' },
  { label: 'Education', value: 'education' },
  { label: 'Public Health', value: 'health' },
];

const CATEGORY_CONFIG = {
  cleanup: { border: '#2e7d32', bg: '#c8e6c9', text: '#1b5e20', icon: '🧹' },
  safety: { border: '#f9a825', bg: '#fff9c4', text: '#795548', icon: '🧠' },
  neighborhood: { border: '#000666', bg: '#e0e0ff', text: '#000767', icon: '👥' },
  education: { border: '#6a1b9a', bg: '#e1bee7', text: '#4a0072', icon: '📚' },
  health: { border: '#ba1a1a', bg: '#ffdad6', text: '#93000a', icon: '❤️' },
};
const DEFAULT_CONFIG = { border: '#c6c5d4', bg: '#f5f5f5', text: '#454652', icon: '📌' };

const formatDate = (iso) => iso
  ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  : '';

const VolunteerDashboard = ({ navigation }) => {
  const [opportunities, setOpportunities] = useState([]);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => onAuthStateChanged(auth, setCurrentUser), []);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'opportunities'));
        setOpportunities(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error('Error fetching opportunities:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const q = search.toLowerCase();
  const filtered = opportunities.filter((opp) => {
    const matchesSearch = !search ||
      (opp.eventName || '').toLowerCase().includes(q) ||
      (opp.groupName || '').toLowerCase().includes(q) ||
      (opp.destination || '').toLowerCase().includes(q) ||
      (opp.description || '').toLowerCase().includes(q);
    return matchesSearch && (activeFilter === 'all' || opp.category === activeFilter);
  });

  const renderItem = ({ item }) => {
    const config = CATEGORY_CONFIG[item.category] || DEFAULT_CONFIG;
    const isOwn = currentUser && item.createdBy === currentUser.uid;
    return (
      <TouchableOpacity activeOpacity={0.8}
        onPress={() => navigation.navigate('Opportunity Detail', { opportunity: item })}>
        <View style={[styles.card, isOwn && styles.ownCard]}>
          <View style={[styles.iconBox, { backgroundColor: config.bg }]}>
            <Text style={{ fontSize: 24 }}>{config.icon}</Text>
          </View>
          <View style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <Text style={[styles.categoryBadge, { color: config.text }]}>{item.category || 'General'}</Text>
              {isOwn && (
                <View style={styles.ownBadge}><Text style={styles.ownBadgeText}>Your Event</Text></View>
              )}
            </View>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.eventName}</Text>
            <Text style={styles.cardSubtitle} numberOfLines={1}>📍 {item.destination || 'No location'}</Text>
            <Text style={styles.cardDate}>{formatDate(item.date)} · {item.groupName || 'No group'}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}><Text style={styles.headerTitle}>Volunteer Connect</Text></View>

      <View style={styles.searchContainer}>
        <TextInput style={styles.searchInput} placeholder="Find volunteer opportunities..."
          value={search} onChangeText={setSearch} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
        {OPPORTUNITY_CATEGORIES.map((chip) => (
          <TouchableOpacity key={chip.value} onPress={() => setActiveFilter(chip.value)}
            style={[styles.chip, activeFilter === chip.value && styles.chipActive]}>
            <Text style={activeFilter === chip.value ? styles.chipTextActive : styles.chipText}>
              {chip.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList data={filtered} keyExtractor={(item) => item.id} renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 80 }}
        ListEmptyComponent={!loading && (
          <Text style={styles.emptyText}>No opportunities found. Tap + to create one!</Text>
        )} />

      <FAB style={styles.fab} icon="plus" color="#fff" onPress={() => navigation.navigate('Create Opportunity')} />
    </SafeAreaView>
  );
};

export default VolunteerDashboard;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9' },
  header: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e2e2' },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#000666' },
  searchContainer: { padding: 16 },
  searchInput: { backgroundColor: '#eee', padding: 12, borderRadius: 20, fontSize: 16, color: '#1a1c1c' },
  chipRow: { flexGrow: 0, paddingHorizontal: 16, marginBottom: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#e2e2e2', marginRight: 8 },
  chipActive: { backgroundColor: '#000666' },
  chipText: { color: '#454652', fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: '500' },
  card: { flexDirection: 'row', marginHorizontal: 16, marginVertical: 8, backgroundColor: '#fff',
    borderRadius: 12, borderWidth: 1, borderColor: '#c6c5d4', overflow: 'hidden' },
  ownCard: { borderColor: '#000666', borderWidth: 2, backgroundColor: '#f8f9ff' },
  iconBox: { width: 80, justifyContent: 'center', alignItems: 'center' },
  cardContent: { flex: 1, padding: 12, justifyContent: 'center' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  categoryBadge: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  ownBadge: { marginLeft: 8, backgroundColor: '#000666', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  ownBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#1a1c1c', marginBottom: 2 },
  cardSubtitle: { fontSize: 13, color: '#454652', marginBottom: 2 },
  cardDate: { fontSize: 12, color: '#767683' },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#767683', fontSize: 15 },
  fab: { position: 'absolute', margin: 16, right: 0, bottom: 0, backgroundColor: '#000666' },
});
