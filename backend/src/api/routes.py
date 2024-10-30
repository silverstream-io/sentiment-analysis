from flask import Blueprint
from .views import Root, SentimentChecker
import logging

logger = logging.getLogger('sentiment_checker')

def create_blueprints():
    logger.debug("Initializing routes")

    root_obj = Root()
    root = Blueprint('root', __name__)
    root.add_url_rule('/', 'index', root_obj.index)
    root.add_url_rule('/health', 'health', root_obj.health, methods=['GET'])

    logger.debug("Initializing sentiment-checker routes")
    sentiment_checker_obj = SentimentChecker()
    sentiment_checker = Blueprint('sentiment-checker', __name__, url_prefix='/sentiment-checker')

    # Entry routes
    sentiment_checker.add_url_rule('/', 'sidebar', sentiment_checker_obj.sidebar, methods=['POST'])
    sentiment_checker.add_url_rule('', 'sidebar', sentiment_checker_obj.sidebar, methods=['POST'])
    sentiment_checker.add_url_rule('/background-refresh', 'background_refresh', sentiment_checker_obj.background_refresh, methods=['POST'])
    sentiment_checker.add_url_rule('/topbar', 'topbar', sentiment_checker_obj.topbar, methods=['POST'])
    sentiment_checker.add_url_rule('/navbar', 'navbar', sentiment_checker_obj.navbar, methods=['POST'])

    # Health checks 
    sentiment_checker.add_url_rule('/health', 'health', sentiment_checker_obj.health, methods=['GET'])
    
    # API routes
    sentiment_checker.add_url_rule('/analyze-comments', 'analyze_comments', sentiment_checker_obj.analyze_comments, methods=['POST'])
    sentiment_checker.add_url_rule('/get-ticket-vectors', 'get_ticket_vectors', sentiment_checker_obj.get_ticket_vectors, methods=['POST'])
    sentiment_checker.add_url_rule('/get-unsolved-tickets', 'get_unsolved_tickets', sentiment_checker_obj.get_unsolved_tickets, methods=['POST'])
    sentiment_checker.add_url_rule('/get-score', 'get_score', sentiment_checker_obj.get_score, methods=['POST'])
    sentiment_checker.add_url_rule('/get-scores', 'get_scores', sentiment_checker_obj.get_scores, methods=['POST'])
    sentiment_checker.add_url_rule('/check-namespace', 'check_namespace', sentiment_checker_obj.check_namespace, methods=['POST'])
    sentiment_checker.add_url_rule('/get-ticket-count', 'get_ticket_count', sentiment_checker_obj.get_ticket_count, methods=['GET'])

    return root, sentiment_checker
