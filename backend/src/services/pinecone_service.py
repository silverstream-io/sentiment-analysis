from pinecone.grpc import PineconeGRPC as Pinecone
from openai import OpenAI
import dotenv, os
from datetime import datetime
import logging

dotenv.load_dotenv()
logger = logging.getLogger('sentiment_checker')

class PineconeService:
    def __init__(self, subdomain=None):
        self.pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
        self.index = self.pc.Index(os.getenv("PINECONE_INDEX_NAME"))
        self.namespace = subdomain
        self.openai_client = OpenAI()
    
    def describe_index_stats(self):
        return self.index.describe_index_stats()


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


    def query_vectors(self, vector, top_k=10, namespace=None, include_metadata=False, include_values=False):
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
        prefix = ""
        pagination_token = None
        if ticket_id:
            prefix = f"{ticket_id}#"
        response = self.index.list_paginated(prefix=prefix, namespace=self.namespace)
        vectors.extend(response.vectors)
        while response.pagination and len(vectors) < 1000: # Cap total number of vectors to 1000
            try:
                response = self.index.list_paginated(
                    prefix=ticket_id,
                    namespace=self.namespace,
                    pagination_token=pagination_token
                )
                vectors.extend(response.vectors)
            except Exception as e:
                logger.error(f"Error listing vectors: {e}")
                break
            if not response.pagination:
                break  

            pagination_token = response.pagination.next
        return vectors


    def list_ticket_ids(self):
        vectors = self.list_ticket_vectors()
        return [vector['id'].split('#')[0] for vector in vectors]


    def fetch_vectors(self, vector_ids, namespace=None, include_metadata=True, include_values=False):
        vectors = {}
        if not namespace:
            namespace = self.namespace
        for i in range(0, len(vector_ids), 1000):
            batch = vector_ids[i:i+1000]
            fetch_response = self.index.fetch(ids=[str(id) for id in batch], namespace=namespace)
            for id, vector in fetch_response.vectors.items():
                vectors[id] = {
                    "id": id,
                    "values": vector.values if include_values else None,
                    "metadata": vector.metadata if include_metadata else None
                }
        return vectors


    def fetch_vector(self, vector_id, namespace=None):
        fetch_response = self.index.fetch(ids=[vector_id], namespace=namespace)
        return fetch_response.vectors[vector_id]


    def check_health(self):
        return self.pc.describe_index(self.index.name)
