from typing import Optional, Tuple, Dict
from flask import Flask, Request, request, jsonify
from flask_cors import CORS
from services.pinecone_service import PineconeService
import dotenv, os
from datetime import datetime
from models.emotions import emotions
import logging
from logging.handlers import TimedRotatingFileHandler
from services.auth_service import jwt_required

# Set up logging
log_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '../logs')
os.makedirs(log_dir, exist_ok=True)
log_file = os.path.join(log_dir, f"{datetime.now().strftime('%Y-%m-%d')}.log")

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

file_handler = TimedRotatingFileHandler(log_file, when="midnight", interval=1, backupCount=30)
file_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
logger.addHandler(file_handler)

dotenv.load_dotenv()
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": [ "https://1077817.apps.zdusercontent.com" ]}}, supports_credentials=True)

def get_subdomain(request: Request) -> Tuple[Optional[str], Optional[Tuple[Dict[str, str], int]]]:
    """
    Get the subdomain from the request headers. If it's missing, return an error.
    """
    subdomain = request.headers.get('X-Zendesk-Subdomain')
    if not subdomain:
        logger.info("Missing Zendesk subdomain in request headers")
        return None, ({'error': 'Missing Zendesk subdomain'}, 400)
    return subdomain, None


def _handle_options_request(request: Request) -> Tuple[Dict[str, str], int]:
    """
    Handle the OPTIONS request.
    """
    response = jsonify({"message": "Preflight response"})
    response.headers.add("Access-Control-Allow-Origin", "https://1077817.apps.zdusercontent.com")
    response.headers.add("Access-Control-Allow-Methods", "POST, OPTIONS")
    response.headers.add("Access-Control-Allow-Headers", "Content-Type, Authorization")
    return response, 204


@app.route('/api/analyze-comments', methods=['POST', 'OPTIONS'])
@jwt_required
def analyze_comments() -> Tuple[Dict[str, str], int]:
    """
    Analyze the comments of a ticket and store them in the database.
    """
    if request.method == 'OPTIONS':
        return _handle_options_request(request)

    logger.info("Received request for analyze_comments")
    subdomain, error = get_subdomain(request)
    if error:
        return jsonify(error[0]), error[1]

    data = request.json
    ticket = data.get('ticket', {})
    comments = ticket.get('comments', {})
    ticket_id = ticket.get('id')
    if not comments or not ticket_id:
        logger.info("Missing comments or ticket id in request data")
        return jsonify({'error': 'Missing comments or ticket id'}), 400

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

@app.route('/api/get-ticket-vectors', methods=['POST', 'OPTIONS'])
@jwt_required
def get_ticket_vectors() -> Tuple[Dict[str, str], int]:
    """
    Get the vectors of a ticket or tickets.
    """
    if request.method == 'OPTIONS':
        return _handle_options_request(request)

    logger.info("Received request for get_ticket_vectors")
    subdomain, error = get_subdomain(request)
    if error:
        return jsonify(error[0]), error[1]

    data = request.json
    ticket = data.get('ticket', {})
    ticket_id = ticket.get('id')

    pinecone_service = PineconeService(subdomain)
    vectors = pinecone_service.list_ticket_vectors(ticket_id)

    return jsonify({'vectors': vectors}), 200

@app.route('/api/get-score', methods=['POST', 'OPTIONS'])
@jwt_required
def get_score() -> Tuple[Dict[str, str], int]:
    """
    Get the score of a ticket or tickets based on the emotions of the comments.
    """
    if request.method == 'OPTIONS':
        return _handle_options_request(request)

    logger.info("Received request for get_score")
    subdomain, error = get_subdomain(request)
    if error:
        return jsonify(error[0]), error[1]

    data = request.json
    ticket = data.get('ticket', {})
    ticket_id = ticket.get('id')

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
