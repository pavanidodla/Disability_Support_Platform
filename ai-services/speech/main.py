"""
AccessAI - Speech Recognition & Text-to-Speech Service
Voice commands and text-to-speech for accessibility
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
import io
import os
from datetime import datetime
import tempfile
import wave
import json

app = Flask(__name__)
CORS(app)

# Try to import speech recognition libraries
try:
    import speech_recognition as sr
    SPEECH_RECOGNITION_AVAILABLE = True
except ImportError:
    SPEECH_RECOGNITION_AVAILABLE = False
    print("⚠ speech_recognition not installed. Install with: pip install SpeechRecognition")

try:
    import pyttsx3
    PYTTSX3_AVAILABLE = True
except ImportError:
    PYTTSX3_AVAILABLE = False
    print("⚠ pyttsx3 not installed. Install with: pip install pyttsx3")

try:
    from gtts import gTTS
    GTTS_AVAILABLE = True
except ImportError:
    GTTS_AVAILABLE = False
    print("⚠ gTTS not installed. Install with: pip install gTTS")

# Initialize text-to-speech engine
tts_engine = None
if PYTTSX3_AVAILABLE:
    try:
        tts_engine = pyttsx3.init()
        tts_engine.setProperty('rate', 150)
        tts_engine.setProperty('volume', 0.9)
    except Exception as e:
        print(f"Error initializing TTS engine: {e}")

def recognize_speech_from_audio(audio_data, language='en-US'):
    """Recognize speech from audio data"""
    if not SPEECH_RECOGNITION_AVAILABLE:
        return {
            'text': '',
            'error': 'Speech recognition not available',
            'confidence': 0
        }
    
    recognizer = sr.Recognizer()
    
    try:
        # Convert audio data to AudioData object
        audio = sr.AudioData(audio_data, 16000, 2)
        
        # Try Google Web Speech API (free)
        text = recognizer.recognize_google(audio, language=language)
        
        return {
            'text': text,
            'confidence': 0.85,
            'language': language
        }
    except sr.UnknownValueError:
        return {
            'text': '',
            'error': 'Could not understand audio',
            'confidence': 0
        }
    except sr.RequestError as e:
        return {
            'text': '',
            'error': f'Speech recognition service error: {str(e)}',
            'confidence': 0
        }

def text_to_speech_pyttsx3(text, output_path):
    """Convert text to speech using pyttsx3"""
    if not PYTTSX3_AVAILABLE or not tts_engine:
        return None
    
    try:
        tts_engine.save_to_file(text, output_path)
        tts_engine.runAndWait()
        return output_path
    except Exception as e:
        print(f"Error in TTS: {e}")
        return None

def text_to_speech_gtts(text, output_path, language='en'):
    """Convert text to speech using gTTS"""
    if not GTTS_AVAILABLE:
        return None
    
    try:
        tts = gTTS(text=text, lang=language, slow=False)
        tts.save(output_path)
        return output_path
    except Exception as e:
        print(f"Error in gTTS: {e}")
        return None

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'speech',
        'speech_recognition_available': SPEECH_RECOGNITION_AVAILABLE,
        'pyttsx3_available': PYTTSX3_AVAILABLE,
        'gtts_available': GTTS_AVAILABLE,
        'timestamp': datetime.now().isoformat()
    })

@app.route('/recognize-speech', methods=['POST'])
def recognize_speech():
    """Recognize speech from uploaded audio file"""
    try:
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
        
        file = request.files['audio']
        audio_bytes = file.read()
        
        language = request.form.get('language', 'en-US')
        
        # Recognize speech
        result = recognize_speech_from_audio(audio_bytes, language)
        
        return jsonify({
            'success': True,
            **result,
            'timestamp': datetime.now().isoformat()
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/recognize-speech-base64', methods=['POST'])
def recognize_speech_base64():
    """Recognize speech from base64 encoded audio"""
    try:
        data = request.get_json()
        if 'audio' not in data:
            return jsonify({'error': 'No audio data provided'}), 400
        
        audio_data = data['audio']
        if ',' in audio_data:
            audio_data = audio_data.split(',')[1]
        
        audio_bytes = base64.b64decode(audio_data)
        language = data.get('language', 'en-US')
        
        # Recognize speech
        result = recognize_speech_from_audio(audio_bytes, language)
        
        return jsonify({
            'success': True,
            **result,
            'timestamp': datetime.now().isoformat()
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/text-to-speech', methods=['POST'])
def text_to_speech():
    """Convert text to speech"""
    try:
        data = request.get_json()
        if 'text' not in data:
            return jsonify({'error': 'No text provided'}), 400
        
        text = data['text']
        engine = data.get('engine', 'pyttsx3')
        language = data.get('language', 'en')
        
        # Create temporary file for audio output
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
            output_path = tmp.name
        
        # Generate speech
        result_path = None
        if engine == 'pyttsx3':
            result_path = text_to_speech_pyttsx3(text, output_path)
        elif engine == 'gtts':
            result_path = text_to_speech_gtts(text, output_path, language)
        else:
            # Try pyttsx3 first, then gTTS
            result_path = text_to_speech_pyttsx3(text, output_path)
            if not result_path:
                result_path = text_to_speech_gtts(text, output_path, language)
        
        if result_path and os.path.exists(result_path):
            # Read audio file and convert to base64
            with open(result_path, 'rb') as f:
                audio_bytes = f.read()
            audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
            
            # Clean up
            os.unlink(result_path)
            
            return jsonify({
                'success': True,
                'audio': audio_base64,
                'text': text,
                'engine': engine,
                'timestamp': datetime.now().isoformat()
            })
        else:
            return jsonify({'error': 'Failed to generate speech'}), 500
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/voice-command', methods=['POST'])
def voice_command():
    """Process voice command and return action"""
    try:
        data = request.get_json()
        if 'command' not in data:
            return jsonify({'error': 'No command provided'}), 400
        
        command = data['command'].lower()
        
        # Simple command parsing
        actions = {
            'open': 'navigate',
            'close': 'close',
            'click': 'click',
            'scroll up': 'scroll_up',
            'scroll down': 'scroll_down',
            'zoom in': 'zoom_in',
            'zoom out': 'zoom_out',
            'read': 'read_text',
            'stop': 'stop',
            'help': 'help',
            'settings': 'settings'
        }
        
        action = None
        for keyword, act in actions.items():
            if keyword in command:
                action = act
                break
        
        if action:
            return jsonify({
                'success': True,
                'command': command,
                'action': action,
                'timestamp': datetime.now().isoformat()
            })
        else:
            return jsonify({
                'success': False,
                'command': command,
                'error': 'Unknown command',
                'available_commands': list(actions.keys()),
                'timestamp': datetime.now().isoformat()
            })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/languages', methods=['GET'])
def get_languages():
    """Get supported languages"""
    languages = {
        'en-US': 'English (US)',
        'en-GB': 'English (UK)',
        'es-ES': 'Spanish',
        'fr-FR': 'French',
        'de-DE': 'German',
        'it-IT': 'Italian',
        'pt-BR': 'Portuguese (Brazil)',
        'ja-JP': 'Japanese',
        'ko-KR': 'Korean',
        'zh-CN': 'Chinese (Simplified)',
        'hi-IN': 'Hindi',
        'ar-SA': 'Arabic'
    }
    
    return jsonify({
        'success': True,
        'languages': languages,
        'timestamp': datetime.now().isoformat()
    })

if __name__ == '__main__':
    print("AccessAI Speech Recognition & TTS Service")
    print("=" * 40)
    print(f"Speech Recognition: {'✓' if SPEECH_RECOGNITION_AVAILABLE else '✗'}")
    print(f"pyttsx3 TTS: {'✓' if PYTTSX3_AVAILABLE else '✗'}")
    print(f"gTTS: {'✓' if GTTS_AVAILABLE else '✗'}")
    print("Starting server on port 5005...")
    app.run(host='0.0.0.0', port=5005, debug=True)