from services.sentiment_analysis import analyze_tickets_sentiment
from services.report_generator import generate_report
from utils.email_sender import send_email

def main():
    view_id = 12345  # Replace with your actual view ID
    sentiment_results = analyze_tickets_sentiment(view_id)
    report = generate_report(sentiment_results)

    recipients = ['admin@example.com']  # Replace with actual recipients
    subject = 'Sentiment Analysis Report'
    attachments = ['sentiment_over_time.png', 'sentiment_distribution.png']

    send_email(recipients, subject, report, attachments)

if __name__ == "__main__":
    main()