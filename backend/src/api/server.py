from flask import Flask
from flask_session import Session
from flask_cors import CORS
import dotenv
import logging
import os
from .routes import api as api_blueprint

dotenv.load_dotenv()
logger = logging.getLogger(__name__)
app = Flask(__name__)
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY')
app.register_blueprint(api_blueprint)
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)
Session(app)

if __name__ == '__main__':
    app.run(debug=True)
