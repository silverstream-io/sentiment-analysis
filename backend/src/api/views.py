from typing import Tuple, Dict, Any, Optional, List
from flask import jsonify, request, render_template, make_response, session
from datetime import datetime
from bs4 import BeautifulSoup as bs
from services.auth_service import auth_required, session_required
from services.pinecone_service import PineconeService
from models.emotions import emotions
from utils import get_subdomain
import numpy as np
import logging
import os
import math
from config.redis_config import RedisClient, RedisConfigError
import json
from datetime import datetime

logger = logging.getLogger('sentiment_checker')
logger = logging.getLogger('sentiment_checker')

class Root: 
    def index(self):
        return render_template('root/index.html')
class Root: 
    def index(self):
        return render_template('root/index.html')

    def health(self):
        return "OK"
    def health(self):
        return "OK"

class SentimentChecker:
    """
    A class for handling the Sentiment Checker application.

    This class provides methods to analyze comments, retrieve ticket vectors,
    calculate sentiment scores, and serve the entry point for the Sentiment Checker
    Zendesk application.

    Methods are organized in the following groups:
    1. Initialization and Entry Points
    2. Analysis Methods
    3. Data Retrieval Methods
    4. Health Check
    """

    UNSOLVED_STATES = {'new', 'open', 'pending'}
    
    def __init__(self):
        self.logger = logger
        self.templates = 'sentiment-checker'
        self.debug_mode = os.environ.get('SENTIMENT_CHECKER_DEBUG') == 'true'
        self.redis = None
        try:
            self.redis = RedisClient.get_instance()
        except RedisConfigError as e:
            self.logger.error(f"Failed to initialize Redis - continuing without caching: {e}")
        self.cache_ttl = 3600  # 1 hour cache TTL

    def init(self):
        self.remote_addr = request.headers.get('X-Forwarded-For', request.remote_addr)
        self.subdomain, error = get_subdomain(request)
        if error:
            self.logger.error(f"Error getting subdomain: {error}, request remote addr: {self.remote_addr}")
            raise Exception(error)
        
        # Log the subdomain being used
        self.logger.info(f"Using subdomain: {self.subdomain} for request from {self.remote_addr}")
        
        if request.method == 'POST':
            if request.is_json:
                self.logger.info(f"Received JSON data for background_refresh")
                self.data = request.get_json()
            elif request.form:
                self.logger.info(f"Received form data for background_refresh")
                self.data = request.form.to_dict()
            elif request.data:
                self.logger.info(f"Received data for background_refresh")
                self.data = request.data.decode('utf-8')
            else:
                self.logger.warning(f"Received unknown data for background_refresh")
                self.data = None 
        else:
            self.logger.warning(f"Received unknown method for init")
            return jsonify({'error': 'Unknown method'}), 400
        self.pinecone_service = PineconeService(self.subdomain)
        self.logger.debug(f"Initialized SentimentChecker with subdomain: {self.subdomain}, request remote addr: {self.remote_addr}")
        self.ticket_ids = []
        if 'ticket' in self.data:
            if isinstance(self.data['ticket'], str):
                self.ticket_ids.append(self.data['ticket'])
            elif isinstance(self.data['ticket'], dict) and 'ticketId' in self.data['ticket']:
                self.ticket_ids.append(self.data['ticket']['ticketId'])
        if 'tickets' in self.data:
            if isinstance(self.data['tickets'], list):
                self.ticket_ids.extend([str(ticket) for ticket in self.data['tickets'] if isinstance(ticket, (str, int))])
            elif isinstance(self.data['tickets'], dict):
                self.ticket_ids.extend([str(ticket_id) for ticket_id in self.data['tickets'].keys()])
            self.ticket_ids = list(set(self.ticket_ids))  # Remove duplicates
        
        if not self.ticket_ids and not request.form:
            self.logger.warning(f"Missing ticket id(s) in request data, data is {self.data}, request remote addr: {self.remote_addr}")
        self.original_query_string = request.query_string.decode()

    # Entry Points
    @auth_required
    def entry(self):
        """
        Serve the entry point for the Zendesk application.
        """
        self.init()
        self.logger.info(f"Entry point request received from {self.remote_addr}")
        self.logger.info(f"Request data: {self.data}")
        self.logger.info(f"Query string: {self.original_query_string}")
        
        session_token = os.urandom(24).hex()
        session['session_token'] = session_token

        if self.debug_mode:
            template = f'{self.templates}/entry_debug.html'
        else:
            template = f'{self.templates}/entry.html'
            
        self.logger.info(f"Using template: {template}")
        
        try:
            response = make_response(render_template(
                template, 
                subdomain=self.subdomain,
                original_query_string=self.original_query_string
            ))
            self.logger.info("Template rendered successfully")
            
            response.set_cookie('session_token', session_token, secure=True, httponly=True, samesite='None')
            self.logger.info("Cookie set successfully")
            
            return response
        except Exception as e:
            self.logger.error(f"Error rendering template: {str(e)}")
            raise

    @auth_required
    def background_refresh(self):
        self.init()
        if self.debug_mode:
            template = f'{self.templates}/background_debug.html'
        else:
            template = f'{self.templates}/background.html'
            
        response = make_response(render_template(
            template,
            subdomain=self.subdomain,
            original_query_string=self.original_query_string
        ))
        return response
    
    @auth_required
    def topbar(self):
        self.init()
        self.logger.info(f"Received request for topbar, request remote addr: {self.remote_addr}")
        
        if self.debug_mode:
            template = f'{self.templates}/topbar_debug.html'
        else:
            template = f'{self.templates}/topbar.html'
            
        response = make_response(render_template(
            template,
            subdomain=self.subdomain,
            original_query_string=self.original_query_string
        ))
        return response

    # Analysis Methods
    def _analyze(self, ticket_id: str, comment: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze a single comment and store the result in the database.
        
        Args:
            ticket_id: The ID of the ticket containing the comment
            comment: Dict containing comment data with format:
                    {'id': str, 'text': str, 'created_at': str}
                    
        Returns:
            Dict containing the analysis results
        """
        comment_id = comment['id']
        text = comment['text']
        
        try:    
            if isinstance(comment['created_at'], str):
                timestamp = int(datetime.fromisoformat(comment['created_at'].replace('Z', '+00:00')).timestamp())
            else:
                self.logger.error(f"Invalid created_at format for comment {comment_id}, created_at: {comment['created_at']}, request remote addr: {self.remote_addr}")
                raise ValueError(f"Invalid created_at format for comment {comment_id}")
        except Exception as e:
            self.logger.error(f"Error getting timestamp for comment {comment_id}: {e}, request remote addr: {self.remote_addr}")
            timestamp = int(datetime.now().timestamp())
        
        if not text:
            return None

        text = bs(text, 'html.parser').get_text()
        text = ' '.join(text.split())
        vector_id = f"{ticket_id}#{comment_id}"

        try:
            existing_vector = self.pinecone_service.fetch_vector(vector_id)
        except Exception as e:
            self.logger.debug(f"Error fetching vector {vector_id}: {e}, request remote addr: {self.remote_addr}")
            existing_vector = None

        if existing_vector:
            self.logger.debug(f"Existing vector found for comment {comment_id}: {existing_vector}, request remote addr: {self.remote_addr}")
            if 'metadata' in existing_vector and 'emotion_score' in existing_vector['metadata']:
                return {
                    'comment_id': comment_id,
                    'emotion_score': existing_vector['metadata']['emotion_score'],
                    'upserted_count': 0
                }
            else:
                self.logger.debug(f"No metadata or emotion_score found for vector {vector_id}, request remote addr: {self.remote_addr}")
        
        # If no existing vector or invalid metadata, create new analysis
        embedding = self.pinecone_service.get_embedding(text)
        emotion_matches = self.pinecone_service.query_vectors(embedding, 
                                                          namespace='emotions', 
                                                          top_k=100, 
                                                          include_metadata=True, 
                                                          include_values=False)
        
        self.logger.debug(f"Emotion matches: {emotion_matches}, request remote addr: {self.remote_addr}")
        emotion_sum = 0
        matched_count = 0
        
        for match in emotion_matches:
            for emotion_name, emotion_value in match['metadata'].items():
                if emotion_name in emotions:
                    if emotion_value:
                        emotion_sum += emotions[emotion_name].score * match['score']
                        matched_count += 1
                    else:
                        self.logger.debug(f"Emotion \"{emotion_name}\" not found in emotions dictionary or has no value. Request remote addr: {self.remote_addr}")
                else:
                    self.logger.debug(f"Emotion \"{emotion_name}\" not found in emotions dictionary or has no value. Request remote addr: {self.remote_addr}")

        self.logger.debug(f"Emotion sum for comment {comment_id}: {emotion_sum}, request remote addr: {self.remote_addr}")
        
        if matched_count > 0:   
            emotion_score = emotion_sum / matched_count
        else:
            emotion_score = 0
            
        emotion_score = max(min(emotion_score, 10), -10)
        
        self.logger.debug(f"Emotion score for comment {comment_id}: {emotion_score}, request remote addr: {self.remote_addr}")
        
        metadata = {
            'text': text,
            'timestamp': timestamp,
            'emotion_score': emotion_score
        }
        
        upsert_response = self.pinecone_service.upsert_vector(vector_id, embedding, metadata)
        
        if not hasattr(upsert_response, 'upserted_count') or upsert_response.upserted_count == 0:
            self.logger.error(f"No vector upserted for comment {comment_id}, upsert response: {upsert_response}, request remote addr: {self.remote_addr}")
            raise Exception(f'No vector upserted for comment {comment_id}')
            
        return {
            'comment_id': comment_id,
            'emotion_score': emotion_score,
            'upserted_count': upsert_response.upserted_count
        }

    def _convert_date_to_timestamp(self, date_str: str) -> int:
        """Convert ISO date string to Unix timestamp"""
        try:
            dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            return int(dt.timestamp())
        except Exception as e:
            self.logger.error(f"Error converting date {date_str}: {e}")
            return int(datetime.now().timestamp())

    def _cache_ticket_data(self, ticket_id: str, data: Dict[str, Any], ttl: int = 3600) -> None:
        """Cache ticket data including score and timestamps"""
        if not self.redis:
            self.logger.debug(f"Redis not available - skipping cache for ticket {ticket_id}")
            return

        try:
            # Convert dates to timestamps
            if 'updated_at' in data:
                data['updated_at'] = self._convert_date_to_timestamp(data['updated_at'])
            if 'created_at' in data:
                data['created_at'] = self._convert_date_to_timestamp(data['created_at'])

            # Add user data if present
            if 'requestor' in data:
                requestor = data['requestor']
                data['requestor'] = {
                    'id': requestor.get('id'),
                    'name': requestor.get('name')
                }
            
            if 'assignee' in data:
                assignee = data['assignee']
                data['assignee'] = {
                    'id': assignee.get('id'),
                    'name': assignee.get('name')
                }

            cache_key = self._get_cache_key(ticket_id)
            self.redis.set(cache_key, json.dumps(data), ex=ttl)
            self.logger.debug(f"Cached data for ticket {ticket_id}: {data}")
            
            # Maintain set of unsolved tickets
            if data.get('state', '').lower() in self.UNSOLVED_STATES:
                unsolved_key = f"{self.subdomain}:unsolved_tickets"
                self.redis.sadd(unsolved_key, ticket_id)
            else:
                self.redis.srem(f"{self.subdomain}:unsolved_tickets", ticket_id)
                
        except Exception as e:
            self.logger.error(f"Error caching data for ticket {ticket_id}: {e}")

    @session_required
    def analyze_comments(self) -> Tuple[Dict[str, str], int]:
        """Analyze comments and store results with metadata"""
        self.init()
        self.logger.info(f"Received request for analyze_comments")

        if not self.ticket_ids:
            self.logger.warning(f"Missing ticket ids in request data")
            return jsonify({'error': 'Missing ticket ids'}), 400

        all_results = []
        for ticket_id in self.ticket_ids:
            try:
                ticket_data = self.data.get('ticket', {})
                comments = ticket_data.get('comments', [])
                
                if not comments:
                    self.logger.warning(f"No comments found for ticket {ticket_id}")
                    continue

                # Process comments and get sentiment
                comment_results = []
                for comment_id, comment_data in comments.items():
                    try:
                        formatted_comment = {
                            'id': comment_id,
                            'text': comment_data.get('text', ''),
                            'created_at': comment_data.get('created_at')
                        }
                        result = self._analyze(ticket_id, formatted_comment)
                        if result:
                            comment_results.append(result)
                    except Exception as e:
                        self.logger.error(f"Error analyzing comment {comment_id}: {e}")
                        continue

                if not comment_results:
                    continue

                # Calculate overall ticket score from comment scores
                total_weighted_score = 0
                total_weight = 0
                lambda_factor = 1.0  # Decay rate
                all_scores = []
                
                # Sort comments by timestamp
                sorted_results = sorted(comment_results, 
                                     key=lambda x: x.get('timestamp', 0), 
                                     reverse=True)
                
                if sorted_results:
                    newest_timestamp = sorted_results[0].get('timestamp', 0)
                    
                    for result in sorted_results:
                        time_diff = (newest_timestamp - result.get('timestamp', 0)) / (24 * 3600)
                        weight = math.exp(-lambda_factor * time_diff)
                        score = result['emotion_score']
                        total_weighted_score += score * weight
                        total_weight += weight
                        all_scores.append(score)

                    if total_weight > 0:
                        calculated_score = total_weighted_score / total_weight
                    else:
                        calculated_score = 0

                    # Apply standard deviation adjustment
                    if all_scores:
                        all_scores_np = np.array(all_scores)
                        std_dev = np.std(all_scores_np)
                        most_recent_score = all_scores[0]

                        if most_recent_score < calculated_score and abs(calculated_score - most_recent_score) > std_dev:
                            calculated_score = most_recent_score
                        elif most_recent_score > calculated_score and abs(most_recent_score - calculated_score) > std_dev:
                            calculated_score = most_recent_score

                    # Normalize score to [-1, 1]
                    calculated_score = max(min(calculated_score / 10, 1), -1)

                    # Store ticket metadata
                    metadata = {
                        'score': calculated_score,
                        'state': ticket_data.get('state', ''),
                        'updated_at': self._convert_date_to_timestamp(ticket_data.get('updated_at', '')),
                        'created_at': self._convert_date_to_timestamp(ticket_data.get('created_at', ''))
                    }
                    
                    self._cache_ticket_data(ticket_id, metadata)
                    all_results.append({
                        'ticket_id': ticket_id,
                        'score': calculated_score
                    })

            except Exception as e:
                self.logger.error(f"Error processing ticket {ticket_id}: {e}")
                continue

        return jsonify({'results': all_results}), 200

    @session_required
    def update_sentiment(self) -> Tuple[Dict[str, Any], int]:
        """
        Update sentiment for new comments on a ticket.
        """
        self.init()
        self.logger.info(f"Received request for update_sentiment, request remote addr: {self.remote_addr}")
        
        ticket_id = self.data.get('ticket_id')
        comments = self.data.get('comments', [])
        
        if not ticket_id or not comments:
            self.logger.warning(f"Missing ticket_id or comments in request data, data is {self.data}, request remote addr: {self.remote_addr}")
            return jsonify({'error': 'Missing ticket_id or comments'}), 400
            
        existing_vectors = self.pinecone_service.list_ticket_vectors(ticket_id)
        existing_comment_ids = set(vector['id'].split('#')[1] for vector in existing_vectors)
        new_comments = [comment for comment in comments if str(comment['id']) not in existing_comment_ids]
        
        results = []
        for comment in new_comments:
            try:
                formatted_comment = {
                    'id': str(comment['id']),
                    'text': comment['value'],
                    'created_at': comment['created_at']
                }
                result = self._analyze(ticket_id, formatted_comment)
                if result:
                    results.append(result)
            except Exception as e:
                self.logger.error(f"Error analyzing comment {comment['id']}: {e}, request remote addr: {self.remote_addr}")
                continue
                
        return jsonify({
            'message': 'Sentiment updated successfully',
            'results': results,
            'new_comments_count': len(new_comments)
        }), 200

    # Data Retrieval Methods
    @session_required
    def get_ticket_vectors(self) -> Tuple[Dict[str, str], int]:
        """
        Get the vectors of one or more tickets.
        """
        self.init()
        self.logger.info(f"Received request for get_ticket_vectors, request remote addr: {self.remote_addr}")

        if not self.ticket_ids:
            self.logger.warning(f"Missing ticket ids in request data, data is {self.data}, request remote addr: {self.remote_addr}")
            return jsonify({'error': 'Missing ticket ids'}), 400

        all_vectors = {}
        for ticket_id in self.ticket_ids:
            vectors_list = self.pinecone_service.list_ticket_vectors(ticket_id)
            self.logger.debug(f"Ticket {ticket_id} has vectors: {vectors_list}, request remote addr: {self.remote_addr}")
            vector_ids = [getattr(vector, 'id', vector.get('id')) if isinstance(vector, dict) else vector.id for vector in vectors_list]
            try:
                all_vectors[ticket_id] = self.pinecone_service.fetch_vectors(vector_ids)
            except Exception as e:
                self.logger.error(f"Error fetching vectors for ticket {ticket_id}: {e}, request remote addr: {self.remote_addr}")

        return jsonify({'vectors': all_vectors}), 200

    @session_required
    def get_score(self, ticket_id: str = None) -> Tuple[Dict[str, str], int]:
        """
        Get the weighted score of a ticket or multiple tickets based on the emotions of the comments.
        """
        self.init()
        self.logger.info(f"Received request for get_score, request remote addr: {self.remote_addr}")

        if not self.ticket_ids:
            self.logger.warning(f"Missing ticket ids in request data, data is {self.data}, request remote addr: {self.remote_addr}")
            return jsonify({'error': 'Missing ticket ids'}), 400

        self.logger.debug(f"Processing {len(self.ticket_ids)} tickets for score calculation, request remote addr: {self.remote_addr}")
        
        total_weighted_score = 0
        total_weight = 0
        lambda_factor = 1.0 # Adjust this value to control the decay rate
        all_scores = []
        if ticket_id:
            ticket_ids = [ticket_id]
        else:
            ticket_ids = self.ticket_ids

        for ticket_id in ticket_ids:
            vector_ids, comment_vectors = [], []
            self.logger.info(f"Processing ticket: {ticket_id}, request remote addr: {self.remote_addr}")
            vector_list = self.pinecone_service.list_ticket_vectors(str(ticket_id))
            for vector in vector_list:
                vector_ids.append(vector.id if hasattr(vector, 'id') else vector.get('id'))
            response = self.pinecone_service.fetch_vectors(vector_ids)
            if len(response.values()) > 0:
                comment_vectors.append(response)
                self.logger.info(f"Fetched vectors: {comment_vectors}")
            else:
                self.logger.warning(f"No vectors found for ticket {ticket_id}") 
                continue

            if len(comment_vectors) == 0:
                self.logger.warning(f"No vectors found for tickets: {self.ticket_ids}")
                self.logger.info(f"namespace: {self.pinecone_service.namespace}")
                return jsonify({'score': 0}), 200

            sorted_vectors = sorted(comment_vectors[0].items(), key=lambda x: x[1]['metadata']['timestamp'], reverse=True)
            self.logger.info(f"Sorted vectors: {sorted_vectors}")

            if sorted_vectors:
                newest_timestamp = sorted_vectors[0][1]['metadata']['timestamp']
                self.logger.info(f"Newest timestamp: {newest_timestamp}")
                
                for vector_id, vector_data in sorted_vectors:
                    if 'metadata' in vector_data and 'emotion_score' in vector_data['metadata']:
                        time_diff = (newest_timestamp - vector_data['metadata']['timestamp']) / (24 * 3600)  # Convert to days
                        weight = math.exp(-lambda_factor * time_diff)
                        score = vector_data['metadata']['emotion_score']
                        total_weighted_score += score * weight
                        total_weight += weight
                        all_scores.append(score)
                        self.logger.info(f"Vector {vector_id}: score={score}, weight={weight}")
                    else:
                        self.logger.warning(f"No metadata or emotion_score found for vector {vector_id}")

        if total_weight > 0:
            weighted_score = total_weighted_score / total_weight
        else:
            weighted_score = 0
        
        if all_scores:
            all_scores_np = np.array(all_scores)
            std_dev = np.std(all_scores_np)
            most_recent_score = all_scores[0]
            self.logger.info(f"Most recent score: {most_recent_score}, weighted score: {weighted_score}, std_dev: {std_dev}")

            if most_recent_score < weighted_score and abs(weighted_score - most_recent_score) > std_dev:
                weighted_score = most_recent_score
            elif most_recent_score > weighted_score and abs(most_recent_score - weighted_score) > std_dev:
                weighted_score = most_recent_score
            
        weighted_score = max(min(weighted_score, 1), -1)
        
        self.logger.info(f"Calculated weighted score for {len(self.ticket_ids)} tickets: {weighted_score}, request remote addr: {self.remote_addr}")
        #self.logger.debug(f"Calculated weighted score for {len(self.ticket_ids)} tickets: {weighted_score}, request remote addr: {self.remote_addr}")
        return jsonify({'score': weighted_score}), 200

    def _get_cache_key(self, key_type: str) -> str:
        """Generate a cache key with subdomain"""
        return f"{self.subdomain}:{key_type}"

    def _get_cached_scores(self) -> dict:
        """Get scores from cache"""
        cache_key = self._get_cache_key("sentiment_scores")
        cached_data = self.redis.get(cache_key)
        if cached_data:
            return json.loads(cached_data)
        return {}

    def _update_cache(self, scores: dict):
        """Update the cache with new scores"""
        cache_key = self._get_cache_key("sentiment_scores")
        self.redis.set(cache_key, json.dumps(scores), ex=self.cache_ttl)

    def _get_cache_key(self, ticket_id: str) -> str:
        """Generate a cache key for a ticket"""
        return f"{self.subdomain}:ticket:{ticket_id}"

    def _get_cached_ticket_data(self, ticket_id: str) -> Optional[Dict[str, Any]]:
        """Get ticket data from cache"""
        try:
            cache_key = self._get_cache_key(ticket_id)
            cached_data = self.redis.get(cache_key)
            if cached_data:
                self.logger.debug(f"Cache hit for ticket {ticket_id}")
                return json.loads(cached_data)
            self.logger.debug(f"Cache miss for ticket {ticket_id}")
            return None
        except Exception as e:
            self.logger.error(f"Error getting cached data for ticket {ticket_id}: {e}")
            return None

    def get_unsolved_tickets(self) -> List[Dict[str, Any]]:
        """Get all unsolved tickets with their scores"""
        try:
            unsolved_key = f"{self.subdomain}:unsolved_tickets"
            ticket_ids = self.redis.smembers(unsolved_key)
            
            tickets = []
            for ticket_id in ticket_ids:
                ticket_data = self._get_cached_ticket_data(ticket_id)
                if ticket_data:
                    tickets.append({
                        'id': ticket_id,
                        'score': ticket_data.get('score', 0),
                        'state': ticket_data.get('state', ''),
                        'updated_at': ticket_data.get('updated_at')
                    })
            
            return tickets
        except Exception as e:
            self.logger.error(f"Error getting unsolved tickets: {e}")
            return []

    @session_required
    def get_scores(self) -> Tuple[Dict[str, str], int]:
        """Get scores, using cache when possible"""
        self.init()
        self.logger.info(f"Received request for get_scores, request remote addr: {self.remote_addr}")

        if not self.ticket_ids:
            self.logger.warning(f"Missing ticket ids in request data")
            return jsonify({'error': 'Missing ticket ids'}), 400

        scores = {}
        for ticket_id in self.ticket_ids:
            try:
                # Try to get data from cache first
                cached_data = self._get_cached_ticket_data(ticket_id)
                if cached_data:
                    scores[ticket_id] = cached_data['score']
                    continue

                # If not in cache, calculate and cache it
                score_response, status_code = self.get_score(ticket_id)
                if status_code != 200:
                    self.logger.error(f"Error getting score for ticket {ticket_id}")
                    continue

                score_data = score_response.get_json()
                ticket_data = {
                    'score': score_data.get('score', 0),
                    'state': self.data.get('ticket_state', ''),
                    'updated_at': self.data.get('updated_at')
                }
                scores[ticket_id] = ticket_data['score']
                
                # Cache the new data
                self._cache_ticket_data(ticket_id, ticket_data)

            except Exception as e:
                self.logger.error(f"Error processing ticket {ticket_id}: {e}")
                continue

        return jsonify({'scores': scores}), 200

    def _populate_cache(self) -> None:
        """Populate cache with all available scores"""
        try:
            # Get all vectors from Pinecone
            vectors = self.pinecone_service.list_all_vectors()
            
            scores = {}
            for vector in vectors:
                if '#' in vector.id:  # Ensure it's a comment vector
                    ticket_id = vector.id.split('#')[0]
                    if ticket_id not in scores:
                        scores[ticket_id] = {
                            'score': vector.metadata.get('emotion_score', 0),
                            'timestamp': vector.metadata.get('timestamp', 0)
                        }
            
            self._update_cache(scores)
            self.logger.info(f"Cache populated with {len(scores)} ticket scores")
            
        except Exception as e:
            self.logger.error(f"Error populating cache: {e}")

    def health(self):
        """Health check including Redis"""
        remote_addr = request.headers.get('X-Forwarded-For', request.remote_addr)
        
        # Check Pinecone
        pinecone_service = PineconeService('emotions')
        check_pinecone = pinecone_service.check_health()
        
        # Check Redis
        redis_healthy = RedisClient.health_check()
        
        if not check_pinecone.get('status', {}).get('ready', True):
            self.logger.error(f"Pinecone health check failed, request remote addr: {remote_addr}")
            return jsonify({'error': 'Pinecone service is not healthy'}), 500
            
        if not redis_healthy:
            self.logger.error(f"Redis health check failed, request remote addr: {remote_addr}")
            return jsonify({'error': 'Redis service is not healthy'}), 500
            
        return render_template(f'{self.templates}/health.html')

    @session_required
    def get_unsolved_tickets(self) -> Tuple[Dict[str, Any], int]:
        """Get unsolved tickets from cache with pagination"""
        try:
            page = int(request.args.get('page', 1))
            per_page = int(request.args.get('per_page', 10))
            
            start_idx = (page - 1) * per_page
            end_idx = start_idx + per_page
            
            unsolved_key = f"{self.subdomain}:unsolved_tickets"
            ticket_ids = list(self.redis.smembers(unsolved_key))
            total_count = len(ticket_ids)
            
            page_ticket_ids = ticket_ids[start_idx:end_idx]
            
            tickets = []
            for ticket_id in page_ticket_ids:
                ticket_data = self._get_cached_ticket_data(ticket_id)
                if ticket_data:
                    # Convert timestamps back to ISO format for frontend
                    created_at = datetime.fromtimestamp(ticket_data.get('created_at', 0)).isoformat()
                    updated_at = datetime.fromtimestamp(ticket_data.get('updated_at', 0)).isoformat()
                    
                    tickets.append({
                        'id': ticket_id,
                        'score': ticket_data.get('score', 0),
                        'state': ticket_data.get('state', ''),
                        'created_at': created_at,
                        'updated_at': updated_at
                    })
            
            return jsonify({
                'tickets': tickets,
                'total_count': total_count,
                'page': page,
                'per_page': per_page
            }), 200
            
        except Exception as e:
            self.logger.error(f"Error getting unsolved tickets from cache: {e}")
            return jsonify({'error': str(e)}), 500

    @auth_required
    def navbar(self):
        """Handle navbar requests"""
        self.init()
        self.logger.info(f"Received request for navbar, request remote addr: {self.remote_addr}")
        
        # Get the selected range from query params if any
        selected_range = request.args.get('range')
        self.logger.info(f"Selected range: {selected_range}")
        
        if self.debug_mode:
            template = f'{self.templates}/navbar_debug.html'
        else:
            template = f'{self.templates}/navbar.html'
            
        response = make_response(render_template(
            template,
            subdomain=self.subdomain,
            original_query_string=self.original_query_string,
            selected_range=selected_range
        ))
        return response
