import { StyleSheet, View, SafeAreaView } from 'react-native';
import { useState } from 'react';
import { Text, IconButton, Divider, TextInput, Button } from 'react-native-paper';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

const SCHOOL = { studentid: '1', schoolID: 'aaa' };

const AlertSendScreen = () => {
  const [message, setMessage] = useState('');
  const [expirationDate, setExpirationDate] = useState('');

  const sendAlert = async () => {
    try {
      const docRef = await addDoc(collection(db, 'alerts'), {
        schoolID: SCHOOL.schoolID,
        message,
        createdDateTime: Timestamp.fromDate(new Date()),
        expirationDate,
        createdBy: SCHOOL.studentid,
      });
      console.log('Document written with ID: ', docRef.id);
    } catch (e) {
      console.error('Error adding document: ', e);
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
        <Text variant="titleMedium" style={styles.title}>Send Alert</Text>
        <TextInput label="Message" value={message} onChangeText={setMessage} mode="outlined" multiline />
        <TextInput
          style={styles.expirationInput}
          label="Expiration Date"
          value={expirationDate}
          onChangeText={setExpirationDate}
          mode="outlined"
          multiline
        />
        <Button style={styles.sendBtn} icon="alert" mode="outlined" onPress={sendAlert}>
          Send Alert
        </Button>
      </View>
    </SafeAreaView>
  );
};

export default AlertSendScreen;

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly' },
  body: { marginTop: 20, marginHorizontal: 5 },
  title: { alignSelf: 'center', marginBottom: 20 },
  expirationInput: { marginVertical: 20 },
  sendBtn: { marginTop: 50 },
});
