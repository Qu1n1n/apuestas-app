import 'react-native-url-polyfill/auto';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

import LoginScreen from './src/screens/LoginScreen';
import SalasScreen from './src/screens/SalasScreen';

export type RootStackParamList = {
  Login: undefined;
  Salas: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ title: 'Entrar' }}
        />
        <Stack.Screen
          name="Salas"
          component={SalasScreen}
          options={{ title: 'Mis salas' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
