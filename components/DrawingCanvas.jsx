'use client';

import { useRef, useEffect, useState } from 'react';

// A simple freehand drawing canvas. Pass an initial base64 image via
// `initialData` to resume editing an existing drawing.
export default function DrawingCanvas({ initialData, onChange, width = 500, height = 400 }) {
  const canvasRef = useRef(null);
  const bgImageRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const bgImage = new Image();
    bgImage.onload = () => {
      bgImageRef.current = bgImage;
      drawBackground(ctx, bgImage);

      if (initialData) {
        const drawingImg = new Image();
        drawingImg.onload = () => ctx.drawImage(drawingImg, 0, 0, width, height);
        drawingImg.src = initialData;
      }
    };
    bgImage.src = '/chakra-body-outline.jpg';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function drawBackground(ctx, bgImage) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    const scale = Math.min(width / bgImage.width, height / bgImage.height);
    const drawWidth = bgImage.width * scale;
    const drawHeight = bgImage.height * scale;
    const offsetX = (width - drawWidth) / 2;
    const offsetY = (height - drawHeight) / 2;

    ctx.drawImage(bgImage, offsetX, offsetY, drawWidth, drawHeight);
  }

  function getPos(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * width,
      y: ((clientY - rect.top) / rect.height) * height,
    };
  }

  function startDrawing(e) {
    e.preventDefault();
    setIsDrawing(true);
    const ctx = canvasRef.current.getContext('2d');
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function draw(e) {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  function stopDrawing() {
    if (!isDrawing) return;
    setIsDrawing(false);
    onChange?.(canvasRef.current.toDataURL());
  }

  function handleClear() {
    const ctx = canvasRef.current.getContext('2d');
    if (bgImageRef.current) {
      drawBackground(ctx, bgImageRef.current);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }
    onChange?.(canvasRef.current.toDataURL());
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="border border-slate-300 rounded bg-white touch-none w-full max-w-md"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />
      <button
        type="button"
        onClick={handleClear}
        className="text-xs text-slate-500 underline mt-1"
      >
        Clear drawing
      </button>
    </div>
  );
}
