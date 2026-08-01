import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { IconButton } from 'react-native-paper';
import { auth } from '../firebase';
import { Button } from 'react-native-paper'

const Header = ({navigation}) => {
  const [weather, setWeather] = useState(null);
  const [userName, setUserName] = useState('');
  const [error, setError] = useState(null);

  const fetchWeather = async () => {
    try {
      const apiKey = '6f3a0d0256c16b6d937b2d6686b373b1'; 
      const city = 'Yorba Linda';
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${apiKey}`
      );

      if (!response.ok) {
        throw new Error('Error fetching weather data');
      }

      const data = await response.json();
      
      console.log("Weather API Response:", data);

      if (data.main && data.weather) {
        setWeather({
          temperature: Math.round(data.main.temp),
          condition: data.weather[0].main,
        });
      } else {
        throw new Error('Incomplete weather data');
      }
    } catch (error) {
      console.error("Error fetching weather data:", error);
      setError('Unable to fetch weather data');
    }
  };


  const fetchUserName = () => {
    const user = auth.currentUser;
    if (user) {
      setUserName(user.displayName || "User");
    } else {
      setUserName('Guest');
    }
  };

  useEffect(() => {
    fetchWeather();
  }, []);

  return (
    <SafeAreaView>
      <View style={styles.headerContainer}>
        <Text style={styles.welcomeText}>Welcome, {userName}!</Text>
        {weather ? (
          <Text style={styles.weatherText}>
            {weather.temperature}°C, {weather.condition}
          </Text>
        ) : error ? (
          <Text style={styles.weatherErrorText}>{error}</Text>
        ) : (
          <Text>Loading weather...</Text>
        )}
        <IconButton
          size={20}
          onPress={() => navigation.navigate('Help Screen')}
          icon="alert"
                />
      </View>
      
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    padding: 10,
  },
  welcomeText: {
    fontSize: 16,
  },
  weatherText: {
    fontSize: 16,
  },
  weatherErrorText: {
    color: 'red',
    fontSize: 16,
  },
});

export default Header;
