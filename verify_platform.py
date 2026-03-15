
import os
import sys
import logging
import json
import requests
from datetime import datetime

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger("Verification")

app_instance = None

def get_app():
    global app_instance
    if app_instance is None:
        from backend.app import create_app
        app_instance = create_app()
    return app_instance

def test_supabase():
    logger.info("Testing Supabase Connection...")
    try:
        app = get_app()
        with app.app_context():
            url = app.config.get('SUPABASE_URL')
            key = app.config.get('SUPABASE_KEY')
            if not url or not key: return False
            headers = {"apikey": key, "Authorization": f"Bearer {key}"}
            response = requests.get(f"{url}/rest/v1/", headers=headers, timeout=5)
            if response.status_code == 200:
                logger.info("Supabase: Connection successful.")
                return True
            return False
    except: return False

def test_gemini():
    logger.info("Testing Gemini API...")
    try:
        import google.generativeai as genai
        app = get_app()
        with app.app_context():
            api_key = app.config.get('GEMINI_API_KEY')
            if not api_key: return False
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel('gemini-pro')
            response = model.generate_content("Hi")
            logger.info("Gemini: Success.")
            return True
    except Exception as e:
        logger.error(f"Gemini: Failed: {e}")
        return False

def test_huggingface():
    logger.info("Testing Hugging Face Embeddings...")
    try:
        app = get_app()
        with app.app_context():
            api_key = app.config.get('HUGGINGFACE_API_KEY')
            if not api_key: return False
            model_id = "sentence-transformers/all-MiniLM-L6-v2"
            api_url = f"https://api-inference.huggingface.co/pipeline/feature-extraction/{model_id}"
            headers = {"Authorization": f"Bearer {api_key}"}
            res = requests.post(api_url, headers=headers, json={"inputs": ["test"]}, timeout=7)
            if res.status_code == 200:
                logger.info("HuggingFace: Success.")
                return True
            else:
                logger.error(f"HuggingFace: Status {res.status_code}")
                return False
    except: return False

def test_openrouter():
    logger.info("Testing OpenRouter API...")
    try:
        app = get_app()
        with app.app_context():
            api_key = app.config.get('OPENROUTER_API_KEY')
            if not api_key: return False
            res = requests.post("https://openrouter.ai/api/v1/chat/completions", 
                              headers={"Authorization": f"Bearer {api_key}"}, 
                              json={"model": "mistralai/mixtral-8x7b-instruct", "messages": [{"role": "user", "content": "Hi"}], "max_tokens": 5})
            if res.status_code == 200:
                logger.info("OpenRouter: Success.")
                return True
            return False
    except: return False

if __name__ == "__main__":
    sys.path.append(os.path.join(os.getcwd(), 'backend'))
    results = {
        "Supabase": test_supabase(),
        "Gemini": test_gemini(),
        "HuggingFace": test_huggingface(),
        "OpenRouter": test_openrouter(),
    }
    print("\nSUMMARY:")
    for s, v in results.items():
        print(f" {s:12}: {'PASSED' if v else 'FAILED'}")
    sys.exit(0 if all(results.values()) else 1)
