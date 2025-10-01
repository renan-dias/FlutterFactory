import React, { useRef, useEffect, useState } from 'react';

interface InputCanvasProps {
  width: number;
  height: number;
  onDraw: (dataUrl: string) => void;
}

export const InputCanvas: React.FC<InputCanvasProps> = ({ width, height, onDraw }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const context = canvas.getContext('2d');
      if (context) {
        context.lineCap = 'round';
        context.strokeStyle = '#64ffda'; // blueprint-line
        context.lineWidth = 3;
        setCtx(context);
      }
    }
  }, []);
  
  const startDrawing = ({ nativeEvent }: React.MouseEvent<HTMLCanvasElement>) => {
    if (!ctx) return;
    const { offsetX, offsetY } = nativeEvent;
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY);
    setIsDrawing(true);
  };

  const finishDrawing = () => {
    if (!ctx) return;
    ctx.closePath();
    setIsDrawing(false);
    if(canvasRef.current){
        onDraw(canvasRef.current.toDataURL('image/png'));
    }
  };

  const draw = ({ nativeEvent }: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !ctx) return;
    const { offsetX, offsetY } = nativeEvent;
    ctx.lineTo(offsetX, offsetY);
    ctx.stroke();
  };
  
  const clearCanvas = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!ctx || !canvasRef.current) return;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    onDraw('');
  }

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onMouseDown={startDrawing}
        onMouseUp={finishDrawing}
        onMouseLeave={finishDrawing}
        onMouseMove={draw}
        className="w-full h-full bg-transparent cursor-crosshair"
      />
      <button onClick={clearCanvas} className="absolute top-2 right-2 p-2 rounded-md bg-blueprint-bg-light border border-blueprint-border hover:bg-blueprint-border text-blueprint-text-dark hover:text-blueprint-text-light transition-colors">
        Limpar
      </button>
    </div>
  );
};