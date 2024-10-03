import { Pinecone } from '@pinecone-database/pinecone';

export class PineconeService {
  private client: Pinecone;
  private index: any;
  private namespace: string = '';
  private initialized: boolean = false;

  private constructor(apiKey: string, indexName: string) {
    this.client = new Pinecone({
      apiKey: apiKey,
    });
    this.index = this.client.Index(indexName);
  }

  static async create(apiKey: string, indexName: string, namespace: string): Promise<PineconeService> {
    const service = new PineconeService(apiKey, indexName);
    service.namespace = namespace;
    await service.initialize();
    return service;
  }

  private async initialize() {
    // Any additional initialization logic
    this.initialized = true;
  }

  private ensureInitialized() {
    if (!this.initialized) {
      throw new Error('PineconeService is not initialized. Please use PineconeService.create() to create an instance.');
    }
  }

  async getVectorsForTicket(ticketId: string) {
    this.ensureInitialized();
    const response = await this.index.list({
      prefix: `${ticketId}#`,
      namespace: this.namespace,
    });
    return response.vectors;
  }

  async querySimilarVectorsByVectorId(vectorId: string, topK: number = 5) {
    this.ensureInitialized();
    const response = await this.index.query({
      id: vectorId,
      topK,
      namespace: this.namespace,
    });
    return response.matches;
  }

  async querySimilarVectorsByVector(vector: number[], topK: number = 5) {
    this.ensureInitialized();
    const response = await this.index.query({
      vector,
      topK,
      namespace: this.namespace,
    });
    return response.matches;
  }

  async getNextCommentIndex(ticketId: string): Promise<string> {
    this.ensureInitialized();
    let allVectors: string[] = [];
    let nextPageToken: string | null = null;
    do {
      const results: any = await this.index.listPaginated({
        prefix: `${ticketId}#`,
        paginationToken: nextPageToken,
      });

      allVectors = allVectors.concat(results.vectors);
      nextPageToken = results.paginationToken;
    } while (nextPageToken);

    if (allVectors.length === 0) {
      return '1';
    }

    const lastIndex = Math.max(
      ...allVectors.map(vectorId => {
        const parts = vectorId.split('#');
        return parseInt(parts[parts.length - 1], 10);
      })
    );

    return (lastIndex + 1).toString();
  }

  async upsertVector(id: string, vector: number[], metadata: any) {
    this.ensureInitialized();
    try {
      const response = await this.index.upsert({
        vectors: [
          {
            id,
            values: vector,
            metadata,
          },
        ],
        namespace: this.namespace,
      });
      return response;
    } catch (error) {
      console.error('Error upserting vector:', error);
      throw error;
    }
  }
}

// Export a function to create the PineconeService instance
export const createPineconeService = async (apiKey: string, indexName: string, namespace: string): Promise<PineconeService> => {
  return PineconeService.create(apiKey, indexName, namespace);
};
