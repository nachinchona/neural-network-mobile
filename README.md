# Red neuronal gráfica con React Native y Expo

El proyecto tiene como base el predeterminado de Expo. Consta de dos pantallas: una donde visualizás la cámara para recopilar imágenes dentro de las categorías que quieras, y otra para ajustar parámetros, entrenar el modelo y realizar predicciones.

La aplicación se conecta a un servidor hecho en Python que aloja las imágenes, el modelo de la red neuronal y devuelve los resultados. Esto se hace por dos razones: 1) para evitar que el celular realice las computaciones de la red neuronal (incluso si son relativamente livianas computacionalmente hablando) y 2) porque el paquete Keras de React Native está obsoleto, por lo que la mejor opción resultó desacoplar toda la red hacia un servidor.

## Arranque

Para iniciar la aplicación:

```bash
npx expo start
```

Para iniciar el servidor (dentro de la carpeta server):

```bash
python app.py
```
