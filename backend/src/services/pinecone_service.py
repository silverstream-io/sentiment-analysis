from pinecone.grpc import PineconeGRPC as Pinecone
from openai import OpenAI
import dotenv, os
from datetime import datetime

dotenv.load_dotenv()
class PineconeService:
    def __init__(self, subdomain):
        self.pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
        self.index = self.pc.Index(os.getenv("PINECONE_INDEX_NAME"))
        self.namespace = subdomain
        self.openai_client = OpenAI()

    def get_embedding(self, text):
        response = self.openai_client.embeddings.create(
            model="text-embedding-3-small",
            input=text
        )
        return response.data[0].embedding

    def upsert_vector(self, id, vector, metadata):
        upsert_response = self.index.upsert(
            vectors=[
                {
                    "id": id,
                    "values": vector,
                    "metadata": metadata
                }
            ],
            namespace=self.namespace
        )
        return upsert_response

    def query_vectors(self, vector, top_k=5, namespace=None, include_metadata=False, include_values=False):
        if not namespace:
            namespace = self.namespace
        query_response = self.index.query(
            vector=vector,
            top_k=top_k,
            namespace=namespace,
            include_metadata=include_metadata,
            include_values=include_values
        )
        return query_response.matches

    def get_comment_ids(self, ticket_id):
        query_response = self.index.query(
            vector=[0] * 1536,  # Dummy vector, we're only interested in metadata
            filter={"ticket_id": ticket_id},
            top_k=10000,
            include_metadata=True,
            namespace=self.namespace
        )
        return [match.id.split('#')[1] for match in query_response.matches]

    def get_vector_ids_by_date_range(self, start_date, end_date):
        start_timestamp = int(datetime.fromisoformat(start_date).timestamp())
        end_timestamp = int(datetime.fromisoformat(end_date).timestamp())
        query_response = self.index.query(
            vector=[0] * 1536,  # Dummy vector, we're only interested in metadata
            filter={"timestamp": {"$gte": start_timestamp, "$lte": end_timestamp}},
            top_k=10000,
            include_metadata=True,
            include_values=False,
            namespace=self.namespace
        )
        return [match.id for match in query_response.matches]

    def list_ticket_vectors(self, ticket_id=None):
        vectors = []
        if ticket_id:
            ticket_id = f"{ticket_id}#"
        response = self.index.list_paginated(prefix=ticket_id, namespace=self.namespace)
        vectors.extend(response.vectors)
        while response.pagination and len(vectors) < 1000:
            response = self.index.list_paginated(prefix=ticket_id, namespace=self.namespace, pagination_token=response.pagination.next)
            vectors.extend(response.vectors)
        return vectors

    def fetch_vectors(self, vector_ids, namespace=None):
        vectors = {}
        if not namespace:
            namespace = self.namespace
        for i in range(0, len(vector_ids), 1000):
            batch = vector_ids[i:i+1000]
            fetch_response = self.index.fetch(ids=list(batch), namespace=namespace)
            vectors.update(fetch_response.vectors)
        return vectors