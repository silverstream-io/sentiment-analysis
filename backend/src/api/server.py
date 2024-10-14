from flask import Flask, request, jsonify, make_response
from flask_cors import CORS
from services.pinecone_service import PineconeService
import dotenv, os
from datetime import datetime
from models.emotions import emotions
import jwt
from jwt.exceptions import InvalidTokenError

dotenv.load_dotenv()
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": ["http://localhost:4567", "https://d3v-silverstream.zendesk.com"]}}, supports_credentials=True)

ZENDESK_SHARED_SECRET = os.getenv('ZENDESK_SHARED_SECRET')

def verify_jwt(token):
    try:
        decoded = jwt.decode(token, ZENDESK_SHARED_SECRET, algorithms=['HS256'])
        return decoded
    except InvalidTokenError:
        return None

@app.route('/api/analyze-comments', methods=['POST'])
def analyze_comments():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Invalid Authorization header'}), 401
    
    token = auth_header.split(' ')[1]
    decoded_token = verify_jwt(token)
    if not decoded_token:
        return jsonify({'error': 'Invalid JWT'}), 401

    subdomain = request.headers.get('X-Zendesk-Subdomain')
    if not subdomain:
        return jsonify({'error': 'Missing Zendesk subdomain'}), 400

    data = request.json
    comments = data.get('comments', {})
    ticket_id = data.get('ticket_id')
    if not comments or not ticket_id:
        return jsonify({'error': 'Missing comments or ticket_id'}), 400

    pinecone_service = PineconeService(subdomain)
    results = []
    
    for comment_id, text in comments.items():
        embedding = pinecone_service.get_embedding(text)
        vector_id = f"{ticket_id}#{comment_id}"
        # Query emotions namespace
        emotion_matches = pinecone_service.query_vectors(embedding, namespace='emotions', top_k=10)
        emotion_sum = 0
        for match in emotion_matches:
            for emotion, is_present in match['metadata'].items():
                if is_present and emotion in emotions:
                    emotion_sum += emotions[emotion].score
        
        # Prepare metadata for upsert
        metadata = {
            'text': text,
            'timestamp': int(datetime.timestamp(datetime.now())),
            'emotion_sum': emotion_sum
        }
        # Upsert vector to Zendesk subdomain namespace
        upsert_response = pinecone_service.upsert_vector(vector_id, embedding, metadata)
        results.append({
            'comment_id': comment_id,
            'upsert_response': upsert_response
        })
    
    return jsonify({'message': 'Comments analyzed and stored successfully', 'results': results}), 200

@app.route('/api/get-ticket-vectors', methods=['POST'])
def get_ticket_vectors():
    """
    Get the vectors of a ticket or tickets.
    """
    api_key = request.headers.get('Authorization')
    if not api_key or not api_key.startswith('Bearer '):
        return jsonify({'error': 'Invalid API key'}), 401

    subdomain = request.headers.get('X-Zendesk-Subdomain')
    if not subdomain:
        return jsonify({'error': 'Missing Zendesk subdomain'}), 400

    data = request.json
    ticket_id = data.get('ticket_id')

    pinecone_service = PineconeService(subdomain)
    vectors = pinecone_service.list_ticket_vectors(ticket_id)

    return jsonify({'vectors': vectors}), 200

@app.route('/api/get-score', methods=['POST'])
def get_score():
    """
    Get the score of a ticket or tickets based on the emotions of the comments.
    """
    api_key = request.headers.get('Authorization')
    if not api_key or not api_key.startswith('Bearer '):
        return jsonify({'error': 'Invalid API key'}), 401
    
    subdomain = request.headers.get('X-Zendesk-Subdomain')
    if not subdomain:
        return jsonify({'error': 'Missing Zendesk subdomain'}), 400

    data = request.json
    ticket_id = data.get('ticket_id')

    pinecone_service = PineconeService(subdomain)
    comments = pinecone_service.list_tickets(ticket_id)
    emotion_score = 0 
    for comment in comments:
        emotion_score += comment['metadata']['emotion_sum']
    emotion_score = emotion_score / len(comments)

    return jsonify({'score': emotion_score}), 200

if __name__ == '__main__':
    app.run(debug=True)
