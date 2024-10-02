from pinecone.grpc import PineconeGRPC as Pinecone
from openai import OpenAI
import dotenv, os

dotenv.load_dotenv()
class PineconeService:
    def __init__(self, customer_id):
        self.pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
        self.index = self.pc.Index(os.getenv("PINECONE_INDEX_NAME"))
        self.namespace = customer_id
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

    def query_vectors(self, vector, top_k=5):
        query_response = self.index.query(
            vector=vector,
            top_k=top_k,
            namespace=self.namespace
        )
        return query_response.matches
