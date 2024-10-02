import OpenAI from 'openai';
import { Comment, Sentiment } from '../types';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function analyzeSentiment(comments: Comment[]): Promise<Sentiment> {
  const customerComments = comments
    .filter(comment => comment.isCustomer)
    .map(comment => comment.text)
    .join('\n\n');

  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: 'You are a sentiment analysis expert. Categorize the following text into one of these categories: extremely positive, positive, neutral, negative, or extremely negative. Only respond with the category name.' },
      { role: 'user', content: customerComments },
    ],
  });

  return response.choices[0].message.content?.toLowerCase() as Sentiment;
}