import os
import uuid
import shutil
from flask import Flask, request, jsonify, send_file, send_from_directory
from werkzeug.utils import secure_filename
from tensorflow.keras.layers import GlobalAveragePooling2D, Input, Dense
import io
import numpy as np
from PIL import Image
from tensorflow.keras.models import Model, Sequential, load_model
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input
import json
from tensorflow.keras.utils import to_categorical
from sklearn.preprocessing import LabelEncoder
from datetime import datetime

app = Flask(__name__)

# configurables
UPLOAD_FOLDER = 'dataset'
MODEL_PATH = 'feature_extractor.keras'
LABELS_PATH = 'labels.json'
IMG_SIZE = (224, 224)
BATCH_SIZE = 32
NUM_EPOCHS = 10

# limpia todo antes de iniciar
if os.path.exists(UPLOAD_FOLDER):
    shutil.rmtree(UPLOAD_FOLDER)
if os.path.exists(MODEL_PATH):
    os.remove(MODEL_PATH)
os.makedirs(UPLOAD_FOLDER)

# las formas (3,) y demas indican tuplas de un solo elemento

# construye el modelo
def get_model():
    if os.path.exists(MODEL_PATH):
        return load_model(MODEL_PATH)
    
    base_model = MobileNetV2(
        input_shape=IMG_SIZE + (3,),
        include_top=False,
        weights='imagenet'
    )
    base_model.trainable = False
    
    inputs = Input(shape=IMG_SIZE + (3,))
    x = base_model(inputs, training=False)
    outputs = GlobalAveragePooling2D()(x)
    
    model = Model(inputs=inputs, outputs=outputs)
    model.save(MODEL_PATH)
    return model

# construye el modelo
model = get_model()
print("Extractor de características (MobileNetV2) cargado.")

# preprocesamiento de imagen
def process_image(file_storage):
    image = Image.open(io.BytesIO(file_storage.read()))
    image = image.resize(IMG_SIZE)
    image_array = np.array(image)
    
    # para imágenes en escala de grises y transparentes (sino se cuelga el server)
    if image_array.ndim == 2:
        image_array = np.stack((image_array,)*3, axis=-1)
    elif image_array.shape[2] == 4:
        image_array = image_array[:,:,:3]
    
    # función preprocess de MobileNetV2 y 
    image_array_processed = preprocess_input(image_array)
    # pone la imagen en una "caja" (se esperan lotes de imágenes pero en realidad solo es una)
    image_array_expanded = np.expand_dims(image_array_processed, axis=0)
    return image_array_expanded

# toma la imagen de la petición y la guarda en UPLOAD_FOLDER
@app.route('/upload', methods=['POST'])
def upload():
    if 'image' not in request.files or 'label' not in request.form:
        return jsonify({'error': 'Faltan datos (image o label)'}), 400

    file = request.files['image']
    label = request.form['label']
    
    # hace la carpeta etiquetada si no existe
    label_folder = os.path.join(UPLOAD_FOLDER, label)
    if not os.path.exists(label_folder):
        os.makedirs(label_folder)
        
    # nombres únicos
    safe_basename = secure_filename(file.filename)
    _, extension = os.path.splitext(safe_basename)
    unique_filename = f"{uuid.uuid4().hex}{extension}"
    
    file_path = os.path.join(label_folder, unique_filename)
    file.save(file_path)

    return jsonify({'status': 'imagen recibida', 'path': file_path})

@app.route('/train', methods=['POST'])
def train():
    data = request.get_json()

    # parámetros enviados por el usuario
    learning_rate = float(data.get('learning_rate', 0.001))
    epochs = int(data.get('epochs', 10))
    
    print(f"Iniciando entrenamiento con LR={learning_rate}, Epochs={epochs}")
    
    X_train = []
    y_train_labels = []
    
    if not os.path.exists(UPLOAD_FOLDER) or not os.listdir(UPLOAD_FOLDER):
         return jsonify({'error': 'No hay imágenes para entrenar'}), 400

    # procesa cada clase/etiqueta
    for label in os.listdir(UPLOAD_FOLDER):
        label_dir = os.path.join(UPLOAD_FOLDER, label)
        if not os.path.isdir(label_dir): continue
        print(f"Procesando clase: {label}...")
        
        for image_name in os.listdir(label_dir):
            image_path = os.path.join(label_dir, image_name)
            try:
                with open(image_path, 'rb') as f:
                    image_array = process_image(f)
                    embedding = model.predict(image_array)[0]
                    X_train.append(embedding)
                    y_train_labels.append(label)
            except Exception as e:
                print(f"ADVERTENCIA: Saltando imagen corrupta {image_path}: {e}")

    if not X_train:
         return jsonify({'error': 'No se pudieron procesar imágenes válidas'}), 500
         
    X_train_np = np.array(X_train)
    
    le = LabelEncoder()
    # pasa de strings a números
    y_train_integers = le.fit_transform(y_train_labels)
    num_classes = len(le.classes_)

    # se convierten porque la salida es softmax, para poder compararlos
    y_train_np_one_hot = to_categorical(y_train_integers, num_classes=num_classes)

    # agregamos una sola capa al modelo con shapes de 1280 (producidas por MobileNetV2)
    model_head = Sequential([
        Dense(num_classes, activation='softmax', input_shape=(1280,))
    ])
    
    optimizer = Adam(learning_rate=learning_rate)
    
    model_head.compile(
        optimizer=optimizer,
        loss='categorical_crossentropy', 
        metrics=['accuracy']
    )
    
    model_head.fit(
        X_train_np, 
        y_train_np_one_hot, 
        epochs=epochs,
        batch_size=min(32, len(X_train_np)),
        shuffle=True
    )
    
    model_head.save(MODEL_PATH)
    with open(LABELS_PATH, 'w') as f:
        json.dump(le.classes_.tolist(), f)
    
    print(f"¡Entrenamiento completo! Clases: {le.classes_}")
    return jsonify({
        'status': '¡Modelo entrenado!', 
        'classes': le.classes_.tolist()
    })

@app.route('/predict', methods=['POST'])
def predict():
    try:
        model_head = load_model(MODEL_PATH)
        with open(LABELS_PATH, 'r') as f:
            labels = json.load(f)
    except IOError:
        return jsonify({'error': 'Modelo no entrenado. Sube imágenes primero.'}), 400

    if 'image' not in request.files:
        return jsonify({'error': 'No se encontró la imagen'}), 400

    try:
        # procesa la imagen de la petición
        image_array = process_image(request.files['image'])
        # toma la predicción del modelo base de MobileNetV2
        embedding = model.predict(image_array) 
        # envía el único resultado de la caja al modelo monocapa
        probabilities_sparse = model_head.predict(embedding)[0]

        # mapea las probabilidades para el mapa SVG
        probabilities_map = {}
        for i, label in enumerate(labels):
            probabilities_map[label] = float(probabilities_sparse[i])
        
        predicted_class_label = labels[np.argmax(probabilities_sparse)]

        return jsonify({
            'probabilities_map': probabilities_map,
            'predicted_class_label': predicted_class_label
        })
        
    except Exception as e:
        print(f"Error durante la predicción: {e}")
        return jsonify({'error': f'Error interno del servidor: {e}'}), 500

@app.route('/download-dataset', methods=['GET'])
def download_dataset():
    try:
        if not os.path.exists(UPLOAD_FOLDER):
             return jsonify({'error': 'No existe el dataset'}), 404

        currentTime = datetime.now().strftime("%Y%m%d_%H%M%S")
        name = f'dataset_{currentTime}'
        path = name+'.zip'
        shutil.make_archive(name, 'zip', UPLOAD_FOLDER)
        
        return send_file(path, as_attachment=True)

    except Exception as e:
        print(f"Error al comprimir: {e}")
        if os.path.exists(path):
            os.remove(path)
        return jsonify({'error': str(e)}), 500

@app.route('/download-model', methods=['GET'])
def download_model():
    currentTime = datetime.now().strftime("%Y%m%d_%H%M%S")
    NAME = f"model_{currentTime}"
    try:
        if not os.path.exists(MODEL_PATH):
            return jsonify({'error': 'El archivo del modelo no se encuentra en el servidor.'}), 404

        return send_file(
            MODEL_PATH, 
            as_attachment=True, 
            download_name=NAME
        )
        
    except Exception as e:
        print(f"Error al enviar el archivo del modelo: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/get-images/<label>', methods=['GET'])
def get_images(label):
    label_dir = os.path.join(UPLOAD_FOLDER, label)
    
    if not os.path.isdir(label_dir):
        return jsonify({'files': []})
        
    files = [f for f in os.listdir(label_dir) if os.path.isfile(os.path.join(label_dir, f))]
    
    return jsonify({'files': files})

@app.route('/dataset/<label>/<filename>')
def serve_image(label, filename):
    return send_from_directory(os.path.join(UPLOAD_FOLDER, label), filename)

@app.route('/delete-images', methods=['POST'])
def delete_images():
    data = request.get_json()
    label = data.get('label')
    filenames = data.get('filenames', [])
    
    if not label or not filenames:
        return jsonify({'error': 'Faltan parámetros (label o filenames)'}), 400

    deleted_count = 0
    
    for filename in filenames:
        file_path = os.path.join(UPLOAD_FOLDER, label, filename)
        
        if os.path.exists(file_path) and filename.endswith('.jpg'):
            try:
                os.remove(file_path)
                deleted_count += 1
            except Exception as e:
                print(f"Error al eliminar {file_path}: {e}")
                
    if deleted_count == len(filenames):
        return jsonify({'message': f'{deleted_count} archivos eliminados con éxito.'}), 200
    else:
        return jsonify({'message': f'Solo se pudieron eliminar {deleted_count} de {len(filenames)} archivos.'}), 202

@app.route('/delete-category', methods=['POST'])
def delete_category():
    data = request.get_json()
    label = data.get('label')
    
    if not label:
        return jsonify({'error': 'Falta el parámetro "label" para eliminar la categoría.'}), 400

    category_path = os.path.join(UPLOAD_FOLDER, label)

    if os.path.isdir(category_path):
        try:
            shutil.rmtree(category_path)
            print(f"Directorio eliminado: {category_path}")
            return jsonify({'message': f'Categoría "{label}" y su contenido eliminados con éxito.'}), 200
            
        except OSError as e:
            print(f"Error al eliminar el directorio {category_path}: {e}")
            return jsonify({'error': f'Error del sistema al eliminar la carpeta: {e}'}), 500
    else:
        return jsonify({'message': f'Categoría "{label}" y su contenido eliminados con éxito.'}), 200

@app.route('/rename-category', methods=['POST'])
def rename_category():
    data = request.get_json()
    old_label = data.get('old_label')
    new_label = data.get('new_label')

    if not old_label or not new_label:
        return jsonify({'error': 'Faltan los parámetros old_label o new_label.'}), 400

    old_path = os.path.join(UPLOAD_FOLDER, old_label)
    new_path = os.path.join(UPLOAD_FOLDER, new_label)

    if not os.path.isdir(old_path):
        return jsonify({'error': f'La categoría "{old_label}" no existe en el servidor.'}), 404
        
    if os.path.isdir(new_path):
        return jsonify({'error': f'El nuevo nombre "{new_label}" ya está en uso.'}), 409 # Conflict

    try:
        os.rename(old_path, new_path)
        print(f"Carpeta renombrada de '{old_label}' a '{new_label}'")
        return jsonify({'message': 'Categoría renombrada con éxito.'}), 200
        
    except OSError as e:
        print(f"Error del sistema al renombrar: {e}")
        return jsonify({'error': f'Error del sistema al renombrar la carpeta: {e}'}), 500

# para devolver cantidad de cada categoría
@app.route('/quantity', methods=['GET'])
def get_quantity():
    quantity = {}
    
    if not os.path.exists(UPLOAD_FOLDER):
        return jsonify({})

    for label in os.listdir(UPLOAD_FOLDER):
        label_path = os.path.join(UPLOAD_FOLDER, label)
        if os.path.isdir(label_path):
            file_count = len([name for name in os.listdir(label_path) if os.path.isfile(os.path.join(label_path, name))])
            quantity[label] = file_count
            
    return jsonify(quantity)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)