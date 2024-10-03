from flask import Flask, request, jsonify, redirect
from auth import verify_access_token, create_access_token, get_customer_credentials
import requests
import os

app = Flask(__name__)

ZENDESK_OAUTH_URL = 'https://your-subdomain.zendesk.com/oauth/authorizations/new'
CLIENT_ID = os.getenv('ZENDESK_CLIENT_ID')
CLIENT_SECRET = os.getenv('ZENDESK_CLIENT_SECRET')
REDIRECT_URI = 'https://your-app-domain.com/api/oauth/callback'

@app.route('/api/oauth/initiate', methods=['POST'])
def initiate_oauth():
    installation_id = request.json.get('installation_id')
    if not installation_id:
        return jsonify({'error': 'Installation ID is required'}), 400

    auth_url = f"{ZENDESK_OAUTH_URL}?response_type=code&client_id={CLIENT_ID}&redirect_uri={REDIRECT_URI}&scope=read&state={installation_id}"
    return jsonify({'authorizationUrl': auth_url}), 200

@app.route('/api/oauth/callback')
def oauth_callback():
    code = request.args.get('code')
    state = request.args.get('installation_id')
    
    if not code or not state:
        return 'Error: Missing parameters', 400

    token_url = 'https://your-subdomain.zendesk.com/oauth/tokens'
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
