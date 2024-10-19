from flask import Blueprint
from .views import index, health, analyze_comments, get_score, get_ticket_vectors, entry
import logging

logger = logging.getLogger('api.server')
logger.debug("Initializing routes")

root = Blueprint('root', __name__)
root.add_url_rule('/', 'index', index)

logger.debug("Initializing sentiment-checker routes")
sentiment_checker = Blueprint('sentiment-checker', __name__, url_prefix='/sentiment-checker')
sentiment_checker.add_url_rule('/health', 'health', health, methods=['GET'])
sentiment_checker.add_url_rule('/analyze-comments', 'analyze_comments', analyze_comments, methods=['POST'])
sentiment_checker.add_url_rule('/get-score', 'get_score', get_score, methods=['POST'])
sentiment_checker.add_url_rule('/get-ticket-vectors', 'get_ticket_vectors', get_ticket_vectors, methods=['POST'])
sentiment_checker.add_url_rule('/', 'entry', entry, methods=['POST'])
