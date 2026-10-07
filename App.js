import React from 'react';
import { StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PaperProvider, MD3LightTheme as DefaultTheme } from 'react-native-paper';

// Auth
import LogInScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';

// Home
import MainScreen from './screens/MainScreen';

// Hazards
import HazardReportScreen from './screens/HazardReportScreen';
import HazardUpdateScreen from './screens/HazardUpdateScreen';

// Alerts
import AlertSendScreen from './screens/AlertSendScreen';

// Suggestions
import SuggestAddScreen from './screens/SuggestAddScreen';
import SuggestListScreen from './screens/SuggestListScreen';
import SuggestDetailScreen from './screens/SuggestDetailScreen';

// Volunteer
import VolunteerDashboard from './screens/VolunteerDashboard';
import CreateOpportunityScreen from './screens/CreateOpportunityScreen';
import OpportunityDetailScreen from './screens/OpportunityDetailScreen';

// Crime Map
import CrimeMapScreen from './screens/CrimeMapScreen';
import ReportIncidentScreen from './screens/ReportIncidentScreen';
import IncidentDetailScreen from './screens/IncidentDetailScreen';
import IncidentListScreen from './screens/IncidentListScreen';

import EbikeSafetyScreen from './screens/EbikeSafetyScreen';
import SOSScreen from './screens/SOSScreen';
import PinChatScreen from './screens/PinChatScreen';
import SocialScreen from './screens/SocialScreen';

const Stack = createNativeStackNavigator();

// Optional: global paper theme
const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#000666',
  },
};

const App = () => {
  return (
    <PaperProvider theme={theme}>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Login"
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen name="Login" component={LogInScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />

          <Stack.Screen name="Main" component={MainScreen} />

          <Stack.Screen name="Hazard Report" component={HazardReportScreen} />
          <Stack.Screen name="Hazard Update" component={HazardUpdateScreen} />

          <Stack.Screen name="Alert Send" component={AlertSendScreen} />

          <Stack.Screen name="Suggest List" component={SuggestListScreen} />
          <Stack.Screen name="Suggest Add" component={SuggestAddScreen} />
          <Stack.Screen name="Suggest Detail" component={SuggestDetailScreen} />

          <Stack.Screen name="VolunteerDashboard" component={VolunteerDashboard} />
          <Stack.Screen name="Create Opportunity" component={CreateOpportunityScreen} />
          <Stack.Screen name="Opportunity Detail" component={OpportunityDetailScreen} />

          <Stack.Screen name="Crime Map" component={CrimeMapScreen} />
          <Stack.Screen name="Report Incident" component={ReportIncidentScreen} />
          <Stack.Screen name="Incident List" component={IncidentListScreen} />
          <Stack.Screen name="Incident Detail" component={IncidentDetailScreen} />

          <Stack.Screen name="E-Bike Safety" component={EbikeSafetyScreen} />
          <Stack.Screen name="Help Screen" component={SOSScreen} />

          <Stack.Screen name="PinChatScreen" component={PinChatScreen} />
          <Stack.Screen name="socialScreen" component={SocialScreen} />
          

        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
};

export default App;

const styles = StyleSheet.create({});
