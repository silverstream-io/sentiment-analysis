from typing import Tuple, Dict
from flask import jsonify, request, render_template, make_response, session
from datetime import datetime
from bs4 import BeautifulSoup as bs
from services.auth_service import auth_required, session_required
from services.pinecone_service import PineconeService
from models.emotions import emotions
from utils import get_subdomain
import logging
import os
import math

logger = logging.getLogger('sentiment_checker')

class Root: 
    def index(self):
        return render_template('root/index.html')

    def health(self):
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
        self.logger = logger
        self.templates = 'sentiment-checker'
    
    def init(self):
        self.subdomain, error = get_subdomain(request)
        if error:
            self.logger.error(f"Error getting subdomain: {error}, request remote addr: {request.remote_addr}")
            raise Exception(error)
        self.pinecone_service = PineconeService(self.subdomain)
        self.logger.info(f"Initialized SentimentChecker with subdomain: {self.subdomain}, request remote addr: {request.remote_addr}")

    @session_required
    def analyze_comments(self) -> Tuple[Dict[str, str], int]:
        """
        Analyze the comments of a ticket and store them in the database.
        """

        self.init()

        self.logger.info(f"Received request for analyze_comments, request remote addr: {request.remote_addr}")

        data = request.json
        ticket = data.get('ticket', {})
        comments = ticket.get('comments', {})
        ticket_id = ticket.get('id')
        if not comments or not ticket_id:
            self.logger.warning(f"Missing comments or ticket id in request data, request remote addr: {request.remote_addr}")
            return jsonify({'error': 'Missing comments or ticket id'}), 400
        ticket_id = ticket_id['ticketId']

        self.logger.info(f"Processing comments for ticket: {ticket_id}, request remote addr: {request.remote_addr}")
        results = []
    
        for comment_id, text in comments.items():
            text = bs(text, 'html.parser').get_text()
            text = ' '.join(text.split())
            vector_id = f"{ticket_id}#{comment_id}"
            try:
                existing_vector = self.pinecone_service.fetch_vector(vector_id)
            except Exception as e:
                self.logger.debug(f"Error fetching vector {vector_id}: {e}, request remote addr: {request.remote_addr}")
                existing_vector = None
            if existing_vector:
                self.logger.debug(f"Existing vector found for comment {comment_id}: {existing_vector}, request remote addr: {request.remote_addr}")
                results.append({
                    'comment_id': comment_id,
                    'emotion_score': existing_vector['metadata']['emotion_score'],
                    'upserted_count': 0
                })
            else:
                self.logger.debug(f"No existing vector found for comment {comment_id}, request remote addr: {request.remote_addr}")
                embedding = self.pinecone_service.get_embedding(text)
                # Query emotions namespace
                emotion_matches = self.pinecone_service.query_vectors(embedding, 
                                                                      namespace='emotions', 
                                                                      top_k=100, 
                                                                      include_metadata=True, 
                                                                      include_values=False)
                self.logger.debug(f"Emotion matches: {emotion_matches}, request remote addr: {request.remote_addr}")
                emotion_sum = 0
                matched_count = 0
                for match in emotion_matches:
                    for emotion_name in match['metadata']:
                        if emotion_name in emotions and match['metadata'][emotion_name]:
                            emotion_sum += emotions[emotion_name].score * match['score']
                            matched_count += 1
                        else:
                            self.logger.warning(f"Emotion {emotion_name} not found in emotions dictionary, request remote addr: {request.remote_addr}")
                self.logger.debug(f"Emotion sum for comment {comment_id}: {emotion_sum}, request remote addr: {request.remote_addr}")
                # Prepare metadata for upsert
                if matched_count > 0:   
                    emotion_score = emotion_sum / matched_count
                else:
                    emotion_score = 0
                if emotion_score > 10:
                    emotion_score = 10
                elif emotion_score < -10:
                    emotion_score = -10
                self.logger.debug(f"Emotion score for comment {comment_id}: {emotion_score}, request remote addr: {request.remote_addr}")
                metadata = {
                    'text': text,
                    'timestamp': int(datetime.timestamp(datetime.now())),
                    'emotion_score': emotion_score
                }
                # Upsert vector to Zendesk subdomain namespace
                upsert_response = self.pinecone_service.upsert_vector(vector_id, embedding, metadata)
                results.append({
                    'comment_id': comment_id,
                    'emotion_score': emotion_score,
                    'upserted_count': upsert_response.upserted_count
                })
        
        self.logger.info(f"Finished processing comments for ticket: {ticket_id}, request remote addr: {request.remote_addr}")
        return jsonify({'message': 'Comments analyzed and stored successfully', 'results': results}), 200

    @session_required
    def get_ticket_vectors(self) -> Tuple[Dict[str, str], int]:
        """
        Get the vectors of a ticket or tickets.
        """

        self.init()
        self.logger.info(f"Received request for get_ticket_vectors, request remote addr: {request.remote_addr}")

        data = request.json
        ticket = data.get('ticket', {})
        ticket_id = ticket.get('id')

        vectors = self.pinecone_service.list_ticket_vectors(ticket_id)
        if vectors:
            vectors_ids = [vector['id'] for vector in vectors]
            vectors = self.pinecone_service.fetch_vectors(vectors_ids)
            return jsonify({'vectors': vectors}), 200
        else:
            return jsonify({'vectors': {}}), 200

    @session_required
    def get_score(self) -> Tuple[Dict[str, str], int]:
        """
        Get the weighted score of a ticket or multiple tickets based on the emotions of the comments.
        """
        self.init()
        self.logger.info(f"Received request for get_score, request remote addr: {request.remote_addr}")

        try:
            data = request.json
            tickets = data.get('tickets', [])
            if not tickets or not isinstance(tickets, list):
                return jsonify({'error': 'Invalid or missing ticket data'}), 400
            ticket_ids = [ticket.get('ticketId') for ticket in tickets if ticket.get('ticketId')]
            if not ticket_ids:
                return jsonify({'error': 'No valid ticket IDs found'}), 400
        except Exception as e:
            self.logger.error(f"Error processing ticket data: {e}, request remote addr: {request.remote_addr}")
            return jsonify({'error': 'Invalid request data'}), 400

        self.logger.debug(f"Processing {len(ticket_ids)} tickets for score calculation, request remote addr: {request.remote_addr}")
        
        total_weighted_score = 0
        total_weight = 0
        lambda_factor = 0.1  # Adjust this value to control the decay rate

        for ticket_id in ticket_ids:
            self.logger.debug(f"Processing ticket: {ticket_id}, request remote addr: {request.remote_addr}")
            vector_list = self.pinecone_service.list_ticket_vectors(str(ticket_id))
            vector_ids = [getattr(vector, 'id', vector.get('id')) if isinstance(vector, dict) else vector.id for vector in vector_list]
            comment_vectors = self.pinecone_service.fetch_vectors(vector_ids)
            
            # Sort vectors by timestamp (newest first)
            sorted_vectors = sorted(comment_vectors.items(), key=lambda x: x[1]['metadata']['timestamp'], reverse=True)
            
            if sorted_vectors:
                newest_timestamp = sorted_vectors[0][1]['metadata']['timestamp']
                
                for vector_id, vector_data in sorted_vectors:
                    if 'metadata' in vector_data and 'emotion_score' in vector_data['metadata']:
                        time_diff = (newest_timestamp - vector_data['metadata']['timestamp']) / (24 * 3600)  # Convert to days
                        weight = math.exp(-lambda_factor * time_diff)
                        total_weighted_score += vector_data['metadata']['emotion_score'] * weight
                        total_weight += weight

        if total_weight > 0:
            emotion_score = total_weighted_score / total_weight
        else:
            emotion_score = 0

        self.logger.info(f"Calculated weighted score for {len(ticket_ids)} tickets: {emotion_score}, request remote addr: {request.remote_addr}")
        return jsonify({'score': emotion_score}), 200

    @auth_required
    def entry(self):
        """
        Serve the entry point for the Zendesk application.
        """

        self.init()
        self.logger.info(f"Received request for entry point, request remote addr: {request.remote_addr}")
        
        original_query_string = request.query_string.decode()
        session_token = os.urandom(24).hex()
        session['session_token'] = session_token
        response = make_response(render_template(
            f'{self.templates}/entry.html', 
            subdomain=self.subdomain,
            original_query_string=original_query_string
        ))
        response.set_cookie('session_token', session_token, secure=True, httponly=True, samesite='None')

        return response
    
    def health(self):
        return render_template(f'{self.templates}/health.html')
