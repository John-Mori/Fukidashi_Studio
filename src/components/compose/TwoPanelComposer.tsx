import { ArrowUpDown, Check, ImagePlus, PanelsTopLeft, RotateCcw, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import {
  clampAnglePercent,
  clampOutputSize,
  createPanelLayout,
  DEFAULT_BOUNDARY_RATIOS,
  DEFAULT_PANEL_CROP,
  imagePlacement,
  normalizeBoundaryRatios,
  panelIndexAtPoint,
  SHORTS_HEIGHT,
  SHORTS_WIDTH,
  type PanelCount,
  type PanelCrop,
  type PanelFit,
  type PanelGeometry,
} from "../../editor/twoPanel";

type PanelImage = {
  name: string;
  dataUrl: string;
  image: HTMLImageElement;
};

type TwoPanelComposerProps = {
  initialImage?: { name: string; dataUrl: string };
  onCancel: () => void;
  onApply: (dataUrl: string, size: { width: number; height: number }, panelCount: PanelCount) => void;
};

type AngleSettings = Record<PanelCount, number>;
type RememberSettings = Record<PanelCount, boolean>;
type StoredAngleDefaults = Partial<Record<"2" | "3", number>>;

const ANGLE_DEFAULTS_KEY = "fukidashi-studio-panel-angle-defaults";
const PANEL_LABELS = ["上", "中央", "下"];

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

function readAngleDefaults(): StoredAngleDefaults {
  try {
    const parsed = JSON.parse(localStorage.getItem(ANGLE_DEFAULTS_KEY) ?? "{}") as StoredAngleDefaults;
    return {
      ...(typeof parsed["2"] === "number" ? { "2": clampAnglePercent(parsed["2"]) } : {}),
      ...(typeof parsed["3"] === "number" ? { "3": clampAnglePercent(parsed["3"]) } : {}),
    };
  } catch {
    return {};
  }
}

function writeAngleDefault(panelCount: PanelCount, value?: number) {
  const stored = readAngleDefaults();
  const key = String(panelCount) as "2" | "3";
  if (typeof value === "number") stored[key] = clampAnglePercent(value);
  else delete stored[key];
  try {
    localStorage.setItem(ANGLE_DEFAULTS_KEY, JSON.stringify(stored));
  } catch {
    // Editing remains available when private browsing blocks persistent storage.
  }
}

function panelLabel(index: number, panelCount: PanelCount) {
  if (panelCount === 2) return index === 0 ? "上" : "下";
  return PANEL_LABELS[index];
}

function tracePanel(context: CanvasRenderingContext2D, panel: PanelGeometry) {
  context.beginPath();
  context.moveTo(panel.polygon[0].x, panel.polygon[0].y);
  for (let index = 1; index < panel.polygon.length; index += 1) {
    context.lineTo(panel.polygon[index].x, panel.polygon[index].y);
  }
  context.closePath();
}

function DimensionField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const commit = (next: number) => onChange(clampOutputSize(next, label === "幅" ? SHORTS_WIDTH : SHORTS_HEIGHT));
  return (
    <label className="two-panel-dimension-field">
      <span>{label}</span>
      <span className="two-panel-dimension-control">
        <input
          type="number"
          min="320"
          max="4096"
          step="10"
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          onBlur={() => commit(value)}
        />
        <span>
          <button type="button" title={`${label}を増やす`} onClick={() => commit(value + 10)}>↑</button>
          <button type="button" title={`${label}を減らす`} onClick={() => commit(value - 10)}>↓</button>
        </span>
      </span>
    </label>
  );
}

export function TwoPanelComposer({ initialImage, onCancel, onApply }: TwoPanelComposerProps) {
  const storedDefaultsRef = useRef(readAngleDefaults());
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const activePointerRef = useRef<number | null>(null);
  const dragPanelRef = useRef(0);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const [panelCount, setPanelCount] = useState<PanelCount>(2);
  const [images, setImages] = useState<Array<PanelImage | undefined>>([undefined, undefined, undefined]);
  const [crops, setCrops] = useState<PanelCrop[]>([
    { ...DEFAULT_PANEL_CROP },
    { ...DEFAULT_PANEL_CROP },
    { ...DEFAULT_PANEL_CROP },
  ]);
  const [fits, setFits] = useState<PanelFit[]>(["contain", "contain", "contain"]);
  const [activePanel, setActivePanel] = useState(0);
  const [boundaryRatios, setBoundaryRatios] = useState<Record<PanelCount, number[]>>({
    2: [...DEFAULT_BOUNDARY_RATIOS[2]],
    3: [...DEFAULT_BOUNDARY_RATIOS[3]],
  });
  const [angles, setAngles] = useState<AngleSettings>({
    2: storedDefaultsRef.current["2"] ?? 0,
    3: storedDefaultsRef.current["3"] ?? 0,
  });
  const [rememberAngles, setRememberAngles] = useState<RememberSettings>({
    2: typeof storedDefaultsRef.current["2"] === "number",
    3: typeof storedDefaultsRef.current["3"] === "number",
  });
  const [outputWidth, setOutputWidth] = useState(SHORTS_WIDTH);
  const [outputHeight, setOutputHeight] = useState(SHORTS_HEIGHT);
  const [error, setError] = useState("");
  const [previewStyle, setPreviewStyle] = useState<CSSProperties>();

  const layout = useMemo(
    () => createPanelLayout(panelCount, boundaryRatios[panelCount], angles[panelCount], outputWidth, outputHeight),
    [panelCount, boundaryRatios, angles, outputWidth, outputHeight],
  );
  const activeCrop = crops[activePanel];
  const activeFit = fits[activePanel];
  const allImagesReady = images.slice(0, panelCount).every(Boolean);

  useEffect(() => {
    if (!initialImage) return;
    let cancelled = false;
    void createPanelImage(initialImage.name, initialImage.dataUrl)
      .then((image) => {
        if (!cancelled) setImages((current) => current.map((item, index) => index === 0 ? image : item));
      })
      .catch(() => { if (!cancelled) setError("現在の画像を読み込めませんでした。"); });
    return () => { cancelled = true; };
  }, [initialImage]);

  useEffect(() => {
    if (activePanel >= panelCount) setActivePanel(panelCount - 1);
  }, [activePanel, panelCount]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const updatePreviewSize = () => {
      const styles = window.getComputedStyle(stage);
      const horizontalPadding = Number.parseFloat(styles.paddingLeft) + Number.parseFloat(styles.paddingRight);
      const verticalPadding = Number.parseFloat(styles.paddingTop) + Number.parseFloat(styles.paddingBottom);
      const availableWidth = Math.max(1, stage.clientWidth - horizontalPadding);
      const availableHeight = Math.max(1, stage.clientHeight - verticalPadding);
      const width = Math.min(availableWidth, availableHeight * layout.width / layout.height);
      setPreviewStyle({ width: `${width}px`, height: `${width * layout.height / layout.width}px` });
    };
    updatePreviewSize();
    const observer = new ResizeObserver(updatePreviewSize);
    observer.observe(stage);
    window.addEventListener("orientationchange", updatePreviewSize);
    return () => {
      observer.disconnect();
      window.removeEventListener("orientationchange", updatePreviewSize);
    };
  }, [layout.width, layout.height]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = layout.width;
    canvas.height = layout.height;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#050505";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    layout.panels.forEach((panel, index) => {
      const source = images[index];
      if (!source) return;
      const placement = imagePlacement(
        { width: source.image.naturalWidth, height: source.image.naturalHeight },
        panel,
        crops[index],
        fits[index],
      );
      context.save();
      tracePanel(context, panel);
      context.clip();
      context.drawImage(source.image, placement.x, placement.y, placement.width, placement.height);
      context.restore();
    });
  }, [layout, images, crops, fits]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const item = Array.from(event.clipboardData?.items ?? []).find((candidate) => candidate.type.startsWith("image/"));
      const file = item?.getAsFile();
      if (!file) return;
      event.preventDefault();
      const panelIndex = activePanel;
      void readFileAsDataUrl(file)
        .then((dataUrl) => createPanelImage(file.name || `コマ${panelIndex + 1}.png`, dataUrl))
        .then((image) => {
          setImages((current) => current.map((value, index) => index === panelIndex ? image : value));
          setCrops((current) => current.map((crop, index) => index === panelIndex ? { ...DEFAULT_PANEL_CROP } : crop));
          setError("");
        })
        .catch(() => setError("貼り付けた画像を読み込めませんでした。"));
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [activePanel]);
  const setImageFromFiles = async (panelIndex: number, files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    try {
      const image = await createPanelImage(file.name, await readFileAsDataUrl(file));
      setImages((current) => current.map((item, index) => index === panelIndex ? image : item));
      setCrops((current) => current.map((crop, index) => index === panelIndex ? { ...DEFAULT_PANEL_CROP } : crop));
      setActivePanel(panelIndex);
      setError("");
    } catch {
      setError("画像を読み込めませんでした。PNG、JPEG、WebPを使ってください。");
    }
  };

  const setActiveCrop = (update: Partial<PanelCrop> | PanelCrop) => {
    setCrops((current) => current.map((crop, index) => index === activePanel ? { ...crop, ...update } : crop));
  };

  const setActiveFit = (fit: PanelFit) => {
    setFits((current) => current.map((value, index) => index === activePanel ? fit : value));
    setActiveCrop({ ...DEFAULT_PANEL_CROP });
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) * layout.width / rect.width;
    const y = (event.clientY - rect.top) * layout.height / rect.height;
    const index = panelIndexAtPoint(layout, x, y);
    setActivePanel(index);
    dragPanelRef.current = index;
    activePointerRef.current = event.pointerId;
    lastPointerRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (activePointerRef.current !== event.pointerId) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const deltaX = (event.clientX - lastPointerRef.current.x) * layout.width / rect.width;
    const deltaY = (event.clientY - lastPointerRef.current.y) * layout.height / rect.height;
    lastPointerRef.current = { x: event.clientX, y: event.clientY };
    setCrops((current) => current.map((crop, index) => index === dragPanelRef.current
      ? { ...crop, offsetX: crop.offsetX + deltaX, offsetY: crop.offsetY + deltaY }
      : crop));
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (activePointerRef.current !== event.pointerId) return;
    activePointerRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const reversePanels = () => {
    const reverseHead = <T,>(values: T[]) => [...values.slice(0, panelCount).reverse(), ...values.slice(panelCount)];
    setImages(reverseHead);
    setCrops(reverseHead);
    setFits(reverseHead);
    setActivePanel(panelCount - 1 - activePanel);
  };

  const setBoundaryRatio = (index: number, value: number) => {
    setBoundaryRatios((current) => {
      const next = current[panelCount].map((ratio, ratioIndex) => ratioIndex === index ? value : ratio);
      return { ...current, [panelCount]: normalizeBoundaryRatios(panelCount, next) };
    });
  };

  const setAngle = (value: number) => {
    const next = clampAnglePercent(value);
    setAngles((current) => ({ ...current, [panelCount]: next }));
    if (rememberAngles[panelCount]) writeAngleDefault(panelCount, next);
  };

  const setRememberAngle = (checked: boolean) => {
    setRememberAngles((current) => ({ ...current, [panelCount]: checked }));
    writeAngleDefault(panelCount, checked ? angles[panelCount] : undefined);
  };

  const apply = () => {
    if (!canvasRef.current || !allImagesReady) return;
    onApply(canvasRef.current.toDataURL("image/png"), { width: layout.width, height: layout.height }, panelCount);
  };

  const activePolygon = layout.panels[activePanel].polygon.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <section className="two-panel-editor" aria-label="2・3コマ結合">
      {Array.from({ length: 3 }, (_, index) => (
        <input
          key={index}
          ref={(element) => { inputRefs.current[index] = element; }}
          hidden
          type="file"
          accept="image/*"
          onChange={(event) => { void setImageFromFiles(index, event.target.files); event.target.value = ""; }}
        />
      ))}

      <header className="two-panel-topbar">
        <button title="キャンセル" onClick={onCancel}><X size={20} /><span>キャンセル</span></button>
        <div><strong>{panelCount}コマ結合</strong><span>{layout.width} x {layout.height}px</span></div>
        <button title="コマの上下を入れ替え" disabled={!images.slice(0, panelCount).some(Boolean)} onClick={reversePanels}><ArrowUpDown size={20} /></button>
        <button className="primary" title="結合して編集" disabled={!allImagesReady} onClick={apply}><Check size={20} /><span>結合して編集</span></button>
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
          <svg className="two-panel-overlay" viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden="true">
            <polygon className="two-panel-selection" points={activePolygon} />
            {layout.boundaries.map((boundary, index) => (
              <line key={index} className="two-panel-seam" x1="0" y1={boundary.leftY} x2={layout.width} y2={boundary.rightY} />
            ))}
          </svg>
          {layout.panels.map((panel, index) => !images[index] && (
            <button
              key={index}
              className="two-panel-empty-slot"
              style={{ top: `${(panel.contentRect.y + panel.contentRect.height / 2) / layout.height * 100}%` }}
              onClick={() => inputRefs.current[index]?.click()}
            >
              <ImagePlus size={23} />{panelLabel(index, panelCount)}の画像
            </button>
          ))}
        </div>
      </div>

      <footer className="two-panel-controls">
        <div className="two-panel-count-switch" aria-label="コマ数">
          <button className={panelCount === 2 ? "active" : ""} onClick={() => { setPanelCount(2); setActivePanel((current) => Math.min(current, 1)); }}>2コマ</button>
          <button className={panelCount === 3 ? "active" : ""} onClick={() => setPanelCount(3)}>3コマ</button>
        </div>

        <div className="two-panel-tabs" aria-label="調整するコマ" style={{ gridTemplateColumns: `repeat(${panelCount}, minmax(0, 1fr))` }}>
          {layout.panels.map((_, index) => (
            <button key={index} className={activePanel === index ? "active" : ""} onClick={() => setActivePanel(index)}>
              <PanelsTopLeft size={17} />{panelLabel(index, panelCount)}
            </button>
          ))}
        </div>

        <button className="two-panel-reselect" onClick={() => inputRefs.current[activePanel]?.click()}><ImagePlus size={18} />画像を選び直す</button>

        <div className="two-panel-fit-switch" aria-label="画像の表示方法">
          <button className={activeFit === "contain" ? "active" : ""} onClick={() => setActiveFit("contain")}>画像全体</button>
          <button className={activeFit === "cover" ? "active" : ""} onClick={() => setActiveFit("cover")}>枠いっぱい</button>
        </div>

        <div className="two-panel-size-controls">
          <DimensionField label="幅" value={outputWidth} onChange={setOutputWidth} />
          <DimensionField label="高さ" value={outputHeight} onChange={setOutputHeight} />
        </div>

        {boundaryRatios[panelCount].map((ratio, index) => (
          <label key={index} className="two-panel-range-field">
            <span>{panelCount === 2 ? "コマ境界" : `境界${index + 1}`} <b>{Math.round(ratio * 100)}%</b></span>
            <input
              type="range"
              min={panelCount === 2 ? 0.2 : index === 0 ? 0.15 : 0.35}
              max={panelCount === 2 ? 0.8 : index === 0 ? 0.65 : 0.85}
              step="0.01"
              value={ratio}
              onChange={(event) => setBoundaryRatio(index, Number(event.target.value))}
            />
          </label>
        ))}

        <div className="two-panel-angle-field">
          <span>境界の傾き <b>{angles[panelCount]}%</b></span>
          <label className="two-panel-remember-angle">
            <input type="checkbox" checked={rememberAngles[panelCount]} onChange={(event) => setRememberAngle(event.target.checked)} />
            既定にする
          </label>
          <input type="range" min="-100" max="100" step="1" value={angles[panelCount]} onChange={(event) => setAngle(Number(event.target.value))} />
        </div>

        <label className="two-panel-range-field two-panel-zoom-field">
          <span>画像の拡大 <b>{Math.round(activeCrop.zoom * 100)}%</b></span>
          <input type="range" min="1" max="3" step="0.01" value={activeCrop.zoom} onChange={(event) => setActiveCrop({ zoom: Number(event.target.value) })} />
        </label>

        <button className="two-panel-reset" onClick={() => setActiveCrop({ ...DEFAULT_PANEL_CROP })}><RotateCcw size={18} />位置と拡大を戻す</button>
        {error && <span className="two-panel-error">{error}</span>}
      </footer>
    </section>
  );
}
