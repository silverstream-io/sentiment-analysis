from flask import Blueprint
from .views import index, health, analyze_comments, get_score, get_ticket_vectors
import logging

api = Blueprint('api', __name__)
logger = logging.getLogger('api.server')
logger.debug("Initializing API routes")

api.add_url_rule('/', 'index', index, methods=['GET'])
api.add_url_rule('/api/health', 'health', health, methods=['GET'])
api.add_url_rule('/api/analyze-comments', 'analyze_comments', analyze_comments, methods=['POST'])
api.add_url_rule('/api/get-score', 'get_score', get_score, methods=['POST'])
api.add_url_rule('/api/get-ticket-vectors', 'get_ticket_vectors', get_ticket_vectors, methods=['POST'])
