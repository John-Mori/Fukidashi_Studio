import { Check, Droplets, Grid3X3, Redo2, RotateCcw, Trash2, Undo2, X } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { mosaicSampleSize, shouldAppendMosaicPoint, type MosaicMode, type MosaicPoint, type MosaicStroke } from "../../editor/mosaic";

type MosaicEditorProps = {
  sourceDataUrl: string;
  imageName: string;
  onCancel: () => void;
  onApply: (dataUrl: string) => void;
};

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image decode failed"));
    image.src = dataUrl;
  });
}

function createEffectCanvas(image: HTMLImageElement, mode: MosaicMode, strength: number): HTMLCanvasElement {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const sampleSize = mosaicSampleSize(width, height, mode, strength);
  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = sampleSize.width;
  sampleCanvas.height = sampleSize.height;
  const sampleContext = sampleCanvas.getContext("2d");
  if (!sampleContext) throw new Error("Canvas context unavailable");
  sampleContext.imageSmoothingEnabled = mode === "blur";
  sampleContext.imageSmoothingQuality = "high";
  sampleContext.drawImage(image, 0, 0, sampleCanvas.width, sampleCanvas.height);

  const effectCanvas = document.createElement("canvas");
  effectCanvas.width = width;
  effectCanvas.height = height;
  const effectContext = effectCanvas.getContext("2d");
  if (!effectContext) throw new Error("Canvas context unavailable");
  effectContext.imageSmoothingEnabled = mode === "blur";
  effectContext.imageSmoothingQuality = "high";
  effectContext.drawImage(sampleCanvas, 0, 0, width, height);
  return effectCanvas;
}

function drawStrokeMask(context: CanvasRenderingContext2D, stroke: MosaicStroke) {
  const [first, ...rest] = stroke.points;
  if (!first) return;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = stroke.brushSize;
  context.strokeStyle = "#ffffff";
  context.fillStyle = "#ffffff";
  if (rest.length === 0) {
    context.beginPath();
    context.arc(first.x, first.y, stroke.brushSize / 2, 0, Math.PI * 2);
    context.fill();
    return;
  }
  context.beginPath();
  context.moveTo(first.x, first.y);
  for (const point of rest) context.lineTo(point.x, point.y);
  context.stroke();
}

export function MosaicEditor({ sourceDataUrl, imageName, onCancel, onApply }: MosaicEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const activePointerRef = useRef<number | null>(null);
  const effectCacheRef = useRef(new Map<string, HTMLCanvasElement>());
  const [mode, setMode] = useState<MosaicMode>("pixelate");
  const [brushSize, setBrushSize] = useState(90);
  const [strength, setStrength] = useState(18);
  const [strokes, setStrokes] = useState<MosaicStroke[]>([]);
  const [redoStrokes, setRedoStrokes] = useState<MosaicStroke[]>([]);
  const [ready, setReady] = useState(false);
  const [cursor, setCursor] = useState({ x: 0, y: 0, size: 0, visible: false });

  useEffect(() => {
    let cancelled = false;
    void loadImage(sourceDataUrl).then((image) => {
      if (cancelled || !canvasRef.current) return;
      imageRef.current = image;
      canvasRef.current.width = image.naturalWidth || image.width;
      canvasRef.current.height = image.naturalHeight || image.height;
      effectCacheRef.current.clear();
      setReady(true);
    });
    return () => { cancelled = true; };
  }, [sourceDataUrl]);

  useEffect(() => {
    if (!ready || !canvasRef.current || !imageRef.current) return;
    const canvas = canvasRef.current;
    const image = imageRef.current;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const layer = document.createElement("canvas");
    layer.width = canvas.width;
    layer.height = canvas.height;
    const layerContext = layer.getContext("2d");
    if (!layerContext) return;

    for (const stroke of strokes) {
      const cacheKey = `${stroke.mode}:${stroke.strength}`;
      let effect = effectCacheRef.current.get(cacheKey);
      if (!effect) {
        effect = createEffectCanvas(image, stroke.mode, stroke.strength);
        effectCacheRef.current.set(cacheKey, effect);
      }
      layerContext.clearRect(0, 0, layer.width, layer.height);
      layerContext.globalCompositeOperation = "source-over";
      layerContext.drawImage(effect, 0, 0);
      layerContext.globalCompositeOperation = "destination-in";
      drawStrokeMask(layerContext, stroke);
      layerContext.globalCompositeOperation = "source-over";
      context.drawImage(layer, 0, 0);
    }
  }, [ready, strokes]);

  const pointFromEvent = (event: ReactPointerEvent<HTMLCanvasElement>): MosaicPoint => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * canvas.width / rect.width,
      y: (event.clientY - rect.top) * canvas.height / rect.height,
    };
  };

  const updateCursor = (event: ReactPointerEvent<HTMLCanvasElement>, visible = true) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setCursor({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      size: brushSize * rect.width / event.currentTarget.width,
      visible,
    });
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!ready) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointerRef.current = event.pointerId;
    const point = pointFromEvent(event);
    setRedoStrokes([]);
    setStrokes((current) => [...current, { mode, brushSize, strength, points: [point] }]);
    updateCursor(event);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    updateCursor(event);
    if (activePointerRef.current !== event.pointerId) return;
    event.preventDefault();
    const point = pointFromEvent(event);
    setStrokes((current) => {
      const active = current[current.length - 1];
      if (!active) return current;
      const previous = active.points[active.points.length - 1];
      if (!previous || !shouldAppendMosaicPoint(previous, point, active.brushSize)) return current;
      return [...current.slice(0, -1), { ...active, points: [...active.points, point] }];
    });
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (activePointerRef.current !== event.pointerId) return;
    activePointerRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    updateCursor(event);
  };

  const handleUndo = () => {
    setStrokes((current) => {
      const last = current[current.length - 1];
      if (!last) return current;
      setRedoStrokes((redo) => [last, ...redo]);
      return current.slice(0, -1);
    });
  };

  const handleRedo = () => {
    setRedoStrokes((redo) => {
      const next = redo[0];
      if (!next) return redo;
      setStrokes((current) => [...current, next]);
      return redo.slice(1);
    });
  };

  const handleApply = () => {
    if (!canvasRef.current) return;
    onApply(canvasRef.current.toDataURL("image/png"));
  };

  return (
    <section className="mosaic-editor" aria-label="モザイク編集">
      <header className="mosaic-topbar">
        <button title="キャンセル" onClick={onCancel}><X size={20} /><span>キャンセル</span></button>
        <div>
          <strong>モザイク編集</strong>
          <span>{imageName}</span>
        </div>
        <div className="mosaic-history-actions">
          <button title="取り消す" disabled={strokes.length === 0} onClick={handleUndo}><Undo2 size={20} /></button>
          <button title="やり直す" disabled={redoStrokes.length === 0} onClick={handleRedo}><Redo2 size={20} /></button>
        </div>
        <button className="primary" title="適用" onClick={handleApply}><Check size={20} /><span>適用</span></button>
      </header>

      <div className="mosaic-stage">
        <div className="mosaic-canvas-wrap">
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerEnter={(event) => updateCursor(event)}
            onPointerLeave={(event) => updateCursor(event, activePointerRef.current !== null)}
          />
          <span
            className={cursor.visible ? "mosaic-brush-cursor visible" : "mosaic-brush-cursor"}
            style={{ width: cursor.size, height: cursor.size, left: cursor.x, top: cursor.y }}
          />
          {!ready && <div className="mosaic-loading">画像を準備しています...</div>}
        </div>
      </div>

      <footer className="mosaic-controls">
        <div className="mosaic-mode-switch" aria-label="モザイク種類">
          <button className={mode === "pixelate" ? "active" : ""} onClick={() => setMode("pixelate")}><Grid3X3 size={21} />モザイク</button>
          <button className={mode === "blur" ? "active" : ""} onClick={() => setMode("blur")}><Droplets size={21} />ぼかし</button>
        </div>
        <label>
          <span>ブラシの太さ <b>{brushSize}px</b></span>
          <input type="range" min="20" max="320" step="2" value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} />
        </label>
        <label>
          <span>効果の強さ <b>{strength}</b></span>
          <input type="range" min="4" max="48" step="1" value={strength} onChange={(event) => setStrength(Number(event.target.value))} />
        </label>
        <button className="mosaic-clear-button" disabled={strokes.length === 0} onClick={() => { setStrokes([]); setRedoStrokes([]); }}><Trash2 size={19} />全消去</button>
        <span className="mosaic-gesture-hint"><RotateCcw size={16} />画像を1本指でなぞります</span>
      </footer>
    </section>
  );
}
