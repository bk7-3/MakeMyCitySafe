import { StyleSheet, View, SafeAreaView } from 'react-native';
import { useState } from 'react';
import { Text, IconButton, Divider, TextInput, Button } from 'react-native-paper';
import { collection, addDoc, Timestamp, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

const SCHOOL = { schoolID: 'ccc' };
const STUDENT = { id: 1 };

const AlertModifyScreen = () => {
  const [message, setMessage] = useState('');
  const [expirationDate, setExpirationDate] = useState('');

  const sendAlert = async () => {
    try {
      const docRef = await addDoc(collection(db, 'alerts'), {
        schoolID: SCHOOL,
        message,
        createdDateTime: Timestamp.fromDate(new Date()),
        expirationDate,
        createdBy: STUDENT,
      });
      console.log('Document written with ID: ', docRef.id);
    } catch (e) {
      console.error('Error adding document: ', e);
    }
  };

  const deleteAlert = async (alertId) => {
    try {
      await deleteDoc(doc(db, 'alerts', alertId));
      console.log('Document deleted with ID: ', alertId);
    } catch (e) {
      console.error('Error deleting document: ', e);
    }
  };

  return (
    <SafeAreaView>
      <View style={styles.header}>
        <Text variant="labelLarge">Hello Scooby Doo</Text>
        <Text variant="labelLarge">15 Degree Sunny</Text>
        <IconButton icon="account" size={20} onPress={() => console.log('Pressed')} />
      </View>
      <Divider />
      <View style={styles.body}>
        <Text variant="titleLarge" style={styles.title}>Alert Modify</Text>
        <TextInput label="Message" value={message} onChangeText={setMessage} mode="outlined" multiline />
        <TextInput
          style={styles.expirationInput}
          label="Expiration Date"
          value={expirationDate}
          onChangeText={setExpirationDate}
          mode="outlined"
          multiline
        />
        <Button style={styles.modifyBtn} icon="alert" mode="outlined" onPress={sendAlert}>
          Modify Alert
        </Button>
        <Button style={styles.deleteBtn} icon="delete" mode="outlined" onPress={() => deleteAlert('ID_OF_THE_ALERT_TO_DELETE')}>
          Delete Alert
        </Button>
      </View>
    </SafeAreaView>
  );
};

export default AlertModifyScreen;

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly' },
  body: { marginTop: 20, marginHorizontal: 5 },
  title: { alignSelf: 'center', marginBottom: 20, marginTop: 20 },
  expirationInput: { marginVertical: 20 },
  modifyBtn: { marginTop: 50 },
  deleteBtn: { marginTop: 20 },
});
