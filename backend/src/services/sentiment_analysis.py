from api.zendesk import ZendeskAPI
from services.openai_service import analyze_sentiment

def analyze_tickets_sentiment(view_id):
    zendesk = ZendeskAPI()
    tickets = zendesk.get_tickets_from_view(view_id)
    results = []

    for ticket in tickets:
        history = zendesk.get_ticket_history(ticket['id'])
        sentiment = analyze_sentiment(history)
        results.append({
            'ticket_id': ticket['id'],
            'created_at': ticket['created_at'],
            'sentiment': sentiment
        })

    return results