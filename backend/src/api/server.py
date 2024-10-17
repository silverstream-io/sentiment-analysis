from flask import Flask
from flask_cors import CORS
import dotenv
import logging
from .routes import api as api_blueprint

dotenv.load_dotenv()
logger = logging.getLogger(__name__)
app = Flask(__name__)
app.register_blueprint(api_blueprint)
CORS(app, resources={r"/api/*": {"origins": "*"}})

if __name__ == '__main__':
    app.run(debug=True)
