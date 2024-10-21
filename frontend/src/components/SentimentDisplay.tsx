import React, { useEffect, useRef } from 'react';
import { SentimentRange, MIN_SENTIMENT, MAX_SENTIMENT } from '../types';

interface Props {
  sentiment: SentimentRange;
  greyscale?: boolean;
}
const SentimentDisplay: React.FC<Props> = ({ sentiment, greyscale = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = 200;
        canvas.height = 120;
        drawHalfCircle(ctx, canvas);
        drawPointer(ctx, canvas, getSentimentDegree(sentiment));
      }
    }
  }, [sentiment, greyscale]);

  const drawHalfCircle = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const centerX = canvas.width / 2;
    const centerY = canvas.height - 10;
    const radius = 90;
    const wedges = 5;
    const wedgeAngle = Math.PI / wedges;
    const colors = greyscale
      ? ['#333333', '#666666', '#999999', '#CCCCCC', '#FFFFFF']
      : ['red', 'orange', 'yellow', 'lightgreen', 'green'];

    for (let i = 0; i < wedges; i++) {
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(
        centerX,
        centerY,
        radius,
        Math.PI + i * wedgeAngle,
        Math.PI + (i + 1) * wedgeAngle,
      );
      ctx.closePath();
      ctx.fillStyle = colors[i];
      ctx.fill();
    }
  };

  const drawPointer = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, degree: number) => {
    const centerX = canvas.width / 2;
    const centerY = canvas.height - 10;
    const radius = 90;
    const radian = (Math.PI * degree) / 180;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawHalfCircle(ctx, canvas);

    const endX = centerX + (radius * 0.8) * Math.cos(Math.PI + radian);
    const endY = centerY + (radius * 0.8) * Math.sin(Math.PI + radian);

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    ctx.stroke();

    const arrowSize = 5;
    const angle = Math.PI + radian;
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - arrowSize * Math.cos(angle - Math.PI / 6),
      endY - arrowSize * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      endX - arrowSize * Math.cos(angle + Math.PI / 6),
      endY - arrowSize * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fillStyle = 'black';
    ctx.fill();
  };

  const getSentimentDegree = (sentiment: SentimentRange): number => {
    const normalizedSentiment = (sentiment - MIN_SENTIMENT) / (MAX_SENTIMENT - MIN_SENTIMENT);
    return normalizedSentiment * 180;
  };

  return (
    <div>
      <canvas ref={canvasRef} width={400} height={200} aria-label={`Sentiment meter showing ${sentiment}`} />
    </div>
  );
};

export default SentimentDisplay;
