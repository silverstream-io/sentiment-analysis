import OpenAI from 'openai';

let openai: OpenAI;

export const OpenAIService = {
  initialize(apiKey: string) {
    openai = new OpenAI({ apiKey });
  },

  async getEmbedding(text: string) {
    if (!openai) {
      throw new Error('OpenAI service not initialized');
    }
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  },
};