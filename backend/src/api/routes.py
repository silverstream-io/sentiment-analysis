from flask import Blueprint
from .views import index, health, analyze_comments, get_score, get_ticket_vectors, entry
import logging

api = Blueprint('api', __name__)
logger = logging.getLogger('api.server')
logger.debug("Initializing API routes")

api.add_url_rule('/', 'index', index)
api.add_url_rule('/sentiment-checker/health', 'health', health, methods=['GET'])
api.add_url_rule('/sentiment-checker/analyze-comments', 'analyze_comments', analyze_comments, methods=['POST'])
api.add_url_rule('/sentiment-checker/get-score', 'get_score', get_score, methods=['POST'])
api.add_url_rule('/sentiment-checker/get-ticket-vectors', 'get_ticket_vectors', get_ticket_vectors, methods=['POST'])
api.add_url_rule('/sentiment-checker/entry', 'entry', entry, methods=['POST'])
