from flask import Flask
from flask_cors import CORS
import dotenv
import logging

dotenv.load_dotenv()
logger = logging.getLogger(__name__)
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

if __name__ == '__main__':
    app.run(debug=True)
