import 'react-native-url-polyfill/auto';
import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

import LoginScreen from './src/screens/LoginScreen';
import SalasScreen from './src/screens/SalasScreen';
import CrearSalaScreen from './src/screens/CrearSalaScreen';
import SalaDetalleScreen from './src/screens/SalaDetalleScreen';
import CrearApuestaScreen from './src/screens/CrearApuestaScreen';
import ApuestaDetalleScreen from './src/screens/ApuestaDetalleScreen';
import AnadirMiembroScreen from './src/screens/AnadirMiembroScreen';
import PerfilScreen from './src/screens/PerfilScreen';
import SalaEstadisticasScreen from './src/screens/SalaEstadisticasScreen';

export type RootStackParamList = {
  Login: undefined;
  Salas: undefined;
  CrearSala: undefined;
  SalaDetalle: { salaId: string; salaNombre: string };
  CrearApuesta: { salaId: string };
  ApuestaDetalle: { apuestaId: string };
  AnadirMiembro: { salaId: string; salaNombre: string };
  Perfil: undefined;
  SalaEstadisticas: { salaId: string; salaNombre: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Entrar' }} />
        <Stack.Screen
          name="Salas"
          component={SalasScreen}
          options={({ navigation }) => ({
            title: 'Mis salas',
            headerRight: () => (
              <TouchableOpacity onPress={() => navigation.navigate('Perfil')}>
                <Text style={{ color: '#2563eb', fontWeight: '600' }}>Perfil</Text>
              </TouchableOpacity>
            ),
          })}
        />
        <Stack.Screen name="CrearSala" component={CrearSalaScreen} options={{ title: 'Nueva sala' }} />
        <Stack.Screen
          name="SalaDetalle"
          component={SalaDetalleScreen}
          options={({ route }) => ({ title: route.params.salaNombre })}
        />
        <Stack.Screen
          name="CrearApuesta"
          component={CrearApuestaScreen}
          options={{ title: 'Nueva apuesta' }}
        />
        <Stack.Screen
          name="ApuestaDetalle"
          component={ApuestaDetalleScreen}
          options={{ title: 'Apuesta' }}
        />
        <Stack.Screen
          name="AnadirMiembro"
          component={AnadirMiembroScreen}
          options={{ title: 'Añadir amigos' }}
        />
        <Stack.Screen name="Perfil" component={PerfilScreen} options={{ title: 'Mi perfil' }} />
        <Stack.Screen
          name="SalaEstadisticas"
          component={SalaEstadisticasScreen}
          options={({ route }) => ({ title: `Ranking · ${route.params.salaNombre}` })}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
