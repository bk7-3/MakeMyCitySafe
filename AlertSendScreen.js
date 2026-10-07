//This screen is for school staff


import { StyleSheet, View, SafeAreaView} from 'react-native'
import {useState} from 'react'
import {Text, IconButton, Divider, TextInput, Button} from 'react-native-paper'
import React from 'react'
import { collection, addDoc, Timestamp} from "firebase/firestore"; 
import {db} from '../firebase'

const AlertSendScreen = (navigation) => {
    const [message, setMessage] = useState('')
    const [expirationDate, setExpirationDate] = useState('')

    const school = {studentid:'1', schoolID:'aaa'}

    const sendAlert = async () => {
        try {
            const docRef = await addDoc(collection(db, "alerts"), {
              schoolID: school.schoolID,
              message: message,
              createdDateTime: Timestamp.fromDate(new Date()),
              expirationDate:expirationDate,
              createdBy:school.studentid
            });
            console.log("Document written with ID: ", docRef.id);
            
          } catch (e) {
            console.error("Error adding document: ", e);
          }


    }
  return (
    <SafeAreaView>
      {/*Header*/}  
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
      {/*Body*/}
      <View style={{marginTop:20, marginHorizontal:5}}>
      <Text variant="titleMedium" style={{alignSelf:'center', marginBottom:20}}>Send Alert</Text>
      {/*Input for message*/}
      <TextInput
      label="Message"
      value={message}
      onChangeText={setMessage}
      mode='outlined'
      multiline
    />
      {/*Input for expiration date*/}
      <TextInput
      style={{marginVertical:20}}
      label="Expiration Date"
      value={expirationDate}
      onChangeText={setExpirationDate}
      mode='outlined'
      multiline
    />
      {/*Button*/}
      <Button style={{marginTop:50}}icon="alert" mode="outlined" onPress={() => sendAlert()} >
            
            Send Alert
      </Button>
      </View>
   </SafeAreaView>
  )
}

export default AlertSendScreen

const styles = StyleSheet.create({})
