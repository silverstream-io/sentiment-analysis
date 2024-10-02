import requests
import dotenv, os

dotenv.load_dotenv()

class ZendeskAPI:
    def __init__(self):
        self.base_url = f"https://{os.getenv("ZENDESK_SUBDOMAIN")}.zendesk.com/api/v2"
        self.auth = (f"{os.getenv("ZENDESK_EMAIL")}/token", os.getenv("ZENDESK_API_TOKEN"))

    def get_tickets_from_view(self, view_id):
        url = f"{self.base_url}/views/{view_id}/tickets.json"
        response = requests.get(url, auth=self.auth)
        response.raise_for_status()
        return response.json()['tickets']

    def get_ticket_comments(self, ticket_id):
        url = f"{self.base_url}/tickets/{ticket_id}/comments.json"
        response = requests.get(url, auth=self.auth)
        response.raise_for_status()
        return response.json()['comments']

    def get_ticket_history(self, ticket_id):
        ticket = self.get_tickets_from_view(ticket_id)[0]
        comments = self.get_ticket_comments(ticket_id)
        
        history = ticket['description']
        for comment in comments:
            if not comment['public']:  # Skip agent comments
                continue
            history += f"\n\n{comment['body']}"
        
        return history