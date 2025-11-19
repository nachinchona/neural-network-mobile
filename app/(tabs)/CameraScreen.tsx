import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaterialIcons } from '@expo/vector-icons';

import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useEffect, useRef, useState } from 'react';

import { useCategories } from '@/context/CategoriesContext';

interface PendingPhoto {
  uri: string;
  label: string;
}

export default function CameraScreen() {
  const MAX_CATEGORIES = 5

  // colores (máx. 5 categorías)
  const DEFAULT_COLORS = [
    '#FF3B30',
    '#34C759',
    '#007AFF',
    '#FF9500', 
    '#AF52DE', 
  ];

  // estados
  const { categories, setCategories } = useCategories();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    categories[0]?.label || null
  );
  const [learningRate, setLearningRate] = useState('0.001');
  const [epochs, setEpochs] = useState('10');

  // permisos de cámara
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    requestPermission();
  }, []);

  const sendPhotoToTrain = async (photoUri: string, label: string) => {
    const API_URL = 'http://192.168.0.89:5000/upload';
    const formData = new FormData();

    formData.append('image', {
      uri: photoUri,
      name: `photo_${Date.now()}.jpg`,
      type: 'image/jpeg',
    } as any);

    formData.append('label', label);

    try {
      console.log(`Enviando foto a ${API_URL} con la etiqueta: ${label}`);
      
      const response = await fetch(API_URL, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const json = await response.json();
      console.log('Respuesta del servidor:', json);
      
    } catch (error) {
      console.error('Error al subir la foto:', error);
      Alert.alert("Error", "No se pudo conectar con el servidor. Revisa la IP.");
    }
  };

  // sacar foto
  const takePicture = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync();
      console.log('Foto tomada:', photo.uri);
      console.log('Clasificada como:', selectedCategory);
      // añadir imagen a estado de fotos pendientes
      if (selectedCategory) {
        // pegar al endpoint
        const success = await sendPhotoToTrain(photo.uri, selectedCategory);
        if (success != null) { 
          if (!success) {
            // error
            Alert.alert("Error",
              `No se pudieron enviar las imágenes. Proceso cancelado.`);
          }
        }
      } else {
        Alert.alert("Error", "No hay ninguna categoría seleccionada.");
      }
    }
  };

  // añadir clase
  const addCategory = () => {
    if (categories.length >= 5) return;
    
    const newLength = categories.length + 1;
    const newCategoryName = `Cosa ${newLength}`;

    setCategories([
      ...categories,
      { label: newCategoryName, color: DEFAULT_COLORS[categories.length] }
    ]);
    setSelectedCategory(newCategoryName);
  };

  // editar clase
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [tempName, setTempName] = useState('');

  const handleEditPress = (index: number) => {
    setEditingIndex(index);
    setTempName(categories[index].label);
  };

  const handleNameSave = () => {
    if (editingIndex === null) return;

    const oldName = categories[editingIndex].label;
    const newCategories = [...categories];
    newCategories[editingIndex] = {...newCategories[editingIndex], label: tempName};
    
    setCategories(newCategories);
    
    if (selectedCategory === oldName) {
      setSelectedCategory(tempName);
    }
    
    setEditingIndex(null);
    setTempName('');
  };

  // eliminar clase
  const handleDeleteCategory = (index: number) => {
    const categoryName = categories[index].label;

    Alert.alert(
      "Eliminar Categoría",
      `¿Estás seguro de que quieres eliminar "${categoryName}"?`,
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Eliminar",
          onPress: () => {
            const newCategories = categories.filter((_, i) => i !== index);
            setCategories(newCategories);

            if (selectedCategory === categoryName) {
              setSelectedCategory(newCategories[0]?.label || '');
            }
          },
          style: "destructive",
        },
      ]
    );
  };

  // pregunta de para obtener permisos
  if (!permission?.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>Necesitas dar permisos de cámara.</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Dar Permiso</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#555555ff' }}
      headerImage={
        <View>
        </View>
      }
    >

      <ThemedView style={styles.cameraSectionContainer}>
        <CameraView 
          style={styles.cameraPreview} 
          ref={cameraRef}
        />
          
        <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
          <View style={styles.captureButtonInner} />
        </TouchableOpacity>

        <View style={styles.categoryContainer}>
          {categories.map((category, index) => {
            return (
            <TouchableOpacity
              key={category.label}
              style={[
                styles.categoryButton,
                selectedCategory === category.label && styles.selectedButton
              ]}
              onPress={() => setSelectedCategory(category.label)}
              disabled={editingIndex === index}
            >
              {editingIndex === index ? (
                <TextInput
                  style={styles.textInput}
                  value={tempName}
                  onChangeText={setTempName}
                  onBlur={handleNameSave}
                  autoFocus={true}
                />
              ) : (
                <>
                  <ThemedText style={styles.categoryButtonText}>
                    {category.label}
                  </ThemedText>
                  
                  <View style={styles.iconContainer}>
                    <TouchableOpacity 
                      style={styles.iconButton} 
                      onPress={() => handleEditPress(index)}
                    >
                      <MaterialIcons name="edit" size={20} color="gray" />
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.iconButton} 
                      onPress={() => handleDeleteCategory(index)}
                    >
                      <MaterialIcons name="delete" size={20} color="gray" />
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </TouchableOpacity>
          )})}
          
          {categories.length < 5 &&
            (<TouchableOpacity onPress={addCategory}>
              <Text style={styles.addButton}>+</Text>
            </TouchableOpacity>)}
        </View>
      </ThemedView>
    </ParallaxScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  cameraSectionContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 20,
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionText: {
    color: 'white',
    fontSize: 18,
    marginBottom: 20,
  },
  permissionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
  },
  cameraPreview: {
    width: '85%',
    aspectRatio: 1,
    borderWidth: 2,
    borderColor: 'gray',
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'transparent',
    borderWidth: 4,
    borderColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 55,
    height: 55,
    borderRadius: 30,
    backgroundColor: '#007AFF',
  },
  categoryContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
  },
  categoryButton: {
    width: '80%',
    height: 50,
    borderWidth: 2,
    borderColor: 'gray',
    borderRadius: 5,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    alignItems: 'center',
  },
  categoryButtonText: {
    fontSize: 17,
  },
  selectedButton: {
    borderColor: 'red',
    borderWidth: 3,
  },
  editButton: {
    padding: 5,
  },
  textInput: {
    flex: 1,
    fontSize: 17,
    color: '#ffffffff',
  },
  addButton: {
    fontSize: 40,
    fontWeight: 'bold',
    paddingBottom: 5,
    color: '#007AFF',
  },
  iconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    padding: 5,
  },
  paramContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '90%',
    alignSelf: 'center',
    marginBottom: 15,
  },
  paramInput: {
    alignItems: 'center',
    flex: 1,
  },
  paramInputLabel: {
    fontSize: 14,
    color: 'gray',
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    width: '80%',
    textAlign: 'center',
    fontSize: 16,
    color: '#000',
  },
});