import React, { useEffect, useRef } from 'react';
import { Sentiment } from '../types';

interface Props {
  sentiment: number;
  greyscale?: boolean;
}
const SentimentDisplay: React.FC<Props> = ({ sentiment, greyscale = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = 200;  // Reduce canvas width
        canvas.height = 120; // Reduce canvas height
        drawHalfCircle(ctx, canvas);
        drawPointer(ctx, canvas, getSentimentDegree(sentiment));
      }
    }
  }, [sentiment, greyscale]);

  const drawHalfCircle = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const centerX = canvas.width / 2;
    const centerY = canvas.height - 10; // Adjust to position flat side closer to bottom
    const radius = 90; // Reduce radius size
    const wedges = 5;
    const wedgeAngle = Math.PI / wedges;
    const colors = greyscale
      ? ['#333333', '#666666', '#999999', '#CCCCCC', '#FFFFFF']
      : ['red', 'orange', 'yellow', 'lightgreen', 'green'];
    const sentiments = [-2, -1, 0, 1, 2];

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

      // Add smaller text
      const midAngle = Math.PI + (i + 0.5) * wedgeAngle;
      const textX = centerX + (radius * 0.7) * Math.cos(midAngle);
      const textY = centerY + (radius * 0.7) * Math.sin(midAngle);
      ctx.fillStyle = greyscale ? (i < 2 ? 'white' : 'black') : 'black';
      ctx.font = '8px Arial'; // Reduce font size
      ctx.textAlign = 'center';
      ctx.fillText(sentiments[i].toString(), textX, textY);
    }
  };

  const drawPointer = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, degree: number) => {
    const centerX = canvas.width / 2;
    const centerY = canvas.height - 10;
    const radius = 90; // Same as the half-circle radius
    const radian = (Math.PI * degree) / 180;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawHalfCircle(ctx, canvas);

    // Calculate end point of the pointer (80% through the semi-circle)
    const endX = centerX + (radius * 0.8) * Math.cos(Math.PI + radian);
    const endY = centerY + (radius * 0.8) * Math.sin(Math.PI + radian);

    // Draw the main line
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw the arrow tip
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

  const getSentimentDegree = (sentiment: number): number => {
    // Map sentiment from [-2, 2] to [0, 180]
    return ((sentiment + 2) / 4) * 180;
  };

  return (
    <div>
      <canvas ref={canvasRef} width={400} height={200} aria-label={`Sentiment meter showing ${sentiment}`} />
      {/* <p className="text-lg font-semibold mt-2">Current Sentiment: {sentiment}</p> */}
    </div>
  );
};

export default SentimentDisplay;
