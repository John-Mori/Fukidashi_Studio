import { ArrowUpDown, Check, ImagePlus, PanelsTopLeft, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { coverImagePlacement, createPanelRects, DEFAULT_PANEL_CROP, SHORTS_HEIGHT, SHORTS_WIDTH, type PanelCrop } from "../../editor/twoPanel";

type PanelKey = "top" | "bottom";

type PanelImage = {
  name: string;
  dataUrl: string;
  image: HTMLImageElement;
};

type TwoPanelComposerProps = {
  initialImage?: { name: string; dataUrl: string };
  onCancel: () => void;
  onApply: (dataUrl: string) => void;
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image decode failed"));
    image.src = dataUrl;
  });
}

async function createPanelImage(name: string, dataUrl: string): Promise<PanelImage> {
  return { name, dataUrl, image: await loadImage(dataUrl) };
}

export function TwoPanelComposer({ initialImage, onCancel, onApply }: TwoPanelComposerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const topInputRef = useRef<HTMLInputElement | null>(null);
  const bottomInputRef = useRef<HTMLInputElement | null>(null);
  const activePointerRef = useRef<number | null>(null);
  const dragPanelRef = useRef<PanelKey>("top");
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const [topImage, setTopImage] = useState<PanelImage>();
  const [bottomImage, setBottomImage] = useState<PanelImage>();
  const [activePanel, setActivePanel] = useState<PanelKey>("top");
  const [splitRatio, setSplitRatio] = useState(0.55);
  const [topCrop, setTopCrop] = useState<PanelCrop>({ ...DEFAULT_PANEL_CROP });
  const [bottomCrop, setBottomCrop] = useState<PanelCrop>({ ...DEFAULT_PANEL_CROP });
  const [error, setError] = useState("");
  const [previewStyle, setPreviewStyle] = useState<CSSProperties>();

  useEffect(() => {
    if (!initialImage) return;
    let cancelled = false;
    void createPanelImage(initialImage.name, initialImage.dataUrl)
      .then((image) => { if (!cancelled) setTopImage(image); })
      .catch(() => { if (!cancelled) setError("現在の画像を読み込めませんでした。"); });
    return () => { cancelled = true; };
  }, [initialImage]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const updatePreviewSize = () => {
      const styles = window.getComputedStyle(stage);
      const horizontalPadding = Number.parseFloat(styles.paddingLeft) + Number.parseFloat(styles.paddingRight);
      const verticalPadding = Number.parseFloat(styles.paddingTop) + Number.parseFloat(styles.paddingBottom);
      const availableWidth = Math.max(1, stage.clientWidth - horizontalPadding);
      const availableHeight = Math.max(1, stage.clientHeight - verticalPadding);
      const width = Math.min(availableWidth, availableHeight * SHORTS_WIDTH / SHORTS_HEIGHT);
      setPreviewStyle({ width: `${width}px`, height: `${width * SHORTS_HEIGHT / SHORTS_WIDTH}px` });
    };
    updatePreviewSize();
    const observer = new ResizeObserver(updatePreviewSize);
    observer.observe(stage);
    window.addEventListener("orientationchange", updatePreviewSize);
    return () => {
      observer.disconnect();
      window.removeEventListener("orientationchange", updatePreviewSize);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = SHORTS_WIDTH;
    canvas.height = SHORTS_HEIGHT;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#050505";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    const panels = createPanelRects(splitRatio);
    const drawPanel = (source: PanelImage | undefined, crop: PanelCrop, panel: typeof panels.top) => {
      if (!source) return;
      const placement = coverImagePlacement(
        { width: source.image.naturalWidth, height: source.image.naturalHeight },
        panel,
        crop,
      );
      context.save();
      context.beginPath();
      context.rect(panel.x, panel.y, panel.width, panel.height);
      context.clip();
      context.drawImage(source.image, placement.x, placement.y, placement.width, placement.height);
      context.restore();
    };
    drawPanel(topImage, topCrop, panels.top);
    drawPanel(bottomImage, bottomCrop, panels.bottom);
  }, [topImage, bottomImage, topCrop, bottomCrop, splitRatio]);

  const setImageFromFiles = async (panel: PanelKey, files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    try {
      const image = await createPanelImage(file.name, await readFileAsDataUrl(file));
      if (panel === "top") {
        setTopImage(image);
        setTopCrop({ ...DEFAULT_PANEL_CROP });
      } else {
        setBottomImage(image);
        setBottomCrop({ ...DEFAULT_PANEL_CROP });
      }
      setActivePanel(panel);
      setError("");
    } catch {
      setError("画像を読み込めませんでした。PNG、JPEG、WebPを使ってください。");
    }
  };

  const activeCrop = activePanel === "top" ? topCrop : bottomCrop;
  const setActiveCrop = (next: PanelCrop | ((current: PanelCrop) => PanelCrop)) => {
    if (activePanel === "top") setTopCrop(next);
    else setBottomCrop(next);
  };

  const panelFromPointer = (event: ReactPointerEvent<HTMLCanvasElement>): PanelKey => {
    const rect = event.currentTarget.getBoundingClientRect();
    return (event.clientY - rect.top) / rect.height < splitRatio ? "top" : "bottom";
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const panel = panelFromPointer(event);
    setActivePanel(panel);
    dragPanelRef.current = panel;
    activePointerRef.current = event.pointerId;
    lastPointerRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (activePointerRef.current !== event.pointerId) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const deltaX = (event.clientX - lastPointerRef.current.x) * SHORTS_WIDTH / rect.width;
    const deltaY = (event.clientY - lastPointerRef.current.y) * SHORTS_HEIGHT / rect.height;
    lastPointerRef.current = { x: event.clientX, y: event.clientY };
    const update = (current: PanelCrop) => ({ ...current, offsetX: current.offsetX + deltaX, offsetY: current.offsetY + deltaY });
    if (dragPanelRef.current === "top") setTopCrop(update);
    else setBottomCrop(update);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (activePointerRef.current !== event.pointerId) return;
    activePointerRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const swapPanels = () => {
    setTopImage(bottomImage);
    setBottomImage(topImage);
    setTopCrop(bottomCrop);
    setBottomCrop(topCrop);
    setActivePanel((current) => current === "top" ? "bottom" : "top");
  };

  const apply = () => {
    if (!canvasRef.current || !topImage || !bottomImage) return;
    onApply(canvasRef.current.toDataURL("image/png"));
  };

  return (
    <section className="two-panel-editor" aria-label="2コマ結合">
      <input ref={topInputRef} hidden type="file" accept="image/*" onChange={(event) => { void setImageFromFiles("top", event.target.files); event.target.value = ""; }} />
      <input ref={bottomInputRef} hidden type="file" accept="image/*" onChange={(event) => { void setImageFromFiles("bottom", event.target.files); event.target.value = ""; }} />

      <header className="two-panel-topbar">
        <button title="キャンセル" onClick={onCancel}><X size={20} /><span>キャンセル</span></button>
        <div><strong>2コマ結合</strong><span>1080 x 1920px</span></div>
        <button title="上下を入れ替え" disabled={!topImage && !bottomImage} onClick={swapPanels}><ArrowUpDown size={20} /></button>
        <button className="primary" title="結合して編集" disabled={!topImage || !bottomImage} onClick={apply}><Check size={20} /><span>結合して編集</span></button>
      </header>

      <div ref={stageRef} className="two-panel-stage">
        <div className="two-panel-preview" style={previewStyle}>
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
          <span className="two-panel-seam" style={{ top: `${splitRatio * 100}%` }} />
          <span
            className="two-panel-selection"
            style={activePanel === "top" ? { top: 0, height: `${splitRatio * 100}%` } : { top: `${splitRatio * 100}%`, height: `${(1 - splitRatio) * 100}%` }}
          />
          {!topImage && <button className="two-panel-empty-slot top" onClick={() => topInputRef.current?.click()}><ImagePlus size={25} />上の画像</button>}
          {!bottomImage && <button className="two-panel-empty-slot bottom" onClick={() => bottomInputRef.current?.click()}><ImagePlus size={25} />下の画像</button>}
        </div>
      </div>

      <footer className="two-panel-controls">
        <div className="two-panel-tabs" aria-label="調整するコマ">
          <button className={activePanel === "top" ? "active" : ""} onClick={() => setActivePanel("top")}><PanelsTopLeft size={18} />上のコマ</button>
          <button className={activePanel === "bottom" ? "active" : ""} onClick={() => setActivePanel("bottom")}><PanelsTopLeft size={18} />下のコマ</button>
        </div>
        <button onClick={() => (activePanel === "top" ? topInputRef : bottomInputRef).current?.click()}><ImagePlus size={19} />画像を選び直す</button>
        <label>
          <span>コマ境界 <b>{Math.round(splitRatio * 100)}%</b></span>
          <input type="range" min="0.3" max="0.7" step="0.01" value={splitRatio} onChange={(event) => setSplitRatio(Number(event.target.value))} />
        </label>
        <label>
          <span>画像の拡大 <b>{Math.round(activeCrop.zoom * 100)}%</b></span>
          <input type="range" min="1" max="3" step="0.01" value={activeCrop.zoom} onChange={(event) => setActiveCrop((current) => ({ ...current, zoom: Number(event.target.value) }))} />
        </label>
        <button onClick={() => setActiveCrop({ ...DEFAULT_PANEL_CROP })}><RotateCcw size={19} />位置を中央へ</button>
        {error && <span className="two-panel-error">{error}</span>}
      </footer>
    </section>
  );
}
