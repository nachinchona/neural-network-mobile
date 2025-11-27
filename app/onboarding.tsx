import { AntDesign } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const slides = [
  {
    id: '1',
    title: 'Entrena tu Modelo',
    description: 'Usá la cámara de tu teléfono para entrenar tu red con tus dibujos.',
    icon: 'camera',
    color: '#003f5c',
  },
  {
    id: '2',
    title: 'Visualiza la Red',
    description: 'Mirá cómo reacciona la red con las imágenes que le mandás.',
    icon: 'branches',
    color: '#7a52aa',
  },
  {
    id: '3',
    title: '¡A Experimentar!',
    description: 'Jugá con los parámetros y mejorá tu red.',
    icon: 'rocket',
    color: '#008080',
  },
];

export default function OnboardingScreen() {
  const { width } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(0);
  const slidesRef = useRef<FlatList>(null);
  const colorScheme = useColorScheme();
  const backgroundColor = Colors[colorScheme ?? 'light'].background;

  const handleDone = async () => {
    try {
      await AsyncStorage.setItem('hasOnboarded', 'true');
      router.replace('/CameraScreen');
    } catch (e) {
      console.error(e);
    }
  };

  const viewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems && viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const scrollToNext = () => {
    if (currentIndex < slides.length - 1) {
      slidesRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      handleDone();
    }
  };

  const renderItem = ({ item }: any) => (
    <View style={[styles.slide, { width, backgroundColor: item.color }]}>
      <AntDesign name={item.icon as any} size={120} color="white" style={{ marginBottom: 20 }} />
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.description}>{item.description}</Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: backgroundColor }]}>
      <FlatList
        data={slides}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        pagingEnabled
        bounces={false}
        keyExtractor={(item) => item.id}
        onViewableItemsChanged={viewableItemsChanged}
        viewabilityConfig={viewConfig}
        ref={slidesRef}
      />

      <View style={styles.paginator}>
        {slides.map((_, i) => (
          <View 
            key={i} 
            style={[styles.dot, { opacity: i === currentIndex ? 1 : 0.3 }]} 
          />
        ))}
      </View>

      <TouchableOpacity style={styles.button} onPress={scrollToNext}>
        <Text style={styles.buttonText}>
          {currentIndex === slides.length - 1 ? "¡Comenzar!" : "Siguiente"}
        </Text>
      </TouchableOpacity>

      {currentIndex < slides.length - 1 && (
         <TouchableOpacity style={styles.skipButton} onPress={handleDone}>
           <Text style={styles.skipText}>Saltar</Text>
         </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 10,
  },
  description: {
    fontSize: 16,
    color: 'white',
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  paginator: {
    flexDirection: 'row',
    height: 64,
    position: 'absolute',
    bottom: 100,
  },
  dot: {
    height: 10,
    width: 10,
    borderRadius: 5,
    backgroundColor: 'white',
    marginHorizontal: 8,
  },
  button: {
    position: 'absolute',
    bottom: 50,
    backgroundColor: 'white',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 30,
    elevation: 5,
  },
  buttonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  skipButton: {
    position: 'absolute',
    top: 60,
    right: 30,
  },
  skipText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold', 
    opacity: 0.8
  }
});