from flask import Flask, request, jsonify, make_response
from flask_cors import CORS
from services.pinecone_service import PineconeService
import dotenv, os
from datetime import datetime
from models.emotions import emotions
import jwt
from jwt.exceptions import InvalidTokenError
import logging

# Set up logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

dotenv.load_dotenv()
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": ["http://localhost:4567", "https://d3v-silverstream.zendesk.com"]}}, supports_credentials=True)

ZENDESK_SHARED_SECRET = os.getenv('ZENDESK_SHARED_SECRET')

def verify_jwt(token):
    logger.debug(f"Verifying JWT: {token[:10]}...")  # Log first 10 characters of token
    if not token:
        logger.error("Missing token")
        return 'Missing token'
    try:
        key = os.environ.get('ZENDESK_APP_PUBLIC_KEY')
        audience = os.environ.get('ZENDESK_APP_AUD')
        logger.debug(f"Public key: {key[:10]}...")  # Log first 10 characters of key
        logger.debug(f"Audience: {audience}")
        if not key or not audience:
            logger.error("Missing ZENDESK_APP_PUBLIC_KEY or ZENDESK_APP_AUD in environment variables")
            return 'Missing ZENDESK_APP_PUBLIC_KEY or ZENDESK_APP_AUD in environment variables'
        payload = jwt.decode(token, key, algorithms=['RS256'], audience=audience)
        logger.info("JWT successfully verified")
        return payload
    except jwt.ExpiredSignatureError:
        logger.error("Token has expired")
        return 'Token has expired'
    except jwt.InvalidTokenError as e:
        logger.error(f"Invalid token: {str(e)}")
        return f'Invalid token: {str(e)}'

@app.route('/api/analyze-comments', methods=['POST'])
def analyze_comments():
    logger.info("Received request for analyze_comments")
    token = request.forms.get('token')
    if not token:
        logger.error("Missing token in request")
        return jsonify({'error': 'Missing token'}), 401
    
    verified_token = verify_jwt(token)
    if isinstance(verified_token, str):
        logger.error(f"JWT verification failed: {verified_token}")
        return jsonify({'error': verified_token}), 401

    subdomain = request.headers.get('X-Zendesk-Subdomain')
    if not subdomain:
        logger.error("Missing Zendesk subdomain in request headers")
        return jsonify({'error': 'Missing Zendesk subdomain'}), 400

    data = request.json
    comments = data.get('comments', {})
    ticket_id = data.get('ticket_id')
    if not comments or not ticket_id:
        logger.error("Missing comments or ticket_id in request data")
        return jsonify({'error': 'Missing comments or ticket_id'}), 400

    logger.info(f"Processing comments for ticket: {ticket_id}")
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
    
    logger.info(f"Finished processing comments for ticket: {ticket_id}")
    return jsonify({'message': 'Comments analyzed and stored successfully', 'results': results}), 200

@app.route('/api/get-ticket-vectors', methods=['POST'])
def get_ticket_vectors():
    """
    Get the vectors of a ticket or tickets.
    """
    logger.info("Received request for get_ticket_vectors")
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
    logger.info("Received request for get_score")
    api_key = request.headers.get('Authorization')
    if not api_key or not api_key.startswith('Bearer '):
        logger.error("Invalid API key")
        return jsonify({'error': 'Invalid API key'}), 401
    
    subdomain = request.headers.get('X-Zendesk-Subdomain')
    if not subdomain:
        logger.error("Missing Zendesk subdomain in request headers")
        return jsonify({'error': 'Missing Zendesk subdomain'}), 400

    data = request.json
    ticket_id = data.get('ticket_id')

    pinecone_service = PineconeService(subdomain)
    comments = pinecone_service.list_tickets(ticket_id)
    emotion_score = 0 
    for comment in comments:
        emotion_score += comment['metadata']['emotion_sum']
    emotion_score = emotion_score / len(comments)

    logger.info(f"Calculated score: {emotion_score}")
    return jsonify({'score': emotion_score}), 200

if __name__ == '__main__':
    app.run(debug=True)
