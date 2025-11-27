import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getStoredIp, saveServerIp } from '../utils/api';

const colorScheme = useColorScheme();
const backgroundColor = Colors[colorScheme ?? 'light'].background;

export default function SettingsScreen() {
  const [ip, setIp] = useState('');

  useEffect(() => {
    getStoredIp().then(currentIp => setIp(currentIp));
  }, []);

  const handleSave = async () => {
    const success = await saveServerIp(ip);
    if (success) {
      Alert.alert("Guardado", "La IP del servidor ha sido actualizada.");
    } else {
      Alert.alert("Error", "No se pudo guardar la IP.");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: backgroundColor }]}>
      <Text style={styles.label}>Dirección IP del servidor:</Text>
      <Text style={styles.hint}>Ejemplo: 192.168.1.35:5000</Text>
      
      <TextInput
        style={styles.input}
        value={ip}
        onChangeText={setIp}
        keyboardType="default"
        autoCapitalize="none"
      />

      <TouchableOpacity style={styles.button} onPress={handleSave}>
        <Text style={styles.buttonText}>Guardar configuración</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  label: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#858585ff' },
  hint: { fontSize: 14, color: '#666', marginBottom: 10 },
  input: { 
    backgroundColor: 'white', 
    padding: 15, 
    borderRadius: 8, 
    borderWidth: 1, 
    borderColor: '#ddd',
    fontSize: 16,
    marginBottom: 20
  },
  button: { backgroundColor: '#007AFF', padding: 15, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});