from flask import Flask, request, jsonify
import tensorflow as tf
from tensorflow.keras.layers import (
    GlobalAveragePooling2D, Dense, Input, 
    RandomFlip, RandomRotation, RandomZoom
)
from tensorflow.keras.models import Model
import numpy as np
from PIL import Image
import os
import io
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input
from tensorflow.keras.preprocessing import image_dataset_from_directory

IMG_SIZE = 224
BATCH_SIZE = 32
NUM_EPOCHS = 10

model = MobileNetV2(
    weights='imagenet',
    include_top=False,
    input_shape=(IMG_SIZE, IMG_SIZE, 3),
    name="mobilenetv2_base"
)

app = Flask(__name__)

# carpeta para guardar las imágenes de entrenamiento
UPLOAD_FOLDER = 'dataset'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

MODEL_PATH = 'modelo.keras'

@app.route('/predict', methods=['POST'])
def predict():
    if model is None:
        return jsonify({'error': 'Modelo no entrenado'}), 400
    
    file = request.files['image']
    image = Image.open(io.BytesIO(file.read()))

    image = image.resize((IMG_SIZE, IMG_SIZE))
    image_array = np.array(image) / 255.0
    image_array = np.expand_dims(image_array, axis=0)

    prediction = model.predict(image_array)

    predicted_class = int(np.argmax(prediction[0]))
    return jsonify({'clase_predicha': predicted_class})

@app.route('/upload', methods=['POST'])
def upload():
    file = request.files['image']
    label = request.form['label']
    
    label_folder = os.path.join(UPLOAD_FOLDER, label)
    if not os.path.exists(label_folder):
        os.makedirs(label_folder)
        
    file_path = os.path.join(label_folder, file.filename)
    file.save(file_path)

    return jsonify({'status': 'imagen recibida', 'path': file_path})

@app.route('/train', methods=['POST'])
def train():
    print(f"Iniciando entrenamiento desde: {UPLOAD_FOLDER}")

    # 80% para entrenar
    train_dataset = image_dataset_from_directory(
        UPLOAD_FOLDER,
        validation_split=0.2, # 20% para validar
        subset="training",
        seed=123,
        image_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE
    )
    
    # 20% para validar
    validation_dataset = image_dataset_from_directory(
        UPLOAD_FOLDER,
        validation_split=0.2,
        subset="validation",
        seed=123,
        image_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE
    )
    
    class_names = train_dataset.class_names
    num_classes = len(class_names)
    print(f"Clases encontradas: {class_names}")

    data_augmentation = tf.keras.Sequential([
        RandomFlip("horizontal"),
        RandomRotation(0.2),
        RandomZoom(0.2),
    ], name="data_augmentation")

    base_model = MobileNetV2(
        input_shape=IMG_SIZE + (3,),
        include_top=False,
        weights='imagenet'
    )
    
    base_model.trainable = False

    inputs = Input(shape=IMG_SIZE + (3,))
    x = data_augmentation(inputs)
    x = preprocess_input(x) 
    x = base_model(x, training=False)
    x = GlobalAveragePooling2D()(x)
    predictions = Dense(num_classes, activation='softmax')(x)

    model = Model(inputs=inputs, outputs=predictions)
    
    model.compile(
        optimizer='adam',
        loss='sparse_categorical_crossentropy',
        metrics=['accuracy']
    )
    
    print("Modelo compilado. Iniciando entrenamiento...")
    
    model.fit(
        train_dataset,
        validation_data=validation_dataset,
        epochs=NUM_EPOCHS
    )
    
    model.save(MODEL_PATH)
    print(f"¡Entrenamiento completo! Modelo guardado en: {MODEL_PATH}")

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)