import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';

export default function StartScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [isFirstLaunch, setIsFirstLaunch] = useState<boolean | null>(null);
  const colorScheme = useColorScheme();
  const backgroundColor = Colors[colorScheme ?? 'light'].background;

  useEffect(() => {
    const checkOnboarding = async () => {
      try {     
        await AsyncStorage.removeItem('hasOnboarded'); // descomentar después
        const hasOnboarded = await AsyncStorage.getItem('hasOnboarded');
        
        if (hasOnboarded === 'true') {
          setIsFirstLaunch(false);
        } else {
          setIsFirstLaunch(true);
        }
      } catch (e) {
        console.error(e);
        setIsFirstLaunch(true);
      } finally {
        setIsLoading(false);
      }
    };
    checkOnboarding();
  }, []);

  if (isLoading) {
    return (
      <ThemedView style={{ 
          flex: 1, 
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: backgroundColor }}>
        <ActivityIndicator size="large" />
      </ThemedView>
    );
  }

  if (isFirstLaunch) {
    return <Redirect href={"/onboarding" as any} />;
  } else {
    return <Redirect href="/CameraScreen" />;
  }
}