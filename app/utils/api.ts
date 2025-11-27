import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_IP = '192.168.0.100:5000'; 

const IP_STORAGE_KEY = 'server_ip_address';

export const getBaseUrl = async () => {
  try {
    const storedIp = await AsyncStorage.getItem(IP_STORAGE_KEY);
    const ip = storedIp || DEFAULT_IP;
    return `http://${ip}`;
  } catch (e) {
    return `http://${DEFAULT_IP}`;
  }
};

export const saveServerIp = async (ip: string) => {
  try {
    await AsyncStorage.setItem(IP_STORAGE_KEY, ip.trim());
    return true;
  } catch (e) {
    return false;
  }
};

export const getStoredIp = async () => {
    return await AsyncStorage.getItem(IP_STORAGE_KEY) || DEFAULT_IP;
};