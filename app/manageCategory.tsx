import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface ImageFile {
    filename: string;
    url: string;
}

const SERVER_IP = '192.168.0.89:5000';

export default function ManageCategoryScreen() {
    const { label } = useLocalSearchParams<{ label: string }>();

    // estados
    const [images, setImages] = useState<ImageFile[]>([]);
    const [selectedImages, setSelectedImages] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // obtener imágenes
    const fetchImages = useCallback(async () => {
        if (!label) return;
        setLoading(true);
        try {
            const response = await fetch(`http://${SERVER_IP}/get-images/${label}`);
            const data = await response.json();

            const imageList: ImageFile[] = data.files.map((filename: string) => ({
                filename: filename,
                url: `http://${SERVER_IP}/dataset/${label}/${filename}`
            }));
            setImages(imageList);
        } catch (error) {
            console.error("Error fetching images:", error);
            Alert.alert("Error", "No se pudieron cargar las imágenes.");
        } finally {
            setLoading(false);
        }
    }, [label]);

    useEffect(() => {
        fetchImages();
    }, [fetchImages]);

    // función de selección
    const toggleSelect = (filename: string) => {
        setSelectedImages(prev => {
            if (prev.includes(filename)) {
                return prev.filter(f => f !== filename);
            } else {
                return [...prev, filename];
            }
        });
    };

    // función de borrado
    const handleDelete = async () => {
        if (selectedImages.length === 0) return;

        Alert.alert(
            "Confirmar Eliminación",
            `¿Estás seguro de que querés eliminar ${selectedImages.length} imágenes de ${label}?`,
            [
                { text: "Cancelar", style: "cancel" },
                { text: "Eliminar", style: "destructive", onPress: confirmDelete }
            ]
        );
    };

    const confirmDelete = async () => {
        setIsDeleting(true);
        try {
            const response = await fetch(`http://${SERVER_IP}/delete-images`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    label: label,
                    filenames: selectedImages
                }),
            });

            if (response.ok) {
                Alert.alert("Éxito", `${selectedImages.length} imágenes eliminadas.`);
                // limpiar selección y recargar datos
                setSelectedImages([]);
                fetchImages();
            } else {
                Alert.alert("Error", "Fallo al eliminar en el servidor.");
            }
        } catch (error) {
            console.error("Error during deletion:", error);
            Alert.alert("Error", "No se pudo conectar con el servidor.");
        } finally {
            setIsDeleting(false);
        }
    };

    // para la selección visual
    const renderItem = ({ item }: { item: ImageFile }) => {
        const isSelected = selectedImages.includes(item.filename);
        return (
            <TouchableOpacity
                style={[styles.imageContainer, isSelected && styles.selectedImageContainer]}
                onPress={() => toggleSelect(item.filename)}
            >
                <Image
                    source={{ uri: item.url }}
                    style={styles.image}
                />
                {isSelected && (
                    <View style={styles.checkmarkOverlay}>
                        <Text style={styles.checkmark}>x</Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    const colorScheme = useColorScheme();
    const backgroundColor = Colors[colorScheme ?? 'light'].background;

    return (
        <View style={{flex: 1, backgroundColor: backgroundColor}}>
            <Stack.Screen options={{
                title: `${label}`,
                headerRight: () => (
                    <TouchableOpacity
                        onPress={handleDelete}
                        disabled={selectedImages.length === 0 || isDeleting}
                        style={[styles.deleteButton, selectedImages.length === 0 && styles.disabledButton]}
                    >
                        <Text style={styles.deleteButtonText}>
                            {isDeleting ? "Eliminando..." : `Eliminar (${selectedImages.length})`}
                        </Text>
                    </TouchableOpacity>
                )
            }} />

            {loading ? (
                <ActivityIndicator size="large" color="#0000ff" style={{ marginTop: 50 }} />
            ) : images.length === 0 ? (
                <Text style={styles.emptyText}>No hay imágenes en esta categoría.</Text>
            ) : (
                <FlatList
                    data={images}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.filename}
                    numColumns={3}
                    refreshControl={
                        <RefreshControl refreshing={loading} onRefresh={fetchImages} />
                    }
                    contentContainerStyle={{ padding: 10 }}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    imageContainer: {
        flex: 1 / 3,
        aspectRatio: 1,
        margin: 3,
        borderWidth: 2,
        borderColor: 'transparent',
        borderRadius: 8,
        overflow: 'hidden',
    },
    selectedImageContainer: {
        borderColor: '#291474ff',
    },
    image: { width: '100%', height: '100%' },
    checkmarkOverlay: {
        position: 'absolute',
        top: 0,
        right: 0,
        backgroundColor: '#2e19ccff',
        padding: 5,
        borderRadius: 0,
        borderBottomLeftRadius: 8,
    },
    checkmark: {
        color: 'white',
        fontWeight: 'bold',
    },
    deleteButton: {
        backgroundColor: '#9e0020ff',
        padding: 8,
        borderRadius: 5,
        marginRight: 10,
    },
    deleteButtonText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
    disabledButton: { opacity: 0.5 },
    emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: '#666' }
});