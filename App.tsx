import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import SSOWebViewScreen from './src/screens/SSOWebViewScreen';
import { ActivityIndicator, View, StyleSheet } from 'react-native';

const Stack = createNativeStackNavigator();

function Navigation() {
  const { isAuthenticated, isLoading, user } = useAuth();

  // console.log('[App/Navigation] 🔄 Re-render');
  // console.log('[App/Navigation] 📊 isAuthenticated:', isAuthenticated);
  // console.log('[App/Navigation] 📊 isLoading:', isLoading);
  // console.log('[App/Navigation] 📊 user:', user?.email || 'null');
  // console.log('[App/Navigation] 🎬 Will show:', isAuthenticated ? 'HomeScreen' : 'LoginScreen');

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ animationTypeForReplace: 'pop' }}
          />
        ) : (
          <>
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ animationTypeForReplace: 'push' }}
            />
            <Stack.Screen
              name="SSOLogin"
              component={SSOWebViewScreen}
              options={{ animationTypeForReplace: 'push' }}
            />
          </>
        )}
      </Stack.Navigator>
      
      {/* Loading overlay khi đang xử lý auth */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      )}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Navigation />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
});
