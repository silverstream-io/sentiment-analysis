import openai
import dotenv, os
import logging

dotenv.load_dotenv()
logger = logging.getLogger('sentiment_checker')

openai.api_key = os.getenv("OPENAI_API_KEY")

def analyze_sentiment(text):
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": "You are a sentiment analysis expert. Categorize the following text into one of these categories: extremely positive, positive, neutral, negative, or extremely negative. Only respond with the category name."},
            {"role": "user", "content": text}
        ]
    )
    return response.choices[0].message['content'].strip().lower()