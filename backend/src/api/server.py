from flask import Flask, render_template
from flask_session import Session
from flask_cors import CORS
import dotenv
import logging
import os
import sys

dotenv.load_dotenv()
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger('sentiment_checker')

def create_app():
    app = Flask(__name__)
    app.template_folder = '../templates'
    app.static_folder = '../static'
    app.config['SESSION_TYPE'] = 'filesystem'
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY')
    app.config['SESSION_COOKIE_HTTPONLY'] = True
    app.config['SESSION_COOKIE_SECURE'] = True
    app.config['SESSION_COOKIE_SAMESITE'] = 'None'

    from .routes import create_blueprints
    root_blueprint, sentiment_checker_blueprint = create_blueprints()

    app.register_blueprint(root_blueprint)
    app.register_blueprint(sentiment_checker_blueprint)
    CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)
    Session(app)

    @app.errorhandler(404)
    def page_not_found(error):
        return render_template('errors/404.html'), 404

    return app

if __name__ == '__main__':
    debug_mode = os.environ.get('FLASK_DEBUG')
    if debug_mode:
        app = create_app()
        app.run(debug=debug_mode)
    else:
        app = create_app()
