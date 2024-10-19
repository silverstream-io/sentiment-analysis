from typing import Tuple, Dict
from flask import jsonify, request, render_template
from datetime import datetime
from services.auth_service import auth_required
from services.pinecone_service import PineconeService
from models.emotions import emotions
from utils import get_subdomain
import logging

logger = logging.getLogger('api.server')

class Root: 
    def index():
        return render_template('root/index.html')

    def health():
        return "OK"

class SentimentChecker:
    """
    A class for handling the Sentiment Checker application.

    This class provides methods to analyze comments, retrieve ticket vectors,
    calculate sentiment scores, and serve the entry point for the Sentiment Checker
    Zendesk application.

    The class interacts with various services including:
    - PineconeService for vector operations and storage
    - Authentication service for securing endpoints
    - OpenAI service for sentiment analysis (indirectly through PineconeService)

    Methods:
        analyze_comments: Analyzes and stores sentiment for ticket comments.
        get_ticket_vectors: Retrieves vectors associated with a ticket.
        get_score: Calculates the overall sentiment score for a ticket.
        entry: Serves as the entry point for the Zendesk application.

    Each method is decorated with @auth_required to ensure proper authentication
    before processing requests.

    Note: This class assumes the existence of a Flask application context and
    uses Flask's request object for handling incoming data.
    """

    def __init__(self):
        self.template_folder = '../templates/sentiment-checker'
        self.subdomain, error = get_subdomain(request)
        if error:
            self.logger.error(f"Error getting subdomain: {error}")
            raise Exception(error)
        self.pinecone_service = PineconeService(self.subdomain)
        self.logger = logger
        self.logger.info(f"Initialized SentimentChecker with subdomain: {self.subdomain}")

    @auth_required
    def analyze_comments(self) -> Tuple[Dict[str, str], int]:
        """
        Analyze the comments of a ticket and store them in the database.
        """

        self.logger.info("Received request for analyze_comments")

        data = request.json
        ticket = data.get('ticket', {})
        comments = ticket.get('comments', {})
        ticket_id = ticket.get('id')
        if not comments or not ticket_id:
            self.logger.info("Missing comments or ticket id in request data")
            return jsonify({'error': 'Missing comments or ticket id'}), 400

        self.logger.info(f"Processing comments for ticket: {ticket_id}")
        results = []
    
        for comment_id, text in comments.items():
            embedding = self.pinecone_service.get_embedding(text)
            vector_id = f"{ticket_id}#{comment_id}"
            # Query emotions namespace
            emotion_matches = self.pinecone_service.query_vectors(embedding, namespace='emotions', top_k=10)
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
            upsert_response = self.pinecone_service.upsert_vector(vector_id, embedding, metadata)
            results.append({
                'comment_id': comment_id,
                'upsert_response': upsert_response
            })
        
        self.logger.info(f"Finished processing comments for ticket: {ticket_id}")
        return jsonify({'message': 'Comments analyzed and stored successfully', 'results': results}), 200

    @auth_required
    def get_ticket_vectors(self) -> Tuple[Dict[str, str], int]:
        """
        Get the vectors of a ticket or tickets.
        """
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

    @auth_required
    def get_score(self) -> Tuple[Dict[str, str], int]:
        """
        Get the score of a ticket or tickets based on the emotions of the comments.
        """
        self.logger.info("Received request for get_score")

        data = request.json
        ticket = data.get('ticket', {})
        ticket_id = ticket.get('id')

        comments = self.pinecone_service.list_tickets(ticket_id)
        emotion_score = 0 
        for comment in comments:
            emotion_score += comment['metadata']['emotion_sum']
        emotion_score = emotion_score / len(comments)

        self.logger.info(f"Calculated score: {emotion_score}")
        return jsonify({'score': emotion_score}), 200

    @auth_required
    def entry(self):
        self.logger.info("Received request for entry point")
        
        # Extract subdomain from the origin URL
        origin = request.args.get('origin', '')
        subdomain = origin.split('//')[1].split('.')[0] if '//' in origin else ''
        self.logger.info(f"Extracted subdomain: {subdomain}")

        form_data = request.form

        return render_template(f'{self.template_folder}/index.html', subdomain=subdomain, form_data=dict(form_data))
    
    def health(self):
        return "Sentiment Checker is healthy"
