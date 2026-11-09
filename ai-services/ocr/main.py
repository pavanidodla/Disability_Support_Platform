"""
AccessAI - OCR Service
Document and label reading using Tesseract OCR
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import base64
import pytesseract
from PIL import Image
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)

def preprocess_image(image):
    """Preprocess image for better OCR results"""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    denoised = cv2.fastNlMeansDenoising(thresh, None, 10, 7, 21)
    return denoised

def extract_text_from_image(image):
    """Extract text from image using Tesseract OCR"""
    try:
        processed = preprocess_image(image)
        pil_image = Image.fromarray(processed)
        text = pytesseract.image_to_string(pil_image)
        data = pytesseract.image_to_data(pil_image, output_type=pytesseract.Output.DICT)
        
        confidences = [int(c) for c in data['conf'] if int(c) > 0]
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0
        
        return {
            'text': text.strip(),
            'confidence': avg_confidence / 100,
            'word_count': len(text.split()),
            'lines': text.strip().split('\n')
        }
    except Exception as e:
        return {
            'text': '',
            'confidence': 0,
            'word_count': 0,
            'lines': [],
            'error': str(e)
        }

def read_label(image):
    """Read and interpret product labels"""
    result = extract_text_from_image(image)
    
    label_info = {
        'raw_text': result['text'],
        'lines': result['lines'],
        'confidence': result['confidence'],
        'ingredients': [],
        'nutrition_facts': {},
        'warnings': []
    }
    
    text_lower = result['text'].lower()
    
    if 'ingredients' in text_lower:
        idx = text_lower.index('ingredients')
        ingredients_text = result['text'][idx:idx+500]
        label_info['ingredients'] = ingredients_text.split('\n')
    
    if 'nutrition' in text_lower or 'calories' in text_lower:
        label_info['nutrition_facts']['available'] = True
    
    warning_keywords = ['warning', 'caution', 'allergen', 'contains']
    for keyword in warning_keywords:
        if keyword in text_lower:
            idx = text_lower.index(keyword)
            label_info['warnings'].append(result['text'][idx:idx+200].split('\n')[0])
    
    return label_info

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'service': 'ocr',
        'tesseract_available': True,
        'timestamp': datetime.now().isoformat()
    })

@app.route('/extract-text', methods=['POST'])
def extract_text():
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image provided'}), 400
        
        file = request.files['image']
        nparr = np.frombuffer(file.read(), np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
            return jsonify({'error': 'Invalid image format'}), 400
        
        result = extract_text_from_image(image)
        
        return jsonify({
            'success': True,
            **result,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/extract-text-base64', methods=['POST'])
def extract_text_base64():
    try:
        data = request.get_json()
        if 'image' not in data:
            return jsonify({'error': 'No image data provided'}), 400
        
        image_data = data['image']
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        
        nparr = np.frombuffer(base64.b64decode(image_data), np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
            return jsonify({'error': 'Invalid image data'}), 400
        
        result = extract_text_from_image(image)
        
        return jsonify({
            'success': True,
            **result,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/read-label', methods=['POST'])
def read_label_endpoint():
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image provided'}), 400
        
        file = request.files['image']
        nparr = np.frombuffer(file.read(), np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
            return jsonify({'error': 'Invalid image format'}), 400
        
        label_info = read_label(image)
        
        return jsonify({
            'success': True,
            'label_info': label_info,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/read-label-base64', methods=['POST'])
def read_label_base64():
    try:
        data = request.get_json()
        if 'image' not in data:
            return jsonify({'error': 'No image data provided'}), 400
        
        image_data = data['image']
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        
        nparr = np.frombuffer(base64.b64decode(image_data), np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
            return jsonify({'error': 'Invalid image data'}), 400
        
        label_info = read_label(image)
        
        return jsonify({
            'success': True,
            'label_info': label_info,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/read-document', methods=['POST'])
def read_document():
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image provided'}), 400
        
        file = request.files['image']
        nparr = np.frombuffer(file.read(), np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
            return jsonify({'error': 'Invalid image format'}), 400
        
        result = extract_text_from_image(image)
        read_aloud_text = ' '.join(result['lines'])
        
        return jsonify({
            'success': True,
            'text': result['text'],
            'read_aloud': read_aloud_text,
            'confidence': result['confidence'],
            'word_count': result['word_count'],
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("AccessAI OCR Service")
    print("=" * 40)
    print("Starting server on port 5002...")
    app.run(host='0.0.0.0', port=5002, debug=True)