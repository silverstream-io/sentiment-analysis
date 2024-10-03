import React from 'react';
import { Sentiment } from '../types';

interface SentimentWheelProps {
  sentiment: Sentiment;
}

const SentimentWheel: React.FC<SentimentWheelProps> = ({ sentiment }) => {
  const getGradient = (sentiment: Sentiment) => {
    switch (sentiment) {
      case 'extremely positive': return 'from-green-500 to-green-300';
      case 'positive': return 'from-green-400 to-green-200';
      case 'neutral': return 'from-gray-400 to-gray-200';
      case 'negative': return 'from-red-400 to-red-200';
      case 'extremely negative': return 'from-red-500 to-red-300';
      default: return 'from-gray-400 to-gray-200';
    }
  };

  console.log('Rendering SentimentWheel with sentiment:', sentiment);

  return (
    <div 
      className={`w-24 h-24 rounded-full flex items-center justify-center bg-gradient-to-br ${getGradient(sentiment)}`}
    />
  );
};

export default SentimentWheel;