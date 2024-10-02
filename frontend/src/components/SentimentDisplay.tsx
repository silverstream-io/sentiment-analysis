import React from 'react';
import { Sentiment } from '../types';

interface Props {
  sentiment: Sentiment;
}

const SentimentDisplay: React.FC<Props> = ({ sentiment }) => {
  const getColorClass = () => {
    switch (sentiment) {
      case 'extremely positive':
        return 'bg-green-500';
      case 'positive':
        return 'bg-green-300';
      case 'neutral':
        return 'bg-gray-300';
      case 'negative':
        return 'bg-red-300';
      case 'extremely negative':
        return 'bg-red-500';
    }
  };

  return (
    <div className={`p-4 rounded-lg ${getColorClass()}`}>
      <p className="text-lg font-semibold">Current Sentiment: {sentiment}</p>
    </div>
  );
};

export default SentimentDisplay;