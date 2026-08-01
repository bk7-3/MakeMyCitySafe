import { StyleSheet, View, SafeAreaView} from 'react-native'
import {useState} from 'react'
import {Text, IconButton, Divider, TextInput, Button} from 'react-native-paper'
import React from 'react'
import { collection, addDoc, Timestamp} from "firebase/firestore"; 
import {db} from '../firebase'

const AlertModifyScreen = () => {
    const [message, setMessage] = useState('')
    const [expirationDate, setExpirationDate] = useState('')

    const school = {schoolID:'ccc'}
    const student = {id:1}
const sendAlert = async () => {
        try {
            const docRef = await addDoc(collection(db, "alerts"), {
              schoolID: school,
              message: message,
              createdDateTime: Timestamp.fromDate(new Date()),
              expirationDate:expirationDate,
              createdBy:student
            });
            console.log("Document written with ID: ", docRef.id);
          } catch (e) {
            console.error("Error adding document: ", e);
          }}
const deleteAlert = async (alertId) => {
    try {
        await deleteDoc(doc(db, "alerts", alertId));
            console.log("Document deleted with ID: ", alertId);
        } catch (e) {
            console.error("Error deleting document: ", e);
        }
        }
  return (
    <SafeAreaView>
    <View style ={{flexDirection:'row',alignItems:'center',justifyContent:'space-evenly'}}>
    <Text variant="labelLarge">Hello Scooby Doo</Text>
      
      <Text variant="labelLarge">15 Degree Sunny</Text>
      <IconButton
            icon="account"
            size={20}
            onPress={() => console.log('Pressed')}
        />
    </View>
    <Divider />
    <View style={{marginTop:20, marginHorizontal:5}}>
    <Text variant="titleLarge" style={{alignSelf:'center', marginBottom:20, marginTop:20}}>Alert Modify</Text>
    <TextInput
      label="Message"
      value={message}
      onChangeText={setMessage}
      mode='outlined'
      multiline
    />
    <TextInput
    style={{marginVertical:20}}
    label="Expiration Date"
    value={expirationDate}
    onChangeText={setExpirationDate}
    mode='outlined'
    multiline
    />
    <Button style={{marginTop:50}}icon="alert" mode="outlined" onPress={() => sendAlert()}>
            Modify Alert
      </Button>
      <Button style={{marginTop:20}} icon="delete" mode="outlined" onPress={() => deleteAlert('ID_OF_THE_ALERT_TO_DELETE')}>
                    Delete Alert
                </Button>
      </View>
    </SafeAreaView>
  )
}

export default AlertModifyScreen

const styles = StyleSheet.create({})
