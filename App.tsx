import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, Alert, Modal, ActivityIndicator } from 'react-native';

const DEFAULT_API_URL = 'https://breci-gestionale.vercel.app/api/driver';

// Helper functions for date/time calculations
const getMonday = (d: Date): Date => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  const monday = new Date(date.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
};

const getWeekDays = (monday: Date): Date[] => {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    days.push(day);
  }
  return days;
};

const formatDateString = (d: Date): string => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const formatTime = (isoString: string): string => {
  try {
    if (!isoString) return '';
    const parts = isoString.split('T');
    if (parts.length < 2) return '';
    const timeParts = parts[1].split(':');
    if (timeParts.length < 2) return '';
    return `${timeParts[0]}:${timeParts[1]}`;
  } catch (e) {
    return '';
  }
};

const getMonthYearLabel = (monday: Date): string => {
  const months = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
  ];
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  
  if (monday.getMonth() === sunday.getMonth()) {
    return `${months[monday.getMonth()]} ${monday.getFullYear()}`;
  } else {
    if (monday.getFullYear() === sunday.getFullYear()) {
      return `${months[monday.getMonth()]} / ${months[sunday.getMonth()]} ${monday.getFullYear()}`;
    } else {
      return `${months[monday.getMonth()]} ${monday.getFullYear()} / ${months[sunday.getMonth()]} ${sunday.getFullYear()}`;
    }
  }
};

export default function App() {
  const [driver, setDriver] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  // Server configuration state
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [tempApiUrl, setTempApiUrl] = useState(DEFAULT_API_URL);

  const [schedules, setSchedules] = useState<any[]>([]);
  const [selectedSchedule, setSelectedSchedule] = useState<any>(null);
  const [loadedQuantity, setLoadedQuantity] = useState('');

  // Calendar states
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return formatDateString(new Date());
  });
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    return getMonday(new Date());
  });

  const handleLogin = async () => {
    if (!email) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setDriver(data.driver);
        fetchSchedules(data.driver.id);
      } else {
        Alert.alert('Errore', data.error || 'Login fallito');
      }
    } catch (e) {
      Alert.alert(
        'Errore di connessione',
        `Impossibile connettersi al server:\n${apiUrl}\n\nAssicurati che lo smartphone sia connesso a internet o controlla l'indirizzo nelle "Impostazioni Server".`
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedules = async (driverId: number) => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/schedules?driverId=${driverId}`);
      const data = await res.json();
      if (data.success) {
        setSchedules(data.schedules);
      } else {
        Alert.alert('Errore', data.error || 'Impossibile recuperare i turni');
      }
    } catch (e: any) {
      Alert.alert('Errore di connessione', e?.message || 'Impossibile recuperare i turni');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (status: string) => {
    if (!selectedSchedule) return;
    
    let parsedQty: number | null = null;
    if (status === 'ESEGUITO') {
      if (!loadedQuantity) {
        Alert.alert('Errore', 'Inserire la quantità caricata in tonnellate prima di completare il viaggio.');
        return;
      }
      parsedQty = parseFloat(loadedQuantity.replace(',', '.'));
      if (isNaN(parsedQty) || parsedQty <= 0) {
        Alert.alert('Errore', 'Inserire una quantità caricata valida (es. 24.5).');
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/schedules/${selectedSchedule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status, 
          loadedQuantity: status === 'ESEGUITO' ? parsedQty : null 
        })
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert('Successo', 'Turno aggiornato!');
        setSelectedSchedule(null);
        setLoadedQuantity('');
        fetchSchedules(driver.id);
      } else {
        Alert.alert('Errore aggiornamento', data.error || 'Impossibile aggiornare il turno.');
      }
    } catch (e: any) {
      Alert.alert('Errore di connessione', e?.message || 'Impossibile aggiornare il turno');
    } finally {
      setLoading(false);
    }
  };

  const handlePrevWeek = () => {
    const prev = new Date(currentWeekStart);
    prev.setDate(prev.getDate() - 7);
    setCurrentWeekStart(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(currentWeekStart);
    next.setDate(next.getDate() + 7);
    setCurrentWeekStart(next);
  };

  const renderSchedule = ({ item }: { item: any }) => {
    let statusColor = '#3b82f6';
    let statusBg = '#eff6ff';
    if (item.status === 'ESEGUITO') {
      statusColor = '#10b981';
      statusBg = '#ecfdf5';
    } else if (item.status === 'ANNULLATO') {
      statusColor = '#ef4444';
      statusBg = '#fef2f2';
    }

    const timeStart = formatTime(item.startDate);
    const timeEnd = formatTime(item.endDate);
    const timeRange = timeStart && timeEnd ? `${timeStart} - ${timeEnd}` : '';

    return (
      <TouchableOpacity 
        style={[styles.card, { borderLeftColor: statusColor, borderLeftWidth: 4 }]} 
        onPress={() => {
          if (item.status === 'PIANIFICATO') {
            setSelectedSchedule(item);
            setLoadedQuantity('');
          } else {
            const destStr = item.destination ? `\nCliente: ${item.destination.client?.name || '-'}\nCantiere: ${item.destination.name || '-'}\nIndirizzo: ${item.destination.address || '-'}` : '';
            const cerStr = item.wasteType ? `\nCER: ${item.wasteType.cerCode} ${item.wasteType.description ? '(' + item.wasteType.description + ')' : ''}` : '';
            Alert.alert(
              'Info Viaggio', 
              `Stato: ${item.status}\nMezzo: ${item.vehicle?.plateNumber || '-'}${destStr}${cerStr}\nQuantità: ${item.loadedQuantity ? item.loadedQuantity + ' t' : '-'}\n\nNote: ${item.notes || '-'}`
            );
          }
        }}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardTime}>{timeRange || 'Orario non definito'}</Text>
          <View style={[styles.statusBadgeContainer, { backgroundColor: statusBg }]}>
            <Text style={[styles.statusBadgeText, { color: statusColor }]}>{item.status}</Text>
          </View>
        </View>

        <Text style={styles.cardTextPlate}>Mezzo: <Text style={styles.boldText}>{item.vehicle?.plateNumber || '-'}</Text> {item.vehicle?.model ? `(${item.vehicle.model})` : ''}</Text>
        
        {item.destination ? (
          <>
            <Text style={styles.cardTextPlate}>Cliente: <Text style={styles.boldText}>{item.destination.client?.name || '-'}</Text></Text>
            <Text style={styles.cardTextPlate}>Cantiere: <Text style={styles.boldText}>{item.destination.name || '-'}</Text></Text>
            {item.destination.address ? (
              <Text style={styles.cardTextPlate}>Indirizzo: <Text style={styles.boldText}>{item.destination.address}</Text></Text>
            ) : null}
          </>
        ) : null}

        {item.wasteType ? (
          <Text style={styles.cardTextPlate}>Codice CER: <Text style={styles.boldText}>{item.wasteType.cerCode}</Text> {item.wasteType.description ? `(${item.wasteType.description})` : ''}</Text>
        ) : null}

        {item.notes ? (
          <Text style={styles.cardNote}>Note: {item.notes}</Text>
        ) : null}

        {item.status === 'ESEGUITO' && item.loadedQuantity !== null ? (
          <Text style={styles.cardLoadedQty}>Tonnellate Caricate: <Text style={styles.boldText}>{item.loadedQuantity} t</Text></Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  if (!driver) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Breci Trasporti</Text>
        <Text style={styles.subtitle}>Accesso Autisti</Text>
        <TextInput 
          style={styles.input} 
          placeholder="Email Autista" 
          value={email} 
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Accedi</Text>}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.serverSettingsBtn} 
          onPress={() => { setTempApiUrl(apiUrl); setShowServerConfig(true); }}
        >
          <Text style={styles.serverSettingsText}>⚙ Configurazione Server</Text>
        </TouchableOpacity>

        {/* Server Config Modal */}
        <Modal visible={showServerConfig} transparent animationType="slide">
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Configura Server</Text>
              <Text style={styles.modalDetailText}>
                Indirizzo API del gestionale:
              </Text>
              <TextInput
                style={[styles.input, { fontSize: 13 }]}
                value={tempApiUrl}
                onChangeText={setTempApiUrl}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="https://breci-gestionale.vercel.app/api/driver"
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.actionBtn, { backgroundColor: '#3b82f6' }]} 
                  onPress={() => {
                    let clean = tempApiUrl.trim();
                    if (clean) {
                      if (!clean.endsWith('/api/driver')) {
                        if (clean.endsWith('/')) clean = clean.slice(0, -1);
                        if (!clean.includes('/api/driver')) clean = `${clean}/api/driver`;
                      }
                      setApiUrl(clean);
                      setShowServerConfig(false);
                      Alert.alert('Configurazione Salvata', `Server impostato su:\n${clean}`);
                    }
                  }}
                >
                  <Text style={styles.buttonText}>Salva</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.actionBtn, { backgroundColor: '#6b7280' }]} 
                  onPress={() => {
                    setTempApiUrl(DEFAULT_API_URL);
                    setApiUrl(DEFAULT_API_URL);
                    setShowServerConfig(false);
                    Alert.alert('Ripristinato', `Server predefinito Vercel ripristinato.`);
                  }}
                >
                  <Text style={styles.buttonText}>Default</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                style={{ marginTop: 20, alignItems: 'center' }} 
                onPress={() => setShowServerConfig(false)}
              >
                <Text style={{ color: '#6b7280', fontWeight: 'bold' }}>Chiudi</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <StatusBar style="dark" />
      </View>
    );
  }

  const weekDays = getWeekDays(currentWeekStart);
  const filteredSchedules = schedules
    .filter(s => s.date === selectedDate)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  return (
    <View style={styles.mainContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>Ciao, {driver.name}</Text>
        <TouchableOpacity onPress={() => { setDriver(null); setSchedules([]); }}>
          <Text style={styles.logoutText}>Esci</Text>
        </TouchableOpacity>
      </View>

      {/* Week Calendar Selector */}
      <View style={styles.calendarContainer}>
        <View style={styles.calendarHeader}>
          <TouchableOpacity onPress={handlePrevWeek} style={styles.navBtn}>
            <Text style={styles.navBtnText}>◀</Text>
          </TouchableOpacity>
          <View style={styles.calendarLabelContainer}>
            <Text style={styles.calendarMonthLabel}>{getMonthYearLabel(currentWeekStart)}</Text>
            <TouchableOpacity 
              onPress={() => {
                const today = new Date();
                setSelectedDate(formatDateString(today));
                setCurrentWeekStart(getMonday(today));
              }}
              style={styles.todayBtn}
            >
              <Text style={styles.todayBtnText}>Oggi</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={handleNextWeek} style={styles.navBtn}>
            <Text style={styles.navBtnText}>▶</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.weekRow}>
          {weekDays.map((day, idx) => {
            const dayStr = formatDateString(day);
            const isSelected = dayStr === selectedDate;
            const isToday = formatDateString(new Date()) === dayStr;
            const dayNum = day.getDate();
            const dayNamesShort = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
            const dayName = dayNamesShort[day.getDay()];

            // Check if there are schedules on this day
            const hasSchedulesOnDay = schedules.some(s => s.date === dayStr);

            return (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.dayColumn,
                  isSelected && styles.selectedDayColumn
                ]}
                onPress={() => setSelectedDate(dayStr)}
              >
                <Text style={[
                  styles.dayNameText,
                  isSelected && styles.selectedDayNameText
                ]}>
                  {dayName}
                </Text>
                <View style={[
                  styles.dayNumberCircle,
                  isSelected && styles.selectedDayNumberCircle,
                  isToday && !isSelected && styles.todayNumberCircle
                ]}>
                  <Text style={[
                    styles.dayNumberText,
                    isSelected && styles.selectedDayNumberText,
                    isToday && !isSelected && styles.todayNumberText
                  ]}>
                    {dayNum}
                  </Text>
                </View>
                {hasSchedulesOnDay && (
                  <View style={[
                    styles.scheduleDot,
                    isSelected ? styles.selectedScheduleDot : styles.normalScheduleDot
                  ]} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <Text style={styles.sectionTitle}>Attività del Giorno</Text>
      
      {loading && schedules.length === 0 ? (
        <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={filteredSchedules}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderSchedule}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20, color: '#6b7280' }}>Nessuna attività pianificata per questo giorno.</Text>}
        />
      )}

      {/* Confirmation Modal */}
      <Modal visible={!!selectedSchedule} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Conferma Attività</Text>
            {selectedSchedule && (
              <>
                <View style={styles.modalDetails}>
                  <Text style={styles.modalDetailText}>Orario: <Text style={styles.boldText}>{formatTime(selectedSchedule.startDate)} - {formatTime(selectedSchedule.endDate)}</Text></Text>
                  <Text style={styles.modalDetailText}>Mezzo: <Text style={styles.boldText}>{selectedSchedule.vehicle?.plateNumber}</Text></Text>
                  {selectedSchedule.destination ? (
                    <>
                      <Text style={styles.modalDetailText}>Cliente: <Text style={styles.boldText}>{selectedSchedule.destination.client?.name || '-'}</Text></Text>
                      <Text style={styles.modalDetailText}>Cantiere: <Text style={styles.boldText}>{selectedSchedule.destination.name || '-'}</Text></Text>
                      {selectedSchedule.destination.address ? (
                        <Text style={styles.modalDetailText}>Indirizzo: <Text style={styles.boldText}>{selectedSchedule.destination.address}</Text></Text>
                      ) : null}
                    </>
                  ) : null}
                  {selectedSchedule.wasteType ? (
                    <Text style={styles.modalDetailText}>CER: <Text style={styles.boldText}>{selectedSchedule.wasteType.cerCode}</Text> {selectedSchedule.wasteType.description ? `(${selectedSchedule.wasteType.description})` : ''}</Text>
                  ) : null}
                  {selectedSchedule.notes ? (
                    <Text style={styles.modalDetailText}>Note: <Text style={{ fontStyle: 'italic' }}>{selectedSchedule.notes}</Text></Text>
                  ) : null}
                </View>
                
                <Text style={styles.label}>Tonnellate Caricate (t):</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Es. 24.5"
                  keyboardType="numeric"
                  value={loadedQuantity}
                  onChangeText={setLoadedQuantity}
                />

                <View style={styles.modalButtons}>
                  <TouchableOpacity 
                    style={[styles.actionBtn, { backgroundColor: '#10b981' }]} 
                    onPress={() => handleUpdateStatus('ESEGUITO')}
                  >
                    <Text style={styles.buttonText}>Conferma</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.actionBtn, { backgroundColor: '#ef4444' }]} 
                    onPress={() => handleUpdateStatus('ANNULLATO')}
                  >
                    <Text style={styles.buttonText}>Annullato</Text>
                  </TouchableOpacity>
                </View>
                
                <TouchableOpacity style={{ marginTop: 20, alignItems: 'center' }} onPress={() => setSelectedSchedule(null)}>
                  <Text style={{ color: '#6b7280', fontWeight: 'bold' }}>Chiudi</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', alignItems: 'center', justifyContent: 'center', padding: 20 },
  mainContainer: { flex: 1, backgroundColor: '#f3f4f6', paddingTop: 50 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1f2937', marginBottom: 5 },
  subtitle: { fontSize: 16, color: '#6b7280', marginBottom: 30 },
  input: { width: '100%', backgroundColor: '#fff', padding: 15, borderRadius: 8, borderWidth: 1, borderColor: '#d1d5db', marginBottom: 15 },
  button: { width: '100%', backgroundColor: '#3b82f6', padding: 15, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', backgroundColor: '#fff' },
  headerText: { fontSize: 18, fontWeight: 'bold' },
  logoutText: { color: '#ef4444', fontWeight: 'bold' },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginHorizontal: 20, marginTop: 15, marginBottom: 10 },
  
  // Calendar styles
  calendarContainer: { backgroundColor: '#fff', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 10 },
  navBtn: { padding: 10 },
  navBtnText: { fontSize: 18, color: '#4b5563' },
  calendarLabelContainer: { flexDirection: 'row', alignItems: 'center' },
  calendarMonthLabel: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
  todayBtn: { marginLeft: 10, backgroundColor: '#e5e7eb', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  todayBtnText: { fontSize: 12, fontWeight: '600', color: '#4b5563' },
  weekRow: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 10 },
  dayColumn: { alignItems: 'center', paddingVertical: 8, paddingHorizontal: 6, borderRadius: 8, minWidth: 42 },
  selectedDayColumn: { backgroundColor: '#eff6ff' },
  dayNameText: { fontSize: 11, color: '#6b7280', fontWeight: '600', marginBottom: 6 },
  selectedDayNameText: { color: '#2563eb' },
  dayNumberCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  selectedDayNumberCircle: { backgroundColor: '#2563eb' },
  todayNumberCircle: { borderWidth: 1.5, borderColor: '#2563eb' },
  dayNumberText: { fontSize: 14, fontWeight: '600', color: '#1f2937' },
  selectedDayNumberText: { color: '#fff', fontWeight: 'bold' },
  todayNumberText: { color: '#2563eb', fontWeight: 'bold' },
  scheduleDot: { width: 4, height: 4, borderRadius: 2, marginTop: 4 },
  normalScheduleDot: { backgroundColor: '#9ca3af' },
  selectedScheduleDot: { backgroundColor: '#2563eb' },
  
  // Card styles
  card: { backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTime: { fontSize: 15, fontWeight: 'bold', color: '#1f2937' },
  statusBadgeContainer: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  statusBadgeText: { fontSize: 11, fontWeight: 'bold' },
  cardTextPlate: { fontSize: 14, color: '#4b5563', marginBottom: 4 },
  cardNote: { fontSize: 13, color: '#6b7280', fontStyle: 'italic', marginTop: 4 },
  cardLoadedQty: { fontSize: 14, color: '#059669', marginTop: 6 },
  boldText: { fontWeight: 'bold' },

  // Modal styles
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', padding: 20, borderRadius: 12 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  modalDetails: { backgroundColor: '#f9fafb', padding: 12, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#e5e7eb' },
  modalDetailText: { fontSize: 14, color: '#374151', marginBottom: 6 },
  label: { fontSize: 15, fontWeight: 'bold', marginBottom: 8, color: '#374151' },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
  actionBtn: { flex: 1, padding: 15, borderRadius: 8, alignItems: 'center', marginHorizontal: 5 },
  serverSettingsBtn: { marginTop: 25, padding: 10 },
  serverSettingsText: { color: '#6b7280', fontSize: 13, textDecorationLine: 'underline' }
});
