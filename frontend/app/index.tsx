import React, { useState, useEffect } from "react";
import { 
  Text, 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  Alert, 
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  TextInput
} from "react-native";
import DocumentPicker from 'react-native-document-picker';
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

interface AttendeeRecord {
  timestamp: string;
  name: string;
  mobile: string;
  email: string;
  adults: string;
  children: string;
  bathukamma: string;
  upi: string;
  firstTime: string;
  source: string;
  is_present: boolean;
}

export default function AttendanceApp() {
  const [attendees, setAttendees] = useState<AttendeeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualId, setManualId] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [currentAttendee, setCurrentAttendee] = useState<AttendeeRecord | null>(null);
  const [modalType, setModalType] = useState<'confirm' | 'invalid' | 'already' | 'success'>('confirm');

  useEffect(() => {
    loadSavedData();
  }, []);

  const loadSavedData = async () => {
    try {
      const savedData = await AsyncStorage.getItem('attendees');
      if (savedData) {
        setAttendees(JSON.parse(savedData));
      }
    } catch (error) {
      console.log('Error loading saved data:', error);
    }
  };

  const saveData = async (data: AttendeeRecord[]) => {
    try {
      await AsyncStorage.setItem('attendees', JSON.stringify(data));
    } catch (error) {
      console.log('Error saving data:', error);
    }
  };

  const selectExcelFile = async () => {
    try {
      setIsLoading(true);
      const result = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.xls, DocumentPicker.types.xlsx],
        copyTo: 'documentDirectory',
      });

      if (result.fileCopyUri) {
        const fileContent = await FileSystem.readAsStringAsync(result.fileCopyUri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const workbook = XLSX.read(fileContent, { type: 'base64' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const processedData: AttendeeRecord[] = jsonData.map((row: any) => ({
          timestamp: row['Timestamp'] || '',
          name: row['Please mention your name '] || '',
          mobile: row['Please mention your primary mobile number WITHOUT country code (e.g. 9876543210)'] || '',
          email: row['Please mention your email id  (Primary) '] || '',
          adults: row['How many of you are attending the event (Adults) ? '] || '',
          children: row['How many of you are attending the event (Children below 12 years) ? '] || '',
          bathukamma: row['Are you preparing Bathukamma for the event?'] || '',
          upi: row['Please share UPI traction ID if donation done. '] || '',
          firstTime: row['Are you attending the KTCA Bathukamma event for the first time? '] || '',
          source: row['How do you come across about KTCA Bangalore Bathukamma event? '] || '',
          is_present: false,
        }));

        setAttendees(processedData);
        await saveData(processedData);
        
        Alert.alert(
          'Success', 
          `Excel file loaded successfully! Found ${processedData.length} attendees.`
        );
      }
    } catch (error) {
      if (DocumentPicker.isCancel(error)) {
        // User cancelled the picker
      } else {
        Alert.alert('Error', 'Failed to load Excel file. Please try again.');
        console.log('Error selecting file:', error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const startManualInput = () => {
    if (attendees.length === 0) {
      Alert.alert('No Data', 'Please select an Excel file first.');
      return;
    }
    setShowManualInput(true);
  };

  const handleManualIdSubmit = () => {
    if (!manualId.trim()) {
      Alert.alert('Error', 'Please enter a timestamp ID.');
      return;
    }

    const foundAttendee = attendees.find(attendee => attendee.timestamp === manualId.trim());
    
    if (!foundAttendee) {
      setModalType('invalid');
      setShowConfirmModal(true);
      setShowManualInput(false);
      setManualId('');
      return;
    }

    if (foundAttendee.is_present) {
      setCurrentAttendee(foundAttendee);
      setModalType('already');
      setShowConfirmModal(true);
      setShowManualInput(false);
      setManualId('');
      return;
    }

    setCurrentAttendee(foundAttendee);
    setModalType('confirm');
    setShowConfirmModal(true);
    setShowManualInput(false);
    setManualId('');
  };

  const confirmPresence = async () => {
    if (currentAttendee) {
      const updatedAttendees = attendees.map(attendee => 
        attendee.timestamp === currentAttendee.timestamp 
          ? { ...attendee, is_present: true }
          : attendee
      );
      
      setAttendees(updatedAttendees);
      await saveData(updatedAttendees);
      
      setModalType('success');
      setTimeout(() => {
        setShowConfirmModal(false);
        setCurrentAttendee(null);
      }, 2000);
    }
  };

  const exportExcel = async () => {
    if (attendees.length === 0) {
      Alert.alert('No Data', 'No attendance data to export.');
      return;
    }

    try {
      setIsLoading(true);
      
      const worksheet = XLSX.utils.json_to_sheet(attendees);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance');
      
      const wbout = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
      
      const filename = 'updated_attendance.xlsx';
      let fileUri: string;
      
      if (Platform.OS === 'android') {
        // For Android, save to Downloads folder
        const downloadsPath = FileSystem.documentDirectory + 'Download/';
        await FileSystem.makeDirectoryAsync(downloadsPath, { intermediates: true });
        fileUri = downloadsPath + filename;
      } else {
        // For iOS, save to document directory
        fileUri = FileSystem.documentDirectory + filename;
      }
      
      await FileSystem.writeAsStringAsync(fileUri, wbout, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      const presentCount = attendees.filter(a => a.is_present).length;
      
      Alert.alert(
        'Export Successful', 
        `File saved as ${filename}\nTotal: ${attendees.length} | Present: ${presentCount}`
      );
      
    } catch (error) {
      Alert.alert('Error', 'Failed to export Excel file. Please try again.');
      console.log('Export error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const closeModal = () => {
    setShowConfirmModal(false);
    setCurrentAttendee(null);
  };

  const presentCount = attendees.filter(a => a.is_present).length;

  if (showScanner) {
    return (
      <View style={styles.scannerContainer}>
        <StatusBar barStyle="light-content" />
        <CameraView
          onBarcodeScanned={handleBarCodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ["qr"],
          }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.scannerOverlay}>
          <View style={styles.scannerFrame} />
          <Text style={styles.scannerText}>Scan QR Code</Text>
          <TouchableOpacity 
            style={styles.cancelButton} 
            onPress={() => setShowScanner(false)}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <Text style={styles.title}>Attendance Tracker</Text>
        {attendees.length > 0 && (
          <Text style={styles.stats}>
            Total: {attendees.length} | Present: {presentCount}
          </Text>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {attendees.length === 0 ? (
          <View style={styles.welcomeSection}>
            <Ionicons name="document-text-outline" size={80} color="#666" />
            <Text style={styles.welcomeText}>Welcome to Attendance Tracker</Text>
            <Text style={styles.welcomeSubtext}>
              Select an Excel file to get started with attendance tracking
            </Text>
          </View>
        ) : (
          <View style={styles.statsSection}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{attendees.length}</Text>
              <Text style={styles.statLabel}>Total Attendees</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statNumber, styles.presentCount]}>{presentCount}</Text>
              <Text style={styles.statLabel}>Present</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{attendees.length - presentCount}</Text>
              <Text style={styles.statLabel}>Absent</Text>
            </View>
          </View>
        )}

        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.button, styles.primaryButton]} 
            onPress={selectExcelFile}
            disabled={isLoading}
          >
            <Ionicons name="document-outline" size={24} color="white" />
            <Text style={styles.buttonText}>
              {attendees.length === 0 ? 'Select Excel File' : 'Load New File'}
            </Text>
          </TouchableOpacity>

          {attendees.length > 0 && (
            <>
              <TouchableOpacity 
                style={[styles.button, styles.scanButton]} 
                onPress={startQRScanning}
                disabled={isLoading}
              >
                <Ionicons name="qr-code-outline" size={24} color="white" />
                <Text style={styles.buttonText}>Scan QR Code</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.button, styles.exportButton]} 
                onPress={exportExcel}
                disabled={isLoading}
              >
                <Ionicons name="download-outline" size={24} color="white" />
                <Text style={styles.buttonText}>Export Excel</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Processing...</Text>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showConfirmModal}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {modalType === 'invalid' && (
              <>
                <Ionicons name="close-circle" size={60} color="#FF3B30" />
                <Text style={styles.modalTitle}>Invalid QR Code</Text>
                <Text style={styles.modalMessage}>
                  This QR code is not found in the attendee list.
                </Text>
                <TouchableOpacity style={styles.modalButton} onPress={closeModal}>
                  <Text style={styles.modalButtonText}>OK</Text>
                </TouchableOpacity>
              </>
            )}

            {modalType === 'already' && currentAttendee && (
              <>
                <Ionicons name="checkmark-circle" size={60} color="#FF9500" />
                <Text style={styles.modalTitle}>Already Marked</Text>
                <Text style={styles.modalMessage}>
                  {currentAttendee.name} is already marked as present.
                </Text>
                <TouchableOpacity style={styles.modalButton} onPress={closeModal}>
                  <Text style={styles.modalButtonText}>Close</Text>
                </TouchableOpacity>
              </>
            )}

            {modalType === 'confirm' && currentAttendee && (
              <>
                <Ionicons name="person-circle" size={60} color="#007AFF" />
                <Text style={styles.modalTitle}>Mark Presence</Text>
                <Text style={styles.modalMessage}>
                  Mark presence for {currentAttendee.name}?
                </Text>
                <View style={styles.modalButtonRow}>
                  <TouchableOpacity 
                    style={[styles.modalButton, styles.cancelModalButton]} 
                    onPress={closeModal}
                  >
                    <Text style={styles.cancelModalButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.modalButton, styles.confirmModalButton]} 
                    onPress={confirmPresence}
                  >
                    <Text style={styles.modalButtonText}>Confirm</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {modalType === 'success' && currentAttendee && (
              <>
                <Ionicons name="checkmark-circle" size={60} color="#34C759" />
                <Text style={styles.modalTitle}>Success!</Text>
                <Text style={styles.modalMessage}>
                  {currentAttendee.name} marked as present.
                </Text>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1C1C1E',
    textAlign: 'center',
  },
  stats: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 4,
  },
  content: {
    padding: 20,
    flexGrow: 1,
  },
  welcomeSection: {
    alignItems: 'center',
    marginVertical: 40,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1C1C1E',
    marginTop: 16,
    textAlign: 'center',
  },
  welcomeSubtext: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  statsSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  statCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    flex: 1,
    marginHorizontal: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  presentCount: {
    color: '#34C759',
  },
  statLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
  },
  buttonContainer: {
    gap: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 12,
    minHeight: 56,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  scanButton: {
    backgroundColor: '#34C759',
  },
  exportButton: {
    backgroundColor: '#FF9500',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#8E8E93',
  },
  scannerContainer: {
    flex: 1,
  },
  scannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: 'white',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  scannerText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
  },
  cancelButton: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 40,
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    minWidth: 300,
    maxWidth: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginTop: 16,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  modalButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
    minWidth: 100,
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelModalButton: {
    backgroundColor: '#8E8E93',
  },
  cancelModalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  confirmModalButton: {
    backgroundColor: '#34C759',
  },
});
