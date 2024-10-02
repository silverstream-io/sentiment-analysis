from collections import Counter
import matplotlib.pyplot as plt
from datetime import datetime

def generate_report(sentiment_results):
    # Time series chart
    dates = [datetime.fromisoformat(result['created_at'].replace('Z', '+00:00')) for result in sentiment_results]
    sentiments = [result['sentiment'] for result in sentiment_results]
    
    plt.figure(figsize=(12, 6))
    plt.plot(dates, sentiments, marker='o')
    plt.title('Sentiment Over Time')
    plt.xlabel('Date')
    plt.ylabel('Sentiment')
    plt.savefig('sentiment_over_time.png')
    plt.close()

    # Sentiment distribution chart
    sentiment_counts = Counter(sentiments)
    labels = sentiment_counts.keys()
    sizes = sentiment_counts.values()

    plt.figure(figsize=(8, 8))
    plt.pie(sizes, labels=labels, autopct='%1.1f%%', startangle=90)
    plt.axis('equal')
    plt.title('Sentiment Distribution')
    plt.savefig('sentiment_distribution.png')
    plt.close()

    # Generate report text
    report_text = "Sentiment Analysis Report\n\n"
    report_text += f"Total tickets analyzed: {len(sentiment_results)}\n\n"
    for sentiment, count in sentiment_counts.items():
        report_text += f"{sentiment.capitalize()}: {count} ({count/len(sentiment_results)*100:.1f}%)\n"

    return report_text