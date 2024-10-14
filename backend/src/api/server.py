from flask import Flask, request, jsonify, redirect, make_response
from flask_cors import CORS
from .auth import verify_access_token, create_access_token, get_customer_credentials
from ..services.pinecone_service import PineconeService
import requests
import dotenv, os

dotenv.load_dotenv()
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": ["http://localhost:4567", "https://d3v-silverstream.zendesk.com"]}}, supports_credentials=True)

ZENDESK_SUBDOMAIN = os.getenv('ZENDESK_SUBDOMAIN')
ZENDESK_OAUTH_URL = f'https://{ZENDESK_SUBDOMAIN}.zendesk.com/oauth/authorizations/new'
CLIENT_ID = os.getenv('ZENDESK_CLIENT_ID')
CLIENT_SECRET = os.getenv('ZENDESK_CLIENT_SECRET')
REDIRECT_URI = f'https://{ZENDESK_SUBDOMAIN}.zendesk.com/api/oauth/callback'

@app.route('/api/oauth/initiate', methods=['POST', 'OPTIONS'])
def initiate_oauth():
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:4567')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST')
        return response

    app_id = request.json.get('app_id')
    subdomain = request.json.get('subdomain')
    if not app_id or not subdomain:
        return jsonify({'error': 'App ID and subdomain are required'}), 400
    auth_url = f"https://{subdomain}.zendesk.com/oauth/authorizations/new?response_type=code&" \
               f"client_id={CLIENT_ID}&" \
               f"redirect_uri={REDIRECT_URI}&" \
               f"scope=read&" \
               f"state={app_id}"
    response = jsonify({'authorizationUrl': auth_url})
    response.headers.add('Access-Control-Allow-Origin', 'http://localhost:4567')
    return response, 200

@app.route('/api/oauth/callback')
def oauth_callback():
    code = request.args.get('code')
    state = request.args.get('installation_id')
    
    if not code or not state:
        return 'Error: Missing parameters', 400

    token_url = f'https://{ZENDESK_SUBDOMAIN}.zendesk.com/oauth/tokens'
    data = {
        'grant_type': 'authorization_code',
        'code': code,
        'client_id': CLIENT_ID,
        'client_secret': CLIENT_SECRET,
        'redirect_uri': REDIRECT_URI,
    }
    
    response = requests.post(token_url, data=data)
    if response.status_code != 200:
        return 'Error: Failed to obtain access token', 500

    access_token = response.json()['access_token']
    create_access_token(state, access_token)
    
    return 'Authentication successful. You can close this window.'

@app.route('/api/credentials', methods=['GET'])
def get_credentials():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Invalid authorization header'}), 401

    token = auth_header.split(' ')[1]
    customer_id = verify_access_token(token)
    if not customer_id:
        return jsonify({'error': 'Invalid or expired token'}), 401

    credentials = get_customer_credentials(customer_id)
    return jsonify(credentials), 200

@app.route('/api/analyze_comments', methods=['POST'])
def analyze_comments():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Invalid authorization header'}), 401
    token = auth_header.split(' ')[1]
    customer_id = verify_access_token(token)
    if not customer_id:
        return jsonify({'error': 'Invalid or expired token'}), 401
    data = request.json
    comments = data.get('comments', {})
    ticket_id = data.get('ticket_id')
    if not comments or not ticket_id:
        return jsonify({'error': 'Missing comments or ticket_id'}), 400
    pinecone_service = PineconeService(os.getenv('ZENDESK_SUBDOMAIN'))
    results = []
    for comment_id, text in comments.items():
        embedding = pinecone_service.get_embedding(text)
        vector_id = f"{ticket_id}#{comment_id}"
        # Query emotions namespace
        emotion_matches = pinecone_service.query_vectors(embedding, namespace='emotions')
        emotion_metadata = {
            match['id']: match['metadata']
            for match in emotion_matches
            if 'emotion' in match['metadata']
        }
        # Prepare metadata for upsert
        metadata = {
            'text': text,
            'emotions': emotion_metadata
        }
        # Upsert vector to Zendesk subdomain namespace
        upsert_response = pinecone_service.upsert_vector(vector_id, embedding, metadata)
        results.append({
            'comment_id': comment_id,
            'emotions': emotion_metadata,
            'upsert_response': upsert_response
        })
    return jsonify({'message': 'Comments analyzed and stored successfully', 'results': results}), 200

if __name__ == '__main__':
    app.run(debug=True)
