from flask import Flask, request, jsonify, redirect, make_response
from flask_cors import CORS
from .auth import verify_access_token, create_access_token, get_customer_credentials
import requests
import dotenv, os

dotenv.load_dotenv()
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": ["http://localhost:4567", "https://d3v-silverstream.zendesk.com"]}}, supports_credentials=True)

if os.getenv('ZENDESK_SUBDOMAIN') is None:
    ZENDESK_SUBDOMAIN = 'd3v-silverstream'
else:
    ZENDESK_SUBDOMAIN = os.getenv('ZENDESK_SUBDOMAIN')
ZENDESK_OAUTH_URL = f'https://{ZENDESK_SUBDOMAIN}.zendesk.com/oauth/authorizations/new'
CLIENT_ID = os.getenv('ZENDESK_CLIENT_ID')
CLIENT_SECRET = os.getenv('ZENDESK_CLIENT_SECRET')
REDIRECT_URI = f'https://{ZENDESK_SUBDOMAIN}.zendesk.com/api/oauth/callback'

@app.route('/api/oauth/initiate', methods=['OPTIONS'])
def handle_preflight():
    response = jsonify({'message': 'OK'})
    response.headers.add('Access-Control-Allow-Origin', 'http://localhost:4567')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
    response.headers.add('Access-Control-Allow-Methods', 'POST')
    return response

@app.route('/api/oauth/initiate', methods=['POST', 'OPTIONS'])
def initiate_oauth():
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:4567')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST')
        return response
    app_id = request.json.get('app_id')
    if not app_id:
        return jsonify({'error': 'App ID is required'}), 400
    auth_url = f"{ZENDESK_OAUTH_URL}?response_type=code&" \
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

if __name__ == '__main__':
    app.run(debug=True)
