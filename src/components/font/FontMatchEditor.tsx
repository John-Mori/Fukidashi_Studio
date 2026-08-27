import { Check, LoaderCircle, Maximize2, ScanText, X } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { analyzeFontMatches, collectFontCandidates, type FontMatchResult } from "../../editor/fontMatching";
import { clampGesturePan, createPinchSnapshot, updatePinchTransform, type GesturePoint, type GestureTransform, type PinchSnapshot } from "../../editor/touchGestures";
import type { TextObject, WritingMode } from "../../project/model/types";

type FontMatchEditorProps = {
  sourceDataUrl: string;
  imageName: string;
  target: TextObject;
  onCancel: () => void;
  onApply: (patch: Pick<TextObject, "fontFamily" | "fontSize" | "fontWeight">) => void;
};

type SelectionRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image decode failed"));
    image.src = dataUrl;
  });
}

function selectionFromPoints(start: GesturePoint, end: GesturePoint): SelectionRect {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

export function FontMatchEditor({ sourceDataUrl, imageName, target, onCancel, onApply }: FontMatchEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const pointersRef = useRef(new Map<number, GesturePoint>());
  const pinchRef = useRef<PinchSnapshot | null>(null);
  const drawingPointerRef = useRef<number | null>(null);
  const selectionStartRef = useRef<GesturePoint | null>(null);
  const suppressSelectionRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [displaySize, setDisplaySize] = useState({ width: 1, height: 1 });
  const [view, setView] = useState<GestureTransform>({ scale: 1, x: 0, y: 0 });
  const [selection, setSelection] = useState<SelectionRect>();
  const [referenceText, setReferenceText] = useState(target.text);
  const [writingMode, setWritingMode] = useState<WritingMode>(target.writingMode);
  const [results, setResults] = useState<FontMatchResult[]>([]);
  const [status, setStatus] = useState("見本文字範囲");
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadImage(sourceDataUrl).then((image) => {
      if (cancelled || !canvasRef.current) return;
      const canvas = canvasRef.current;
      canvas.width = image.naturalWidth || image.width;
      canvas.height = image.naturalHeight || image.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      setReady(true);
    }).catch(() => setStatus("画像を読み込めませんでした"));
    return () => { cancelled = true; };
  }, [sourceDataUrl]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  useEffect(() => {
    if (!ready || !stageRef.current || !canvasRef.current) return;
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    const updateDisplaySize = () => {
      const rect = stage.getBoundingClientRect();
      const style = getComputedStyle(stage);
      const availableWidth = Math.max(1, rect.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));
      const availableHeight = Math.max(1, rect.height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom));
      const fit = Math.min(1, availableWidth / canvas.width, availableHeight / canvas.height);
      const nextSize = { width: Math.max(1, canvas.width * fit), height: Math.max(1, canvas.height * fit) };
      setDisplaySize(nextSize);
      setView((current) => clampGesturePan(current, nextSize, { width: availableWidth, height: availableHeight }));
    };
    updateDisplaySize();
    const observer = new ResizeObserver(updateDisplaySize);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [ready]);

  const pointFromEvent = (event: ReactPointerEvent<HTMLCanvasElement>): GesturePoint => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(event.currentTarget.width, (event.clientX - rect.left) * event.currentTarget.width / rect.width)),
      y: Math.max(0, Math.min(event.currentTarget.height, (event.clientY - rect.top) * event.currentTarget.height / rect.height)),
    };
  };

  const pinchFromPointers = () => {
    const [first, second] = Array.from(pointersRef.current.values());
    return first && second ? createPinchSnapshot(first, second) : null;
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!ready) return;
    event.preventDefault();
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Pointer capture is optional on restricted WebViews. */ }
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size >= 2) {
      drawingPointerRef.current = null;
      selectionStartRef.current = null;
      suppressSelectionRef.current = true;
      pinchRef.current = pinchFromPointers();
      return;
    }
    if (suppressSelectionRef.current) return;
    const point = pointFromEvent(event);
    drawingPointerRef.current = event.pointerId;
    selectionStartRef.current = point;
    setSelection({ x: point.x, y: point.y, width: 0, height: 0 });
    setResults([]);
    setStatus("見本文字範囲");
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    if (pointersRef.current.has(event.pointerId)) pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size >= 2 && pinchRef.current && stageRef.current && wrapRef.current) {
      const nextPinch = pinchFromPointers();
      if (!nextPinch) return;
      const stageRect = stageRef.current.getBoundingClientRect();
      const viewportCenter = { x: stageRect.left + stageRect.width / 2, y: stageRect.top + stageRect.height / 2 };
      setView((current) => clampGesturePan(
        updatePinchTransform(current, pinchRef.current as PinchSnapshot, nextPinch, viewportCenter),
        { width: wrapRef.current?.offsetWidth ?? 1, height: wrapRef.current?.offsetHeight ?? 1 },
        { width: stageRect.width, height: stageRect.height },
      ));
      pinchRef.current = nextPinch;
      return;
    }
    if (suppressSelectionRef.current || drawingPointerRef.current !== event.pointerId || !selectionStartRef.current) return;
    setSelection(selectionFromPoints(selectionStartRef.current, pointFromEvent(event)));
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (drawingPointerRef.current === event.pointerId) {
      const point = pointFromEvent(event);
      const current = selectionStartRef.current ? selectionFromPoints(selectionStartRef.current, point) : undefined;
      if (current && current.width >= 4 && current.height >= 4) {
        setSelection(current);
      } else {
        const width = Math.min(event.currentTarget.width, Math.max(80, event.currentTarget.width * 0.18));
        const height = Math.min(event.currentTarget.height, Math.max(80, event.currentTarget.height * 0.1));
        setSelection({
          x: Math.max(0, Math.min(event.currentTarget.width - width, point.x - width / 2)),
          y: Math.max(0, Math.min(event.currentTarget.height - height, point.y - height / 2)),
          width,
          height,
        });
      }
      drawingPointerRef.current = null;
      selectionStartRef.current = null;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    pinchRef.current = pointersRef.current.size >= 2 ? pinchFromPointers() : null;
    if (pointersRef.current.size === 0) suppressSelectionRef.current = false;
  };

  const handleAnalyze = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !selection || !referenceText.trim()) return;
    setAnalyzing(true);
    setResults([]);
    setStatus("照合中");
    try {
      const fontSet = await collectFontCandidates();
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("画像を解析できませんでした。");
      const x = Math.max(0, Math.floor(selection.x));
      const y = Math.max(0, Math.floor(selection.y));
      const width = Math.max(1, Math.min(canvas.width - x, Math.ceil(selection.width)));
      const height = Math.max(1, Math.min(canvas.height - y, Math.ceil(selection.height)));
      const matches = await analyzeFontMatches(context.getImageData(x, y, width, height), referenceText, writingMode, fontSet.candidates);
      setResults(matches);
      if (fontSet.localAccess === "used") setStatus(`端末フォント ${fontSet.localCount}件を照合`);
      else if (fontSet.localAccess === "denied") setStatus("標準フォントで照合（端末フォント未許可）");
      else setStatus("標準フォントで照合");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "照合できませんでした");
    } finally {
      setAnalyzing(false);
    }
  };

  const selectionStyle = selection && canvasRef.current ? {
    left: `${selection.x / canvasRef.current.width * 100}%`,
    top: `${selection.y / canvasRef.current.height * 100}%`,
    width: `${selection.width / canvasRef.current.width * 100}%`,
    height: `${selection.height / canvasRef.current.height * 100}%`,
  } : undefined;

  return (
    <section className="font-match-editor" aria-label="画像文字のフォント照合">
      <header className="font-match-topbar">
        <button title="キャンセル" onClick={onCancel}><X size={20} /><span>キャンセル</span></button>
        <div>
          <strong>画像の文字に合わせる</strong>
          <span>{imageName}</span>
        </div>
        <button title="全体表示" onClick={() => setView({ scale: 1, x: 0, y: 0 })}><Maximize2 size={20} /><span>{Math.round(view.scale * 100)}%</span></button>
      </header>

      <div className="font-match-stage" ref={stageRef}>
        <div
          className="font-match-canvas-wrap"
          ref={wrapRef}
          style={{ width: displaySize.width, height: displaySize.height, transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
        >
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
          {selectionStyle && <span className="font-match-selection" style={selectionStyle}><b>見本</b></span>}
          {!ready && <div className="font-match-loading">画像を準備中</div>}
        </div>
      </div>

      <footer className="font-match-controls">
        <div className="font-match-inputs">
          <label>
            <span>画像内の文字</span>
            <textarea value={referenceText} onChange={(event) => { setReferenceText(event.target.value); setResults([]); }} />
          </label>
          <div className="font-match-writing-mode" aria-label="文字方向">
            <button className={writingMode === "vertical" ? "active" : ""} onClick={() => { setWritingMode("vertical"); setResults([]); }}>縦書き</button>
            <button className={writingMode === "horizontal" ? "active" : ""} onClick={() => { setWritingMode("horizontal"); setResults([]); }}>横書き</button>
          </div>
          <button className="primary font-match-analyze" disabled={!selection || !referenceText.trim() || analyzing} onClick={() => void handleAnalyze()}>
            {analyzing ? <LoaderCircle className="spin" size={20} /> : <ScanText size={20} />}
            {analyzing ? "照合中" : "近い文字を検索"}
          </button>
          <span className="font-match-status">{status}</span>
        </div>

        <div className="font-match-results" aria-label="フォント候補">
          {results.map((result, index) => (
            <button
              type="button"
              className="font-match-result"
              key={`${result.family}-${result.fontWeight}`}
              onClick={() => onApply({ fontFamily: result.fontFamily, fontSize: result.fontSize, fontWeight: result.fontWeight })}
            >
              <span className="font-match-rank">{index + 1}</span>
              <span className="font-match-preview" style={{ fontFamily: result.fontFamily, fontWeight: result.fontWeight }}>{referenceText || "文字"}</span>
              <span className="font-match-result-meta">
                <strong>{result.label}</strong>
                <small>{result.fontSize}px / {result.fontWeight === "bold" ? "太字" : "標準"} / 近さ {Math.round(result.score * 100)}%</small>
              </span>
              <Check size={18} />
            </button>
          ))}
        </div>
      </footer>
    </section>
  );
}
