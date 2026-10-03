import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
 import AlertSendScreen from './screens/AlertSendScreen';
 import HazardUpdateScreen from './screens/HazardUpdateScreen';
 import HazardReportScreen from './screens/HazardReportScreen';
 import MainScreen from './screens/MainScreen';
import LogInScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import HelpScreen from './screens/SOSScreen';
import SuggestAddScreen from './screens/SuggestAddScreen';
import SuggestListScreen from './screens/SuggestListScreen';
import Header from './screens/Header';
import EbikeSafetyScreen from './screens/EbikeSafetyScreen';
import SuggestDetailScreen from './screens/SuggestDetailScreen';
import VolunteerDashboardScreen from './screens/VolunteerDashboard';
import CreateOpportunityScreen from './screens/CreateOpportunityScreen';
import OpportunityDetailScreen from './screens/OpportunityDetailScreen';
import SocialScreen from './screens/SocialScreen';
import { PaperProvider } from 'react-native-paper';
import theme from './theme';
import PinChatScreen from './screens/PinChatScreen';






const Stack = createNativeStackNavigator();
const App = () => {
  return (
    <PaperProvider theme={theme}>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="Login" component={LogInScreen} options={{ headerShown: false}} />
          <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false}} />
          <Stack.Screen name="Main" component={MainScreen} options={{header:Header}} />
    <Stack.Screen name="Help Screen" component={HelpScreen}/>
    <Stack.Screen name="Hazard Report" component={HazardReportScreen} options={{ headerShown: false }} />
    <Stack.Screen name="HazardUpdateScreen" component={HazardUpdateScreen}/>
    <Stack.Screen name="Alert Send" component={AlertSendScreen} />
    <Stack.Screen name="SuggestDetailScreen" component={SuggestDetailScreen}/>
    <Stack.Screen  name="PinChatScreen" component={PinChatScreen} options={{ headerBackTitleVisible: false }} />
    <Stack.Screen name="Suggest Add" component={SuggestAddScreen} />
     <Stack.Screen name="socialScreen" component={SocialScreen} />
    <Stack.Screen name="Suggest List" component={SuggestListScreen} />
    <Stack.Screen name="Create Opportunity" component={CreateOpportunityScreen}/>
    <Stack.Screen name="Opportunity Detail" component={OpportunityDetailScreen}/>
    <Stack.Screen name="VolunteerDashboard" component={VolunteerDashboardScreen}/>
    <Stack.Screen  name="EbikeSafetyScreen" component={EbikeSafetyScreen} options={{ title: 'E-Bike Safety' }} />
  </Stack.Navigator>
  </NavigationContainer>
  </PaperProvider>
  )
}

export default App

const styles = StyleSheet.create({})
