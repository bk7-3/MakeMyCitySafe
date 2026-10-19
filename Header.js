import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Platform } from 'react-native';
import { IconButton } from 'react-native-paper';
import { auth } from '../firebase';

const Header = ({ navigation }) => {
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

      if (data.main && data.weather) {
        setWeather({
          temperature: Math.round(data.main.temp),
          condition: data.weather[0].main,
        });
      } else {
        throw new Error('Incomplete weather data');
      }
    } catch (err) {
      console.error('Error fetching weather data:', err);
      setError('Unable to fetch weather data');
    }
  };

  useEffect(() => {
    fetchWeather();

    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        const fallbackName = user.email ? user.email.split('@')[0] : 'User';
        setUserName(user.displayName || fallbackName);
      } else {
        setUserName('Guest');
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerCard}>
        {/* Left Column: Greeting & Weather */}
        <View style={styles.textContainer}>
          <Text style={styles.welcomeText} numberOfLines={1}>
            Welcome, <Text style={styles.userNameText}>{userName}</Text>! 👋
          </Text>

          <View style={styles.weatherBadge}>
            {weather ? (
              <Text style={styles.weatherText}>
                🌤️ {weather.temperature}°C • {weather.condition}
              </Text>
            ) : error ? (
              <Text style={styles.weatherErrorText}>⚠️ Weather unavailable</Text>
            ) : (
              <Text style={styles.weatherLoadingText}>Loading weather...</Text>
            )}
          </View>
        </View>

        {/* Right Column: Alert Button */}
        <View style={styles.actionContainer}>
          <IconButton
            icon="alert-circle"
            iconColor="#d32f2f"
            size={26}
            style={styles.alertButton}
            onPress={() => navigation.navigate('Help Screen')}
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#f5f5f5',
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: Platform.OS === 'android' ? 12 : 6,
    marginBottom: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    // Elevation & Shadows
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: 10,
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#222222',
    marginBottom: 4,
  },
  userNameText: {
    color: '#0288d1',
    fontWeight: 'bold',
  },
  weatherBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  weatherText: {
    fontSize: 13,
    color: '#555555',
    fontWeight: '500',
  },
  weatherLoadingText: {
    fontSize: 13,
    color: '#888888',
    fontStyle: 'italic',
  },
  weatherErrorText: {
    fontSize: 12,
    color: '#d32f2f',
    fontWeight: '500',
  },
  actionContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertButton: {
    backgroundColor: '#ffebee',
    margin: 0,
  },
});

export default Header;
