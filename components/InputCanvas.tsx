import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Icon } from './Icon';

interface InputCanvasProps {
  width: number;
  height: number;
  onDraw: (dataUrl: string) => void;
}

type Tool = 'pen' | 'eraser' | 'text' | 'move';
type ComponentType = 'header' | 'button' | 'input' | 'card' | 'fab' | 'list' | 'image' | 'screen';

// Define structure for UI Elements
interface UIElement {
    id: string;
    type: ComponentType;
    x: number;
    y: number;
    w: number;
    h: number;
    text?: string; // For annotations or default labels
}

// Define structure for Freehand Lines
interface DrawingPath {
    points: {x: number, y: number}[];
    isEraser: boolean;
}

export const InputCanvas: React.FC<InputCanvasProps> = ({ width, height, onDraw }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [tool, setTool] = useState<Tool>('pen');
  const [isDrawing, setIsDrawing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Object State
  const [elements, setElements] = useState<UIElement[]>([]);
  const [drawings, setDrawings] = useState<DrawingPath[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  
  // History Stack (Stores snapshots of elements and drawings)
  const [history, setHistory] = useState<{elements: UIElement[], drawings: DrawingPath[]}[]>([]);

  // Text Input State
  const [textInput, setTextInput] = useState<{x: number, y: number, visible: boolean, value: string} | null>(null);

  // Offset for dragging
  const dragOffset = useRef<{x: number, y: number}>({x: 0, y: 0});

  // --- Rendering Engine ---

  const renderCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 1. Clear Canvas
      ctx.clearRect(0, 0, width, height);
      
      // 2. Fill Background
      ctx.fillStyle = '#0a192f';
      ctx.fillRect(0, 0, width, height);

      // 3. Draw Grid
      drawGrid(ctx, width, height);

      // 4. Draw UI Elements (Screens first, then others)
      // Sort so 'screen' is always at the back
      const sortedElements = [...elements].sort((a, b) => {
          if (a.type === 'screen' && b.type !== 'screen') return -1;
          if (a.type !== 'screen' && b.type === 'screen') return 1;
          return 0;
      });

      sortedElements.forEach(el => {
          drawElement(ctx, el, selectedElementId === el.id);
      });

      // 5. Draw Freehand Drawings
      drawings.forEach(path => {
          if (path.points.length < 2) return;
          ctx.beginPath();
          ctx.moveTo(path.points[0].x, path.points[0].y);
          for (let i = 1; i < path.points.length; i++) {
              ctx.lineTo(path.points[i].x, path.points[i].y);
          }
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          if (path.isEraser) {
             // Eraser in this layer mode essentially paints background color over lines
             // Note: This doesn't erase 'Elements', only other drawings if using layers.
             // For simplicity in this hybrid mode, eraser paints background.
             ctx.globalCompositeOperation = 'source-over';
             ctx.strokeStyle = '#0a192f';
             ctx.lineWidth = 20;
          } else {
             ctx.globalCompositeOperation = 'source-over';
             ctx.strokeStyle = '#64ffda';
             ctx.lineWidth = 3;
          }
          ctx.stroke();
          ctx.globalCompositeOperation = 'source-over'; // Reset
      });
      
      // Save image for parent component
      const dataUrl = canvas.toDataURL();
      // Using timeout to avoid rapid state updates causing lag during drag/draw
      // onDraw(dataUrl); 
  }, [elements, drawings, selectedElementId, width, height]);

  useEffect(() => {
      renderCanvas();
      // Debounce the onDraw callback
      const timeoutId = setTimeout(() => {
          if(canvasRef.current) onDraw(canvasRef.current.toDataURL());
      }, 500);
      return () => clearTimeout(timeoutId);
  }, [renderCanvas, onDraw]);

  const drawGrid = (context: CanvasRenderingContext2D, w: number, h: number) => {
      context.strokeStyle = 'rgba(100, 255, 218, 0.05)';
      context.lineWidth = 1;
      const gridSize = 30;
      context.beginPath();
      for(let x = 0; x <= w; x += gridSize) {
          context.moveTo(x, 0);
          context.lineTo(x, h);
      }
      for(let y = 0; y <= h; y += gridSize) {
          context.moveTo(0, y);
          context.lineTo(w, y);
      }
      context.stroke();
  }

  const drawElement = (ctx: CanvasRenderingContext2D, el: UIElement, isSelected: boolean) => {
      const { x, y, w, h, type, text } = el;
      
      ctx.strokeStyle = isSelected ? '#e06c75' : '#64ffda'; // Highlight if selected
      ctx.lineWidth = isSelected ? 2 : 2;
      ctx.fillStyle = '#112240';

      // Helper to draw centered text
      const drawText = (txt: string, offsetY = 0, size = 12, color = '#8892b0') => {
        ctx.fillStyle = color;
        ctx.font = `${size}px "Roboto", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(txt, x, y + offsetY);
        ctx.fillStyle = '#112240'; // Reset fill
      }

      // Translate center x,y to top-left for easier rect drawing
      const lx = x - w / 2;
      const ly = y - h / 2;

      switch(type) {
          case 'screen':
              ctx.fillStyle = '#0a192f'; // Dark background for screen
              // Phone Bezel
              ctx.beginPath();
              ctx.roundRect(lx, ly, w, h, 20);
              ctx.fill();
              ctx.stroke();
              
              // Screen Area
              ctx.fillStyle = '#112240'; // Lighter screen bg
              ctx.beginPath();
              ctx.rect(lx + 10, ly + 40, w - 20, h - 80);
              ctx.fill();
              ctx.stroke();
              
              // Notch/Camera
              ctx.beginPath();
              ctx.arc(x, ly + 20, 4, 0, Math.PI * 2);
              ctx.fillStyle = '#64ffda';
              ctx.fill();
              
              // Home Indicator
              ctx.beginPath();
              ctx.moveTo(x - 30, ly + h - 20);
              ctx.lineTo(x + 30, ly + h - 20);
              ctx.lineWidth = 4;
              ctx.stroke();
              ctx.lineWidth = isSelected ? 2 : 2; // Reset
              
              drawText("Screen", -h/2 + 15, 10, '#64ffda');
              break;
          case 'header':
              ctx.fillRect(lx, ly, w, h);
              ctx.strokeRect(lx, ly, w, h);
              drawText("Header", 0, 16);
              ctx.strokeRect(lx + 10, ly + 15, 20, 20); // Menu icon
              break;
          case 'button':
              ctx.beginPath();
              ctx.roundRect(lx, ly, w, h, 4);
              ctx.fill();
              ctx.stroke();
              drawText("BUTTON", 0, 14, '#64ffda');
              break;
          case 'input':
              ctx.fillRect(lx, ly, w, h);
              ctx.strokeRect(lx, ly, w, h);
              ctx.textAlign = 'left';
              ctx.fillStyle = '#5c6370';
              ctx.font = '12px "Roboto", sans-serif';
              ctx.fillText("Placeholder...", lx + 10, y);
              break;
          case 'card':
              ctx.beginPath();
              ctx.roundRect(lx, ly, w, h, 8);
              ctx.fill();
              ctx.stroke();
              ctx.strokeRect(lx + 10, ly + 10, w - 20, 50); // Image placeholder
              ctx.beginPath();
              ctx.moveTo(lx + 10, ly + 70); ctx.lineTo(lx + w - 10, ly + 70);
              ctx.moveTo(lx + 10, ly + 85); ctx.lineTo(lx + w/2, ly + 85);
              ctx.stroke();
              break;
          case 'fab':
              ctx.beginPath();
              ctx.arc(x, y, w/2, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
              drawText("+", 2, 24, '#64ffda');
              break;
          case 'list':
              for(let i=0; i<3; i++) {
                  const offset = i * 40;
                  if (ly + offset + 30 > ly + h) break;
                  ctx.strokeRect(lx, ly + offset, w, 30);
                  ctx.beginPath();
                  ctx.arc(lx + 20, ly + offset + 15, 10, 0, Math.PI*2);
                  ctx.stroke();
                  ctx.beginPath();
                  ctx.moveTo(lx + 40, ly + offset + 10); ctx.lineTo(lx + w - 10, ly + offset + 10);
                  ctx.moveTo(lx + 40, ly + offset + 20); ctx.lineTo(lx + w - 30, ly + offset + 20);
                  ctx.stroke();
              }
              break;
          case 'image':
              ctx.fillRect(lx, ly, w, h);
              ctx.strokeRect(lx, ly, w, h);
              ctx.beginPath();
              ctx.moveTo(lx, ly); ctx.lineTo(lx + w, ly + h);
              ctx.moveTo(lx + w, ly); ctx.lineTo(lx, ly + h);
              ctx.stroke();
              break;
      }
      
      // Render Text Annotation
      if (text) {
          ctx.font = '20px "Fira Code", monospace';
          ctx.fillStyle = '#e6f1ff';
          ctx.textAlign = 'left';
          ctx.fillText(text, x, y);
      }
  };

  const addToHistory = () => {
      setHistory(prev => [...prev.slice(-19), { elements: [...elements], drawings: [...drawings] }]);
  };

  const undo = () => {
      if (history.length === 0) return;
      const newHistory = [...history];
      const previousState = newHistory.pop();
      if (previousState) {
          setElements(previousState.elements);
          setDrawings(previousState.drawings);
          setHistory(newHistory);
      }
  };

  // --- Interaction Handlers ---

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent | React.DragEvent) => {
      if (!canvasRef.current) return { x: 0, y: 0 };
      const rect = canvasRef.current.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
      
      const scaleX = canvasRef.current.width / rect.width;
      const scaleY = canvasRef.current.height / rect.height;

      return {
          x: (clientX - rect.left) * scaleX,
          y: (clientY - rect.top) * scaleY
      };
  };

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
      const { x, y } = getCoordinates(e);
      
      if (tool === 'move') {
          // Find element under cursor (topmost first)
          // Reverse iteration to find the "top" element
          for (let i = elements.length - 1; i >= 0; i--) {
              const el = elements[i];
              const lx = el.x - el.w / 2;
              const ly = el.y - el.h / 2;
              if (x >= lx && x <= lx + el.w && y >= ly && y <= ly + el.h) {
                  setSelectedElementId(el.id);
                  setIsDragging(true);
                  dragOffset.current = { x: x - el.x, y: y - el.y };
                  return;
              }
          }
          // If no element clicked, deselect
          setSelectedElementId(null);
      } else if (tool === 'pen' || tool === 'eraser') {
          setIsDrawing(true);
          addToHistory(); // Save state before new drawing
          setDrawings(prev => [...prev, { points: [{x, y}], isEraser: tool === 'eraser' }]);
      }
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
      const { x, y } = getCoordinates(e);

      if (tool === 'move' && isDragging && selectedElementId) {
          setElements(prev => prev.map(el => {
              if (el.id === selectedElementId) {
                  return { ...el, x: x - dragOffset.current.x, y: y - dragOffset.current.y };
              }
              return el;
          }));
      } else if (isDrawing && (tool === 'pen' || tool === 'eraser')) {
          setDrawings(prev => {
              const newDrawings = [...prev];
              const currentPath = newDrawings[newDrawings.length - 1];
              currentPath.points.push({x, y});
              return newDrawings;
          });
      }
  };

  const handleMouseUp = () => {
      if (isDragging) {
          addToHistory(); // Save state after move
      }
      setIsDrawing(false);
      setIsDragging(false);
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
      if (tool === 'text' && !textInput?.visible) {
          const { x, y } = getCoordinates(e);
          if (containerRef.current && canvasRef.current) {
             const rect = canvasRef.current.getBoundingClientRect();
             const domX = (x / canvasRef.current.width) * rect.width;
             const domY = (y / canvasRef.current.height) * rect.height;
             setTextInput({ x: domX, y: domY, visible: true, value: '' });
          }
      }
  };

  const commitText = () => {
      if (!textInput || !canvasRef.current) return;
      if (textInput.value.trim()) {
          // Need to map back DOM coords to Canvas coords
          const rect = canvasRef.current.getBoundingClientRect();
          const canvasX = (textInput.x / rect.width) * width;
          const canvasY = (textInput.y / rect.height) * height;

          addToHistory();
          const newEl: UIElement = {
              id: Date.now().toString(),
              type: 'text' as any, // Treating text as an element roughly
              x: canvasX,
              y: canvasY,
              w: 0, 
              h: 0,
              text: textInput.value
          };
          // For simplicity, just push to drawings as annotation or element?
          // Let's strictly strictly render text via drawElement if it was an object,
          // but here we used direct context fillText.
          // To make text movable, we should add it to 'elements'.
          setElements(prev => [...prev, newEl]);
      }
      setTextInput(null);
      setTool('move'); // Switch back to move after typing typically
  };

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData('componentType') as ComponentType;
      if (type) {
          const { x, y } = getCoordinates(e);
          addComponent(type, x, y);
      }
  };

  const addComponent = (type: ComponentType, x: number, y: number) => {
      addToHistory();
      let w = 100, h = 50;
      
      // Define default sizes
      switch(type) {
          case 'screen': w = 300; h = 600; break;
          case 'header': w = 300; h = 50; break;
          case 'button': w = 120; h = 40; break;
          case 'input': w = 200; h = 40; break;
          case 'card': w = 150; h = 100; break;
          case 'fab': w = 50; h = 50; break;
          case 'list': w = 200; h = 120; break;
          case 'image': w = 100; h = 100; break;
      }

      const newEl: UIElement = {
          id: Date.now().toString(),
          type,
          x,
          y,
          w,
          h
      };
      
      setElements(prev => [...prev, newEl]);
      setSelectedElementId(newEl.id);
      setTool('move'); // Auto switch to move tool to adjust placement
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  
  const clearCanvas = () => {
    addToHistory();
    setElements([]);
    setDrawings([]);
    onDraw('');
  };

  return (
    <div className="flex h-full bg-blueprint-bg-light/30">
        {/* Toolbar Sidebar */}
        <div className="w-16 flex-shrink-0 border-r border-blueprint-border flex flex-col items-center py-4 gap-4 bg-[#0a192f]">
            <div className="space-y-2 w-full px-2 border-b border-blueprint-border pb-4">
                <ToolButton active={tool === 'move'} onClick={() => setTool('move')} icon="move" tooltip="Move & Select" />
                <ToolButton active={tool === 'pen'} onClick={() => setTool('pen')} icon="pen" tooltip="Draw" />
                <ToolButton active={tool === 'text'} onClick={() => setTool('text')} icon="text" tooltip="Add Text" />
                <ToolButton active={tool === 'eraser'} onClick={() => setTool('eraser')} icon="eraser" tooltip="Eraser" />
                <div className="h-2"></div>
                <button onClick={undo} className="p-2 w-full flex justify-center rounded-md text-blueprint-text-dim hover:text-blueprint-text-light hover:bg-white/5 transition-all" title="Undo">
                    <Icon type="undo" className="w-5 h-5" />
                </button>
                <button onClick={clearCanvas} className="p-2 w-full flex justify-center rounded-md text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all" title="Clear">
                    <Icon type="trash" className="w-5 h-5" />
                </button>
            </div>
            
            <div className="flex-grow overflow-y-auto w-full px-2 space-y-3 pt-2 custom-scrollbar">
                <p className="text-[10px] text-center text-blueprint-text-dim uppercase font-bold mb-2 tracking-wider">UI</p>
                <DraggableItem type="screen" icon="screen" label="Screen" />
                <DraggableItem type="header" icon="header" />
                <DraggableItem type="button" icon="button" />
                <DraggableItem type="input" icon="input" />
                <DraggableItem type="card" icon="card" />
                <DraggableItem type="fab" icon="fab" />
                <DraggableItem type="list" icon="list" />
                <DraggableItem type="image" icon="image" />
            </div>
        </div>

        {/* Canvas Area */}
        <div ref={containerRef} className="relative flex-grow flex items-center justify-center bg-blueprint-bg overflow-hidden cursor-crosshair">
            <canvas
                ref={canvasRef}
                width={width}
                height={height}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onMouseMove={handleMouseMove}
                onTouchStart={handleMouseDown}
                onTouchEnd={handleMouseUp}
                onTouchMove={handleMouseMove}
                onClick={handleCanvasClick}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className={`shadow-2xl border border-blueprint-border bg-[#0a192f] ${tool === 'move' ? 'cursor-default' : 'cursor-crosshair'}`}
                style={{ maxWidth: '100%', maxHeight: '100%' }}
            />
            
            {textInput?.visible && (
                <div className="absolute" style={{ left: textInput.x, top: textInput.y }}>
                    <input
                        autoFocus
                        className="bg-blueprint-bg-lighter border border-blueprint-line text-blueprint-text-light px-2 py-1 rounded shadow-lg outline-none font-mono text-sm min-w-[150px]"
                        value={textInput.value}
                        onChange={(e) => setTextInput({...textInput, value: e.target.value})}
                        onBlur={commitText}
                        onKeyDown={(e) => e.key === 'Enter' && commitText()}
                        placeholder="Type annotation..."
                    />
                </div>
            )}
        </div>
    </div>
  );
};

const ToolButton: React.FC<{ active: boolean, onClick: () => void, icon: any, tooltip: string }> = ({ active, onClick, icon, tooltip }) => (
    <button 
        onClick={onClick}
        title={tooltip}
        className={`w-full p-2 rounded-md flex justify-center transition-all ${active ? 'bg-blueprint-line text-blueprint-bg shadow-neon' : 'text-blueprint-text-dim hover:bg-white/5 hover:text-blueprint-text-light'}`}
    >
        <Icon type={icon} className="w-5 h-5" />
    </button>
);

const DraggableItem: React.FC<{ type: ComponentType, icon: any, label?: string }> = ({ type, icon, label }) => {
    const handleDragStart = (e: React.DragEvent) => {
        e.dataTransfer.setData('componentType', type);
        e.dataTransfer.effectAllowed = 'copy';
    };
    
    return (
        <div 
            draggable 
            onDragStart={handleDragStart}
            className="w-full aspect-square bg-blueprint-bg-light/50 border border-blueprint-border rounded-lg flex flex-col items-center justify-center cursor-grab hover:border-blueprint-line hover:bg-blueprint-bg-lighter transition-all group relative"
            title={label || type}
        >
            <Icon type={icon} className="w-6 h-6 text-blueprint-text-dim group-hover:text-blueprint-line" />
            {label && <span className="text-[9px] mt-1 text-blueprint-text-dim group-hover:text-blueprint-text-light">{label}</span>}
        </div>
    )
}