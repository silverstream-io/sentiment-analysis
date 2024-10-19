from flask import Flask, render_template
from flask_session import Session
from flask_cors import CORS
import dotenv
import logging
import os
from .routes import root as root_blueprint, sentiment_checker as sentiment_checker_blueprint

dotenv.load_dotenv()
logger = logging.getLogger(__name__)
app = Flask(__name__)
app.template_folder = '../templates'
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY')
app.register_blueprint(root_blueprint, template_folder='../templates/root')
app.register_blueprint(sentiment_checker_blueprint, template_folder='../templates/sentiment-checker')
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)
Session(app)

@app.errorhandler(404)
def page_not_found(error):
    return render_template('errors/404.html'), 404

if __name__ == '__main__':
    app.run(debug=True)
