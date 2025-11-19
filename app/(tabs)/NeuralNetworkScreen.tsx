import React, { useMemo, useState } from 'react';
import { Alert, Button, StyleSheet, Text, TextInput, View } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { SafeAreaView } from 'react-native-safe-area-context';

import Svg, { Circle, G, Line, Text as SvgText } from 'react-native-svg';

import { useCategories } from '@/context/CategoriesContext';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { ThemedText } from '@/components/themed-text';
import * as ImagePicker from 'expo-image-picker';

// colores (máx. 5 categorías)
const DEFAULT_COLORS = [
  '#FF3B30',
  '#34C759',
  '#007AFF',
  '#FF9500', 
  '#AF52DE', 
];

// primera capa L1
const L1_NODES = Array.from({ length: 3 }).map((_, i) => ({
  id: `l1-${i}`, x: 50, y: 75 + i * 75
}));

// hidden layer L2
const L2_NODES = Array.from({ length: 3 }).map((_, i) => ({
  id: `l2-${i}`, x: 200, y: 75 + i * 75
}));

// lienzo
const SVG_HEIGHT = 300;
const SVG_WIDTH = 400;

export default function NeuralNetworkScreen() {

  // estado global de categorías
  const { categories } = useCategories();
  // demás estados
  const [learningRate, setLearningRate] = useState('0.001');
  const [epochs, setEpochs] = useState('10');

  // probabilidades (salida softmax del modelo)
  const [probabilities, setProbabilities] = useState(
    Array(categories.length).fill(1 / categories.length)
  );

  // salida de la red (dinámica según categorías)
  // useMemo recalcula la red solo si categories cambia
  const { outputNodes, allEdges } = useMemo(() => {
    
    const numOutputs = categories.length;
    const ySpacing = SVG_HEIGHT / (numOutputs + 1); 
    
    const dynamicOutputNodes = categories.map((cat, i) => ({
      id: `l3-${i}`,
      x: 350,
      y: ySpacing * (i + 1),
      ...cat
    }));

    const dynamicEdges = [
      // L1 a L2
      ...L1_NODES.flatMap(l1 =>
        L2_NODES.map(l2 => ({
          id: `${l1.id}-${l2.id}`, from: l1, to: l2, type: 'l1-l2', targetIndex: null
        }))
      ),
      // L2 a L3
      ...L2_NODES.flatMap(l2 =>
        dynamicOutputNodes.map((l3, index) => ({
          id: `${l2.id}-${l3.id}`, from: l2, to: l3, type: 'l2-l3', targetIndex: index
        }))
      ),
    ];

    return { outputNodes: dynamicOutputNodes, allEdges: dynamicEdges };

  }, [categories]);

  // simulacion
  const simulatePrediction = () => {
    const raw = Array.from({ length: categories.length }, () => Math.random());
    const sum = raw.reduce((a, b) => a + b, 0);
    const normalized = raw.map(v => v / sum);
    setProbabilities(normalized);
  };
  
  const [cameraPermission, requestPermission] = ImagePicker.useCameraPermissions();

  const handlePredictRequest = async (imageUri: string) => {
    const API_URL = 'http://192.168.0.89:5000/predict';
    
    const formData = new FormData();
    formData.append('image', { uri: imageUri, name: 'test.jpg', type: 'image/jpeg' } as any);

    try {
      const response = await fetch(API_URL, { method: 'POST', body: formData, headers: {'Content-Type': 'multipart/form-data'} });
      const json = await response.json();
      
      if (json.probabilities_map) {
        const probabilities_full = categories.map(category => {
          return json.probabilities_map[category.label] || 0.0;
        });    
        setProbabilities(probabilities_full);
      }
    } catch (error) {
      console.error("Error al predecir:", error);
      Alert.alert("Error", "No se pudo conectar con el servidor.");
    }
  };

  const handleTestWithCamera = async () => {
    // pide permiso
    if (!cameraPermission?.granted) {
      const permissionResponse = await requestPermission();
      if (!permissionResponse.granted) {
        Alert.alert("Error", "Necesitas dar permisos de cámara para testear.");
        return;
      }
    }
    
    // abrir camara
    let result = await ImagePicker.launchCameraAsync({
      allowsEditing: true, // para editar y obtener mejores resultados
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled) {
      // pegar al endpoint
      const photoUri = result.assets[0].uri;
      handlePredictRequest(photoUri);
    }
  };

  // entrenamiento endpoint
  const handleTrain = async () => {
    const TRAIN_URL = 'http://192.168.0.89:5000/train';

    try {  
      const lr_to_send = parseFloat(learningRate) || 0.001;
      const epochs_to_send = parseInt(epochs) || 10;

      Alert.alert(
        "Iniciando Entrenamiento",
        `LR=${lr_to_send}, Épocas=${epochs_to_send}...`
      );

      const trainResponse = await fetch(TRAIN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          learning_rate: lr_to_send,
          epochs: epochs_to_send
        }) 
      });

      if (!trainResponse.ok) {
         const errJson = await trainResponse.json();
         throw new Error(errJson.error || 'Error desconocido del servidor');
      }

      const trainJson = await trainResponse.json();
      Alert.alert(
        "¡Éxito!",
        `¡Modelo entrenado con éxito! Clases: ${trainJson.classes.join(', ')}`
      );

    } catch (error: any) {
      console.error('Error al iniciar el entrenamiento:', error);
      Alert.alert("Error de Entrenamiento", error.message || "No se pudo construir el modelo.");
    }
  };

  const colorScheme = useColorScheme();
  const backgroundColor = Colors[colorScheme ?? 'light'].background;
  return (
    <SafeAreaView style={{ flex:1, backgroundColor: backgroundColor}}>
    <ThemedView style={styles.container}>
      <ThemedText type='title'>Red neuronal</ThemedText>
      <View style={styles.networkContainer}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}>
          
          {/* enlaces dinámicos */}
          {allEdges.map((edge) => {
            
            // SOLO LA CAPA DE SALIDA TIENE VALORES INDEX, COLOR, GROSOR Y OPACIDAD
            const isL2L3 = edge.targetIndex !== null;
            const prob = isL2L3 ? probabilities[edge.targetIndex] : 1;         
            const color = isL2L3 ? categories[edge.targetIndex].color : '#5a5a5aff';
            const strokeWidth = isL2L3 ? (0.5 + (prob * 6)) : 2;           
            const opacity = isL2L3 ? (0.2 + (prob * 0.8)) : 0.5;

            return (
              <Line
                key={edge.id}
                x1={edge.from.x} y1={edge.from.y}
                x2={edge.to.x} y2={edge.to.y}
                stroke={color}
                strokeWidth={strokeWidth}
                strokeOpacity={opacity}
                strokeLinecap="round"
              />
            );
          })}

          {/* nodos L1 y L2 */}
          {[...L1_NODES, ...L2_NODES].map(node => (
             <Circle key={node.id} cx={node.x} cy={node.y} r="8" fill="#5a5a5aff" />
          ))}

          {/* nodos L3 dinámicos */}
          {outputNodes.map((node, index) => {
            let prob = 0;
            if (probabilities[index] != null) {
              prob = probabilities[index];
            }
            const isActive = prob > (1 / categories.length) * 0.5; // mejor que la media
            
            return (
              <G key={node.id}>
                <Circle
                  cx={node.x} cy={node.y} r="18"
                  stroke={node.color}
                  strokeWidth={isActive ? 3 : 1.5}
                  fill="transparent"
                  strokeOpacity={isActive ? 1 : 0.5}
                />
                <Circle
                  cx={node.x} cy={node.y} 
                  r={10 + (prob * 8)}
                  fill={node.color}
                  fillOpacity={0.2 + (prob * 0.8)}
                />
                <SvgText
                  x={node.x} y={node.y - 25}
                  fontSize="10" fill={isActive ? node.color : '#3f3f3fff'}
                  textAnchor="middle" fontWeight="bold"
                >
                  {node.label}
                </SvgText>
                <SvgText
                  x={node.x} y={node.y + 30}
                  fontSize="10" fill={isActive ? node.color : '#3f3e3eff'}
                  textAnchor="middle" fontWeight="bold"
                >
                  {(prob * 100).toFixed(0)}%
                </SvgText>
              </G>
            );
          })}

        </Svg>
      </View>
      {/* botones de simulación para probar */}
      <View style={styles.simButtons}>
        <Button title="Simular Predicción" onPress={simulatePrediction} />
        <Button title="Testear con Cámara" onPress={handleTestWithCamera} />
      </View>
      <View style={styles.paramContainer}>
        <View style={styles.paramInput}>
          <Text style={styles.paramInputLabel}>Learning Rate:</Text>
          <TextInput
            style={styles.input}
            value={learningRate}
            onChangeText={setLearningRate}
            keyboardType="numeric"
          />
        </View>
        <View style={styles.paramInput}>
          <Text style={styles.paramInputLabel}>Épocas:</Text>
          <TextInput
            style={styles.input}
            value={epochs}
            onChangeText={setEpochs}
            keyboardType="number-pad"
          />
        </View>
      </View>
      <Button title="Entrenar" onPress={handleTrain} />
    </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 10, 
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { 
    textAlign: 'center', 
    marginBottom: 15, 
    fontSize: 22,
    fontWeight: 'bold',
  },
  simButtons: { 
    flexDirection: 'row', 
    justifyContent: 'space-around',
    width: '100%', 
    marginBottom: 15,
    flexWrap: 'wrap',
    gap: 5,
  },
  networkContainer: { 
    height: 350, 
    width: '98%', 
    backgroundColor: '#F7F7F7',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
    margin: 10,
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
    color: 'white',
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