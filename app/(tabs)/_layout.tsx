import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

import AntDesign from '@expo/vector-icons/AntDesign';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const backgroundColor = Colors[colorScheme ?? 'light'].background;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#d3d2d2ff',
        headerShown: false,
        tabBarButton: HapticTab,
        sceneStyle: { backgroundColor: backgroundColor }
      }}>
      <Tabs.Screen
        name="CameraScreen"
        options={{
          title: 'Cámara',
          tabBarIcon: ({ color }) => <AntDesign size={28} name="camera" color={color} />,
        }}
      />
      <Tabs.Screen
        name="NeuralNetworkScreen"
        options={{
          title: 'Red neuronal',
          tabBarIcon: ({ color }) => <AntDesign size={28} name="node-index" color={color} />,
        }}
      />
    </Tabs>
  );
}
