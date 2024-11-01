from typing import Tuple, Dict, Any, Optional, List, Union
from flask import Response, jsonify, request, render_template, make_response, session
from datetime import datetime
from bs4 import BeautifulSoup as bs
from services.auth_service import process_jwt, verify_jwt
from services.pinecone_service import PineconeService
from models import emotions, TicketInput, CommentInput, TicketResponse, CommentResponse
from utils import get_subdomain, _check_element
import numpy as np
import logging
import os
import math
from config.redis_config import RedisClient, RedisConfigError
import json

logger = logging.getLogger('sentiment_checker')

class Root: 
    def index(self):
        return render_template('root/index.tmpl')

    def health(self):
        return jsonify({'status': 'healthy'}), 200   

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

    UNSOLVED_STATUSES = {'new', 'open', 'pending'}
    
    def __init__(self):
        self.logger = logger
        self.templates = 'sentiment-checker'
        self.debug_mode = os.environ.get('SENTIMENT_CHECKER_DEBUG') == 'true'
        self.redis = None
        self.response = None
        try:
            self.redis = RedisClient.get_instance()
        except RedisConfigError as e:
            self.logger.error(f"Failed to initialize Redis - continuing without caching: {e}")
        self.cache_ttl = 3600  # 1 hour cache TTL


    def init(self):
        """Initialize the request data and handle authentication."""
        self.original_query_string = request.query_string.decode()
        self.remote_addr = request.headers.get('X-Forwarded-For', request.remote_addr)
        self.subdomain, error = get_subdomain(request)
        self.pinecone_service = PineconeService(self.subdomain)
        
        if error:
            self.logger.error(f"Error getting subdomain: {error}, request remote addr: {self.remote_addr}")
            return self._return_response({'Error in init': error}), 400 

        # Parse request data
        if request.is_json:
            self.data = request.get_json()
        elif request.form:
            self.data = request.form.to_dict()
        elif request.data:
            self.data = request.data
        elif request.method == 'GET':
            self.data = request.args.to_dict()  
        else:
            self.data = {}

        # Check for JWT token in form data (initial request)
        token = None
        if _check_element(self.data, 'token')[0]:
            token = self.data.get('token')
        if token:
            verified_token = verify_jwt(token)
            if isinstance(verified_token, str):
                return self._return_response({'error': verified_token}), 401
                
            # Set up Flask session
            session['subdomain'] = self.subdomain
            session.permanent = True
            self.data.pop('token', None)
            
        # Check for existing session
        if 'subdomain' not in session or session['subdomain'] != self.subdomain:
            self.logger.warning(f"Invalid session attempt from IP: {self.remote_addr}")
            return self._return_response({'error': 'Authentication required'}), 401
        
        self.ticket_data = []
        for ticket in self.data.get('tickets', []):
            self.ticket_data.append(TicketInput(**ticket))


    # Private methods
    def _analyze(self, ticket: TicketInput, comment: CommentInput) -> CommentResponse:
        """
        Analyze a single comment and store the result in the database.
        
        Args:
            id: The ID of the ticket containing the comment
            comment: Dict containing comment data with format:
                    {'id': str, 'text': str, 'created_at': str}
                    
        Returns:
            Dict containing the analysis results
        """
        if not comment.body:
            self.logger.warning(f"Missing body in comment {comment.id} for ticket {ticket.id}")
            self.logger.warning(f"Comment data: {comment.model_dump()}")
            return None
        timestamp = self._convert_date_to_timestamp(comment.created_at)
        body = bs(comment.body, 'html.parser').get_text()
        body = ' '.join(body.split())
        vector_id = f"{ticket.id}#{comment.id}"
        try:
            existing_vector = self.pinecone_service.fetch_vector(vector_id)
        except Exception as e:
            self.logger.debug(f"Error fetching vector {vector_id}: {e}, request remote addr: {self.remote_addr}")
            existing_vector = None
        if existing_vector:
            self.logger.debug(f"Existing vector found for comment {comment.id}: {existing_vector}, request remote addr: {self.remote_addr}")
            if 'metadata' in existing_vector and 'emotion_score' in existing_vector['metadata']:
                response = CommentResponse(
                    **comment.model_dump(),
                    emotion_score=existing_vector['metadata']['emotion_score']
                )
                return response
            else:
                self.logger.debug(f"No metadata or emotion_score found for vector {vector_id}, request remote addr: {self.remote_addr}")
        
        # If no existing vector or invalid metadata, create new analysis
        embedding = self.pinecone_service.get_embedding(body)
        emotion_matches = self.pinecone_service.query_vectors(embedding, 
                                                              namespace='emotions', 
                                                              top_k=100, 
                                                              include_metadata=True, 
                                                              include_values=False)
        
        self.logger.debug(f"Emotion matches: {emotion_matches}, request remote addr: {self.remote_addr}")
        emotion_sum = 0
        matched_count = 0
        
        for match in emotion_matches:
            for emotion_name, emotion_present in match['metadata'].items():
                if emotion_name not in ['text', 'timestamp']:
                    if emotion_name in emotions:
                        if emotion_present:
                            emotion_sum += emotions[emotion_name].score * match['score']
                            matched_count += 1
                    else:
                        self.logger.error(f"Emotion \"{emotion_name}\" not found in emotions dictionary. Request remote addr: {self.remote_addr}")
        self.logger.debug(f"Emotion sum for comment {comment.id}: {emotion_sum}, request remote addr: {self.remote_addr}")
        
        if matched_count > 0:   
            emotion_score = emotion_sum / matched_count
        else:
            emotion_score = 0
            
        emotion_score = max(min(emotion_score, 10), -10)
        
        self.logger.debug(f"Emotion score for comment {comment.id}: {emotion_score}, request remote addr: {self.remote_addr}")
        
        metadata = {
            'body': comment.body,
            'timestamp': timestamp,
            'emotion_score': emotion_score,
            'author_id': comment.author_id
        }
        
        upsert_response = self.pinecone_service.upsert_vector(vector_id, embedding, metadata)
        
        if upsert_response.get('upserted_count', 0) == 0:
            self.logger.error(f"No vector upserted for comment {comment.id}, upsert response: {upsert_response}, request remote addr: {self.remote_addr}")
            raise Exception(f'No vector upserted for comment {comment.id}')
            
        response = CommentResponse(
            **comment.model_dump(),
            emotion_score=emotion_score
        )
        return response


    def _cache_ticket_data(self, id: str, data: Dict[str, Any], ttl: int = 3600) -> None:
        """Cache ticket data including score and timestamps"""
        if not self.redis:
            self.logger.debug(f"Redis not available - skipping cache for ticket {id}")
            return
        try:
            # Convert dates to timestamps
            if 'updated_at' in data:
                data['updated_at'] = self._convert_date_to_timestamp(data['updated_at'])
            if 'created_at' in data:
                data['created_at'] = self._convert_date_to_timestamp(data['created_at'])
            # Add user data if present
            if 'requestor' not in data:
                data['requestor'] = None
            if 'assignee' not in data:
                data['assignee'] = None
            cache_key = self._get_cache_key(id)
            self.redis.set(cache_key, json.dumps(data), ex=ttl)
            self.logger.debug(f"Cached data for ticket {id}: {data}")
            
            # Maintain set of unsolved tickets
            if data.get('status', '').lower() in self.UNSOLVED_STATUSES:
                unsolved_key = f"{self.subdomain}:unsolved_tickets"
                self.redis.sadd(unsolved_key, id)
            else:
                self.redis.srem(f"{self.subdomain}:unsolved_tickets", id)
                
        except Exception as e:
            self.logger.error(f"Error caching data for ticket {id}: {e}")

    def _convert_date_to_timestamp(self, date_str: Union[str, int]) -> int:
        """Convert ISO date string to Unix timestamp"""
        try:
            if isinstance(date_str, str):
                dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            else:
                dt = datetime.fromtimestamp(date_str)
            return int(dt.timestamp())
        except Exception as e:
            self.logger.warning(f"Error converting date {date_str}: {e}")
            return int(datetime.now().timestamp())


    def _get_cache_key(self, key_type: str, id: Optional[str] = None) -> str:
        """Generate a cache key with subdomain
        Args:
            key_type: Type of cache key (e.g., 'sentiment_scores', 'ticket')
            id: Optional ticket ID for ticket-specific keys
        """
        if id:
            return f"{self.subdomain}:{key_type}:{id}"
        return f"{self.subdomain}:{key_type}"


    def _get_cached_scores(self) -> dict:
        """Get scores from cache"""
        cache_key = self._get_cache_key("sentiment_scores")
        cached_data = self.redis.get(cache_key)
        if cached_data:
            return json.loads(cached_data)
        return {}


    def _get_cached_ticket_data(self, id: str) -> Optional[Dict[str, Any]]:
        """Get ticket data from cache"""
        try:
            cache_key = self._get_cache_key("ticket", id)
            cached_data = self.redis.get(cache_key)
            if cached_data:
                self.logger.debug(f"Cache hit for ticket {id}")
                return json.loads(cached_data)
            self.logger.debug(f"Cache miss for ticket {id}")
            return None
        except Exception as e:
            self.logger.error(f"Error getting cached data for ticket {id}: {e}")
            return None


    def _populate_cache(self) -> None:
        """Populate cache with all available scores"""
        try:
            # Get all vectors from Pinecone
            vectors = self.pinecone_service.list_all_vectors()
            
            scores = {}
            for vector in vectors:
                if '#' in vector.id:  # Ensure it's a comment vector
                    id = vector.id.split('#')[0]
                    if id not in scores:
                        scores[id] = {
                            'score': vector.metadata.get('emotion_score', 0),
                            'timestamp': vector.metadata.get('timestamp', 0)
                        }
            
            self._update_cache(scores)
            self.logger.info(f"Cache populated with {len(scores)} ticket scores")
            
        except Exception as e:
            self.logger.error(f"Error populating cache: {e}")


    def _process_comment_results(self, ticket: TicketInput, comment_results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Process comment results and return a list of processed results"""
        total_weighted_score = 0
        total_weight = 0
        lambda_factor = 1.0  # Decay rate
        all_scores = []
        results = []
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
                updated_at = None
                check, element_type = _check_element(ticket, 'updated_at')
                if check:
                    if element_type == 'dict':
                        updated_at = self._convert_date_to_timestamp(ticket.updated_at)
                    elif element_type == 'object':
                        updated_at = self._convert_date_to_timestamp(getattr(ticket, 'updated_at'))
                created_at = None
                check, element_type = _check_element(ticket, 'created_at')
                if check:
                    if element_type == 'dict':
                        created_at = self._convert_date_to_timestamp(ticket.created_at)
                    elif element_type == 'object':
                        created_at = self._convert_date_to_timestamp(getattr(ticket, 'created_at'))
                metadata = {
                    'score': calculated_score,
                    'status': ticket.status,
                    'updated_at': updated_at,
                    'created_at': created_at
                }
                    
                self._cache_ticket_data(ticket.id, metadata)
                results.append({
                    'id': ticket.id,
                    'score': calculated_score
                })
        return results

    def _return_render(self, template, view_type, session_token=None) -> Response:
        if view_type == 'Health':
            self.subdomain = 'health'
            self.original_query_string = ''

        try:
            response = make_response(render_template(
                template, 
                view_type=view_type,
                subdomain=self.subdomain,
                original_query_string=self.original_query_string
            ))
            self.logger.debug(f"Template rendered successfully for {view_type}")
            
            if session_token:
                response.set_cookie('session_token', session_token, secure=True, httponly=True, samesite='None')
                self.logger.debug(f"Cookie set successfully for {view_type}")
            
            return response
        except Exception as e:
            self.logger.error(f"Error rendering template: {str(e)}")
            raise

    def _return_response(self, data, status_code=200) -> Response:
        """Helper method to return response with session data if needed"""
        response = jsonify(data)
        response.status_code = status_code
        return response

    def _remove_ticket_from_cache(self, id: str):
        """Remove a ticket from cache"""
        cache_key = self._get_cache_key("ticket", id)
        self.redis.delete(cache_key)
        self.logger.info(f"Removed ticket {id} from cache")

    def _update_cache(self, scores: dict):
        """Update the cache with new scores"""
        cache_key = self._get_cache_key("sentiment_scores")
        self.redis.set(cache_key, json.dumps(scores), ex=self.cache_ttl)

    # Entry Points
    def sidebar(self):
        """
        Serve the sidebar for the Zendesk application.
        """
        self.init()
        self.logger.info(f"Sidebar request received from {self.remote_addr}")
        self.logger.info(f"Query string: {self.original_query_string}")
        
        template = f'{self.templates}/index.tmpl'
        view_type = 'Sidebar'
            
        self.logger.info(f"Using template: {template}")
        
        return self._return_render(template, view_type)


    def background_refresh(self):
        self.init()
        template = f'{self.templates}/index.tmpl'
        view_type = 'Background'
        
        return self._return_render(template, view_type)
    

    def topbar(self):
        self.init()
        self.logger.info(f"Received request for topbar, request remote addr: {self.remote_addr}")
        
        template = f'{self.templates}/index.tmpl'
        view_type = 'Top Bar'
        
        return self._return_render(template, view_type)


    def navbar(self):
        """Handle navbar requests"""
        self.init()
        self.logger.info(f"Received request for navbar, request remote addr: {self.remote_addr}")
        
        # Get the selected range from query params if any
        selected_range = request.args.get('range')
        self.logger.info(f"Selected range: {selected_range}")
        
        template = f'{self.templates}/index.tmpl'
        view_type = 'Nav Bar'
        
        return self._return_render(template, view_type, selected_range)



    # Analysis Methods
    def analyze_comments(self) -> Tuple[Response, int]:
        """Analyze comments for sentiment."""
        self.init()
        self.logger.info(f"Received request for analyze_comments")
        
        all_results = []
        for ticket in self.ticket_data:
            try:
                if not ticket.comments:
                    self.logger.warning(f"Missing comments in request data for ticket {ticket.id}")
                    continue
                # Process comments and get sentiment
                comment_results = []
                for comment in ticket.comments:
                    try:
                        result = self._analyze(ticket, comment)
                        if result:
                            comment_results.append(result)
                            self.logger.debug(f"Analyzed comment {comment.id} for ticket {ticket.id}: {result}")
                        else:
                            self.logger.warning(f"No result from analyze for comment {comment.id}")
                    except Exception as e:
                        self.logger.error(f"Error analyzing comment {comment.id}: {e}")
                        continue
                if not len(comment_results) > 0:
                    continue
                # Calculate overall ticket score from comment scores
                processed_comment_results = self._process_comment_results(ticket, comment_results)
                self.logger.info(f"Processed comment results for ticket {ticket.id}: {processed_comment_results}")
                all_results.extend(processed_comment_results)
            except Exception as e:
                self.logger.error(f"Error processing ticket {ticket.id}: {e}")
                return jsonify({'error': f"Error processing ticket {ticket.id}: {str(e)}"}), 500
        weighted_score = self.get_score(tickets=self.ticket_data).get_json().get('score')
        return jsonify({'results': len(all_results), 'weighted_score': weighted_score}), 200

    
    def check_namespace(self):
        """Check if a namespace exists in Pinecone for this tenant"""
        self.init()
        try:
            data = request.get_json()
            subdomain = data.get('subdomain')
        except Exception as e:
            self.logger.error(f"Error getting subdomain: {str(e)}")
            return jsonify({'error': str(e)}), 500
        # Check if namespace exists in Pinecone
        namespaces = self.pinecone_service.describe_index_stats()
        exists = subdomain in namespaces.get('namespaces', {})
        empty = namespaces.get('namespaces', {}).get(subdomain, {}).get('vector_count', 0) == 0
        if exists and empty:
            exists = False
        return jsonify({'exists': exists})

    def remove_ticket_from_cache(self):
        """Remove a ticket from cache"""
        self.init()
        self.logger.info(f"Received request for remove_ticket_from_cache, request remote addr: {self.remote_addr}")
        for ticket in self.ticket_data:   
            self._remove_ticket_from_cache(ticket.id)
        return jsonify({'message': 'Tickets removed from cache'}), 200

    def update_sentiment(self) -> Tuple[Response, int]:
        """Update sentiment for new comments on a ticket."""
        self.init()
        self.logger.info(f"Received request for update_sentiment")
        
        results = []
        for ticket in self.ticket_data:
            if not ticket.comments:
                self.logger.warning(f"Missing comments in request data for ticket {ticket.id}")
                continue
            
            existing_vectors = self.pinecone_service.list_ticket_vectors(ticket.id)
            existing_commentIds = set(vector['id'].split('#')[1] for vector in existing_vectors)
            new_comments = [comment for comment in ticket.comments 
                           if str(comment.commentId) not in existing_commentIds]
            
            for comment in new_comments:
                try:
                    created_at = None
                    check, element_type = _check_element(comment, 'created_at')
                    if check:
                        if element_type == 'dict':
                            created_at = self._convert_date_to_timestamp(comment.created_at)
                        elif element_type == 'object':
                            created_at = self._convert_date_to_timestamp(getattr(comment, 'created_at'))
                    author_id = None
                    check, element_type = _check_element(comment, 'author_id')
                    if check:
                        if element_type == 'dict':
                            author_id = comment.author_id
                        elif element_type == 'object':
                            author_id = getattr(comment, 'author_id')
                    formatted_comment = {
                        'id': str(comment.commentId),
                        'text': comment.text,
                        'created_at': created_at,
                        'author_id': author_id
                    }
                    result = self._analyze(ticket.id, formatted_comment)
                    if result:
                        results.append(result)
                except Exception as e:
                    self.logger.error(f"Error analyzing comment {comment.commentId}: {e}")
                    continue
        
        return self._return_response({
            'message': 'Sentiment updated successfully',
            'results': results,
            'new_comments_count': len(results)
        }), 200


    # Data Retrieval Methods
    def get_ticket_count(self) -> Tuple[Response, int]:
        """Get the number of tickets in the database"""
        self.init()
        ids = self.pinecone_service.list_ticket_ids()
        if ids:  
            data = {}
            sorted_ids = sorted(ids)
            data['count'] = len(ids)
            data['latest_ticket'] = sorted_ids[-1].id.split('#')[0]
            #return self._return_response(data), 200
            return data, 200
        else:
            return self._return_response({'error': 'No ticket ids found'}), 404


    def get_ticket_vectors(self) -> Tuple[Response, int]:
        """Get vectors for a ticket."""
        self.init()
        self.logger.info(f"Received request for get_ticket_vectors")
        
        results = {}
        for ticket in self.ticket_data:
            vectors = self.pinecone_service.list_ticket_vectors(ticket.id)
            
            comments = []
            for vector in vectors:
                if 'metadata' in vector:
                    comment = CommentResponse(
                        commentId=vector['id'].split('#')[1],
                        text=vector['metadata'].get('text'),
                        created_at=vector['metadata'].get('created_at'),
                        score=vector['metadata'].get('emotion_score'),
                        author_id=vector['metadata'].get('author_id')
                    )
                    comments.append(comment)
            
            ticket_response = TicketResponse(
                id=ticket.id,
                comments=comments,
                score=next((v['metadata'].get('score') for v in vectors 
                           if 'metadata' in v and 'score' in v['metadata']), None),
                status=next((v['metadata'].get('status') for v in vectors 
                           if 'metadata' in v and 'status' in v['metadata']), None),
                updated_at=next((v['metadata'].get('updated_at') for v in vectors 
                              if 'metadata' in v and 'updated_at' in v['metadata']), None),
                created_at=next((v['metadata'].get('created_at') for v in vectors 
                              if 'metadata' in v and 'created_at' in v['metadata']), None)
            )
            results[str(ticket.id)] = ticket_response.model_dump()
        
        return self._return_response({'vectors': results}), 200

    def get_score(self, tickets: List[TicketInput] = None, ticket: TicketInput = None) -> Tuple[Response, int]:
        """
        Get the weighted score of a ticket or multiple tickets based on the emotions of the comments.
        """
        self.init()
        self.logger.info(f"Received request for get_score, request remote addr: {self.remote_addr}")

        self.logger.debug(f"Processing {len(self.ticket_data)} tickets for score calculation, request remote addr: {self.remote_addr}")
        
        total_weighted_score = 0
        total_weight = 0
        lambda_factor = 1.0 # Adjust this value to control the decay rate
        all_scores = []
        if ticket:
            tickets = [ticket]
        elif not tickets:
            tickets = self.ticket_data

        for ticket in tickets:
            vector_ids, comment_vectors = [], []
            self.logger.info(f"Processing ticket: {ticket.id}, request remote addr: {self.remote_addr}")
            vector_list = self.pinecone_service.list_ticket_vectors(str(ticket.id))
            for vector in vector_list:
                vector_ids.append(vector.id if hasattr(vector, 'id') else vector.get('id'))
            response = self.pinecone_service.fetch_vectors(vector_ids)
            if len(response.values()) > 0:
                comment_vectors.append(response)
                #self.logger.debug(f"Fetched vectors: {comment_vectors}")
            else:
                self.logger.warning(f"No vectors found for ticket {ticket.id}") 
                continue

            if len(comment_vectors) == 0:
                self.logger.warning(f"No vectors found for tickets: {self.ticket_data}")
                self.logger.info(f"namespace: {self.pinecone_service.namespace}")
                return self._return_response({'score': 0}), 200

            sorted_vectors = sorted(comment_vectors[0].items(), key=lambda x: x[1]['metadata']['timestamp'], reverse=True)
            self.logger.debug(f"Sorted vectors: {sorted_vectors}")

            if sorted_vectors:
                newest_timestamp = sorted_vectors[0][1]['metadata']['timestamp']
                self.logger.debug(f"Newest timestamp: {newest_timestamp}")
                
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
        
        self.logger.info(f"Calculated weighted score for {len(tickets)} tickets: {weighted_score}, request remote addr: {self.remote_addr}")
        return self._return_response({'score': weighted_score})

    def get_scores(self) -> Tuple[Response, int]:
        """Get scores, using cache when possible"""
        self.init()
        self.logger.info(f"Received request for get_scores, request remote addr: {self.remote_addr}")

        scores = {}
        for ticket in self.ticket_data:
            try:
                # Try to get data from cache first
                cached_data = self._get_cached_ticket_data(ticket.id)
                if cached_data:
                    scores[ticket.id] = cached_data['score']
                    continue

                # If not in cache, calculate and cache it
                score_response, status_code = self.get_score(ticket)
                if status_code != 200:
                    self.logger.error(f"Error getting score for ticket {ticket.id}")
                    continue

                score_data = score_response.get_json()
                ticket_data = {
                    'score': score_data.get('score', 0),
                    'status': ticket.status,
                    'updated_at': ticket.updated_at,
                    'created_at': ticket.created_at,
                    'requestor': ticket.requestor,
                    'assignee': ticket.assignee
                }
                scores[ticket.id] = ticket_data['score']
                
                # Cache the new data
                self._cache_ticket_data(ticket.id, ticket_data)

            except Exception as e:
                self.logger.error(f"Error processing ticket {ticket.id}: {e}")
                continue

        return self._return_response({'scores': scores}), 200

    def get_unsolved_tickets(self) -> Tuple[Response, int]:
        """Get unsolved tickets from cache with pagination"""
        self.init()
        try:
            page = int(request.args.get('page', 1))
            per_page = int(request.args.get('per_page', 10))
            
            start_idx = (page - 1) * per_page
            end_idx = start_idx + per_page
            
            unsolved_key = f"{self.subdomain}:unsolved_tickets"
            ids = list(self.redis.smembers(unsolved_key))
            total_count = len(ids)
            
            page_ids = ids[start_idx:end_idx]
            
            tickets = []
            for id in page_ids:
                ticket_data = self._get_cached_ticket_data(id)
                if ticket_data:
                    # Convert timestamps back to ISO format for frontend
                    created_at = datetime.fromtimestamp(ticket_data.get('created_at', 0)).isoformat()
                    updated_at = datetime.fromtimestamp(ticket_data.get('updated_at', 0)).isoformat()
                    
                    tickets.append({
                        'id': id,
                        'score': ticket_data.get('score', 0),
                        'status': ticket_data.get('status', ''),
                        'created_at': created_at,
                        'updated_at': updated_at
                    })
            
            return self._return_response({
                'tickets': tickets,
                'total_count': total_count,
                'page': page,
                'per_page': per_page,
                'has_more': end_idx < total_count
            }), 200
            
        except Exception as e:
            self.logger.error(f"Error getting unsolved tickets from cache: {e}")
            return self._return_response({'error': str(e)}), 500

    # Health Check
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
            return self._return_response({'error': 'Pinecone service is not healthy'}), 500
            
        if not redis_healthy:
            self.logger.error(f"Redis health check failed, request remote addr: {remote_addr}")
            return self._return_response({'error': 'Redis service is not healthy'}), 500
            
        return self._return_render(f'{self.templates}/health.tmpl', 'Health')