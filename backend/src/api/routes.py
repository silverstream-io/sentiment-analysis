from flask import Blueprint
from .views import Root, SentimentChecker
import logging

logger = logging.getLogger('api.server')
logger.debug("Initializing routes")

root = Blueprint('root', __name__)
root.template_folder = '../templates/root'
root.add_url_rule('/', 'index', Root.index)
root.add_url_rule('/health', 'health', Root.health, methods=['GET'])


logger.debug("Initializing sentiment-checker routes")
sentiment_checker = Blueprint('sentiment-checker', __name__, url_prefix='/sentiment-checker')
sentiment_checker.template_folder = '../templates/sentiment-checker'
sentiment_checker.add_url_rule('/analyze-comments', 'analyze_comments', SentimentChecker.analyze_comments, methods=['POST'])
sentiment_checker.add_url_rule('/get-score', 'get_score', SentimentChecker.get_score, methods=['POST'])
sentiment_checker.add_url_rule('/get-ticket-vectors', 'get_ticket_vectors', SentimentChecker.get_ticket_vectors, methods=['POST'])
sentiment_checker.add_url_rule('/', 'entry', SentimentChecker.entry, methods=['POST'])
sentiment_checker.add_url_rule('', 'entry', SentimentChecker.entry, methods=['POST'])
