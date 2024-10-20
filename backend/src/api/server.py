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
app.static_folder = '../static'
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY')
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'None'
app.register_blueprint(root_blueprint)
app.register_blueprint(sentiment_checker_blueprint)
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)
Session(app)

@app.errorhandler(404)
def page_not_found(error):
    return render_template('errors/404.html'), 404

if __name__ == '__main__':
    app.run(debug=True)
