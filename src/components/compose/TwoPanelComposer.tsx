import { ArrowUpDown, Check, ImagePlus, Move, PanelsTopLeft, Pipette, RotateCcw, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { createColorPatch, rgbToHex, transformColorPatch, type ColorPatch, type PatchTransform } from "../../editor/colorPatch";
import { createPinchSnapshot, type PinchSnapshot } from "../../editor/touchGestures";
import {
  clampAnglePercent,
  clampOutputSize,
  createPanelLayout,
  DEFAULT_BOUNDARY_RATIOS,
  DEFAULT_PANEL_CROP,
  DEFAULT_SUBPANEL_RATIOS,
  imagePlacement,
  normalizeBoundaryRatios,
  normalizeSubpanelRatios,
  panelIndexAtPoint,
  SHORTS_HEIGHT,
  SHORTS_WIDTH,
  splitPanelGeometry,
  subpanelIndexAtX,
  type PanelCount,
  type PanelCrop,
  type PanelFit,
  type PanelGeometry,
  type SubpanelCount,
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
type SplitRatioSettings = Array<Record<SubpanelCount, number[]>>;
type CellMatrix<T> = T[][];
type ComposerTool = "image" | "eyedropper";

type DragState = {
  zone: number;
  cell: number;
  lastX: number;
  lastY: number;
};

type PinchState = {
  zone: number;
  cell: number;
  start: PinchSnapshot;
  startCrop: PanelCrop;
};

type PatchGesture = {
  pointerId: number;
  transform: PatchTransform;
  startX: number;
  startY: number;
  patch: ColorPatch;
};

const ANGLE_DEFAULTS_KEY = "fukidashi-studio-panel-angle-defaults";
const ZONE_LABELS = ["上", "中央", "下"];

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

function createMatrix<T>(factory: () => T): CellMatrix<T> {
  return Array.from({ length: 3 }, () => Array.from({ length: 3 }, factory));
}

function replaceMatrixCell<T>(matrix: CellMatrix<T>, zone: number, cell: number, value: T): CellMatrix<T> {
  return matrix.map((row, zoneIndex) => zoneIndex === zone
    ? row.map((current, cellIndex) => cellIndex === cell ? value : current)
    : row);
}

function updateMatrixCell<T>(matrix: CellMatrix<T>, zone: number, cell: number, update: (value: T) => T): CellMatrix<T> {
  return matrix.map((row, zoneIndex) => zoneIndex === zone
    ? row.map((current, cellIndex) => cellIndex === cell ? update(current) : current)
    : row);
}

function createSplitRatioSettings(): SplitRatioSettings {
  return Array.from({ length: 3 }, () => ({
    1: [],
    2: [...DEFAULT_SUBPANEL_RATIOS[2]],
    3: [...DEFAULT_SUBPANEL_RATIOS[3]],
  }));
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

function zoneLabel(index: number, panelCount: PanelCount) {
  if (panelCount === 2) return index === 0 ? "上" : "下";
  return ZONE_LABELS[index];
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
        <input type="number" min="320" max="4096" step="10" value={value} onChange={(event) => onChange(Number(event.target.value))} onBlur={() => commit(value)} />
        <span>
          <button type="button" title={`${label}を増やす`} onClick={() => commit(value + 10)}>↑</button>
          <button type="button" title={`${label}を減らす`} onClick={() => commit(value - 10)}>↓</button>
        </span>
      </span>
    </label>
  );
}

function PatchDimensionField({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (value: number) => void }) {
  const commit = (next: number) => onChange(Math.round(Math.min(max, Math.max(12, next))));
  return (
    <label className="two-panel-dimension-field">
      <span>{label}</span>
      <span className="two-panel-dimension-control">
        <input type="number" min="12" max={max} step="10" value={Math.round(value)} onChange={(event) => commit(Number(event.target.value))} />
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
  const previewRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pendingCellRef = useRef({ zone: 0, cell: 0 });
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const dragRef = useRef<DragState | null>(null);
  const pinchRef = useRef<PinchState | null>(null);
  const patchGestureRef = useRef<PatchGesture | null>(null);
  const [panelCount, setPanelCount] = useState<PanelCount>(2);
  const [zoneSplits, setZoneSplits] = useState<SubpanelCount[]>([1, 1, 1]);
  const [splitRatios, setSplitRatios] = useState<SplitRatioSettings>(createSplitRatioSettings);
  const [images, setImages] = useState<CellMatrix<PanelImage | undefined>>(() => createMatrix(() => undefined));
  const [crops, setCrops] = useState<CellMatrix<PanelCrop>>(() => createMatrix(() => ({ ...DEFAULT_PANEL_CROP })));
  const [fits, setFits] = useState<CellMatrix<PanelFit>>(() => createMatrix(() => "contain"));
  const [activeZone, setActiveZone] = useState(0);
  const [activeCell, setActiveCell] = useState(0);
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
  const [patches, setPatches] = useState<ColorPatch[]>([]);
  const [selectedPatchId, setSelectedPatchId] = useState<string>();
  const [composerTool, setComposerTool] = useState<ComposerTool>("image");
  const [error, setError] = useState("");
  const [previewStyle, setPreviewStyle] = useState<CSSProperties>();

  const layout = useMemo(
    () => createPanelLayout(panelCount, boundaryRatios[panelCount], angles[panelCount], outputWidth, outputHeight),
    [panelCount, boundaryRatios, angles, outputWidth, outputHeight],
  );
  const zoneCells = useMemo(
    () => layout.panels.map((zone, index) => splitPanelGeometry(zone, zoneSplits[index], splitRatios[index][zoneSplits[index]])),
    [layout, zoneSplits, splitRatios],
  );
  const activeGeometry = zoneCells[activeZone]?.[activeCell] ?? zoneCells[0][0];
  const activeCrop = crops[activeZone][activeCell];
  const activeFit = fits[activeZone][activeCell];
  const selectedPatch = patches.find((patch) => patch.id === selectedPatchId);
  const allImagesReady = zoneCells.every((cells, zone) => cells.every((_, cell) => Boolean(images[zone][cell])));

  useEffect(() => {
    if (!initialImage) return;
    let cancelled = false;
    void createPanelImage(initialImage.name, initialImage.dataUrl)
      .then((image) => { if (!cancelled) setImages((current) => replaceMatrixCell(current, 0, 0, image)); })
      .catch(() => { if (!cancelled) setError("現在の画像を読み込めませんでした。"); });
    return () => { cancelled = true; };
  }, [initialImage]);

  useEffect(() => {
    if (activeZone >= panelCount) {
      setActiveZone(panelCount - 1);
      setActiveCell(0);
    }
  }, [activeZone, panelCount]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const updatePreviewSize = () => {
      const styles = window.getComputedStyle(stage);
      const horizontalPadding = Number.parseFloat(styles.paddingLeft) + Number.parseFloat(styles.paddingRight);
      const verticalPadding = Number.parseFloat(styles.paddingTop) + Number.parseFloat(styles.paddingBottom);
      const availableWidth = Math.max(1, stage.clientWidth - horizontalPadding - 58);
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
    zoneCells.forEach((cells, zone) => {
      cells.forEach((panel, cell) => {
        const source = images[zone][cell];
        if (!source) return;
        const placement = imagePlacement(
          { width: source.image.naturalWidth, height: source.image.naturalHeight },
          panel,
          crops[zone][cell],
          fits[zone][cell],
        );
        context.save();
        tracePanel(context, panel);
        context.clip();
        context.drawImage(source.image, placement.x, placement.y, placement.width, placement.height);
        context.restore();
      });
    });
    patches.forEach((patch) => {
      context.fillStyle = patch.color;
      context.fillRect(patch.x, patch.y, patch.width, patch.height);
    });
  }, [layout, zoneCells, images, crops, fits, patches]);

  useEffect(() => {
    setPatches((current) => {
      let changed = false;
      const next = current.map((patch) => {
        const clamped = transformColorPatch(patch, "move", 0, 0, layout.width, layout.height);
        if (clamped.x !== patch.x || clamped.y !== patch.y || clamped.width !== patch.width || clamped.height !== patch.height) changed = true;
        return clamped;
      });
      return changed ? next : current;
    });
  }, [layout.width, layout.height]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const item = Array.from(event.clipboardData?.items ?? []).find((candidate) => candidate.type.startsWith("image/"));
      const file = item?.getAsFile();
      if (!file) return;
      event.preventDefault();
      const zone = activeZone;
      const cell = activeCell;
      void readFileAsDataUrl(file)
        .then((dataUrl) => createPanelImage(file.name || `コマ${zone + 1}-${cell + 1}.png`, dataUrl))
        .then((image) => {
          setImages((current) => replaceMatrixCell(current, zone, cell, image));
          setCrops((current) => replaceMatrixCell(current, zone, cell, { ...DEFAULT_PANEL_CROP }));
          setError("");
        })
        .catch(() => setError("貼り付けた画像を読み込めませんでした。"));
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [activeZone, activeCell]);

  const openImagePicker = (zone: number, cell: number) => {
    pendingCellRef.current = { zone, cell };
    setActiveZone(zone);
    setActiveCell(cell);
    inputRef.current?.click();
  };

  const setImageFromFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const { zone, cell } = pendingCellRef.current;
    try {
      const image = await createPanelImage(file.name, await readFileAsDataUrl(file));
      setImages((current) => replaceMatrixCell(current, zone, cell, image));
      setCrops((current) => replaceMatrixCell(current, zone, cell, { ...DEFAULT_PANEL_CROP }));
      setActiveZone(zone);
      setActiveCell(cell);
      setError("");
    } catch {
      setError("画像を読み込めませんでした。PNG、JPEG、WebPを使ってください。");
    }
  };

  const setCellCrop = (zone: number, cell: number, update: Partial<PanelCrop>) => {
    setCrops((current) => updateMatrixCell(current, zone, cell, (crop) => ({ ...crop, ...update })));
  };

  const setActiveCrop = (update: Partial<PanelCrop>) => setCellCrop(activeZone, activeCell, update);

  const setActiveFit = (fit: PanelFit) => {
    setFits((current) => replaceMatrixCell(current, activeZone, activeCell, fit));
    setCrops((current) => replaceMatrixCell(current, activeZone, activeCell, { ...DEFAULT_PANEL_CROP }));
    setSelectedPatchId(undefined);
  };

  const pointFromEvent = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * layout.width / rect.width,
      y: (event.clientY - rect.top) * layout.height / rect.height,
      rect,
    };
  };

  const createPatchFromPoint = (x: number, y: number) => {
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    try {
      const pixel = context.getImageData(Math.min(layout.width - 1, Math.max(0, Math.floor(x))), Math.min(layout.height - 1, Math.max(0, Math.floor(y))), 1, 1).data;
      const patch = createColorPatch(`patch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, x, y, rgbToHex(pixel[0], pixel[1], pixel[2]), layout.width, layout.height);
      setPatches((current) => [...current, patch]);
      setSelectedPatchId(patch.id);
      setComposerTool("image");
    } catch {
      setError("この位置の色を取得できませんでした。");
    }
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const point = pointFromEvent(event);
    if (composerTool === "eyedropper") {
      createPatchFromPoint(point.x, point.y);
      return;
    }
    const hitPatch = [...patches].reverse().find((patch) => point.x >= patch.x && point.x <= patch.x + patch.width && point.y >= patch.y && point.y <= patch.y + patch.height);
    if (hitPatch) {
      setSelectedPatchId(hitPatch.id);
      return;
    }
    setSelectedPatchId(undefined);
    const zone = panelIndexAtPoint(layout, point.x, point.y);
    const cell = subpanelIndexAtX(layout.panels[zone], zoneSplits[zone], splitRatios[zone][zoneSplits[zone]], point.x);
    setActiveZone(zone);
    setActiveCell(cell);
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size === 1) {
      dragRef.current = { zone, cell, lastX: event.clientX, lastY: event.clientY };
      pinchRef.current = null;
      return;
    }
    if (pointersRef.current.size === 2) {
      const target = dragRef.current ?? { zone, cell, lastX: event.clientX, lastY: event.clientY };
      const points = [...pointersRef.current.values()];
      const currentFit = fits[target.zone][target.cell];
      const startCrop = currentFit === "custom" ? crops[target.zone][target.cell] : { ...DEFAULT_PANEL_CROP };
      if (currentFit !== "custom") {
        setFits((current) => replaceMatrixCell(current, target.zone, target.cell, "custom"));
        setCrops((current) => replaceMatrixCell(current, target.zone, target.cell, startCrop));
      }
      pinchRef.current = { zone: target.zone, cell: target.cell, start: createPinchSnapshot(points[0], points[1]), startCrop };
      dragRef.current = null;
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    event.preventDefault();
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const rect = event.currentTarget.getBoundingClientRect();
    const pinch = pinchRef.current;
    if (pinch && pointersRef.current.size >= 2) {
      const points = [...pointersRef.current.values()];
      const next = createPinchSnapshot(points[0], points[1]);
      const ratio = next.distance / pinch.start.distance;
      setCellCrop(pinch.zone, pinch.cell, {
        zoom: Math.min(4, Math.max(0.25, pinch.startCrop.zoom * ratio)),
        offsetX: pinch.startCrop.offsetX + (next.midpoint.x - pinch.start.midpoint.x) * layout.width / rect.width,
        offsetY: pinch.startCrop.offsetY + (next.midpoint.y - pinch.start.midpoint.y) * layout.height / rect.height,
      });
      return;
    }
    const drag = dragRef.current;
    if (!drag || pointersRef.current.size !== 1) return;
    const deltaX = (event.clientX - drag.lastX) * layout.width / rect.width;
    const deltaY = (event.clientY - drag.lastY) * layout.height / rect.height;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    setCrops((current) => updateMatrixCell(current, drag.zone, drag.cell, (crop) => ({ ...crop, offsetX: crop.offsetX + deltaX, offsetY: crop.offsetY + deltaY })));
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    pinchRef.current = null;
    if (pointersRef.current.size === 1) {
      const [remaining] = pointersRef.current.values();
      dragRef.current = { zone: activeZone, cell: activeCell, lastX: remaining.x, lastY: remaining.y };
    } else {
      dragRef.current = null;
    }
  };

  const beginPatchGesture = (event: ReactPointerEvent<SVGElement>, transform: PatchTransform) => {
    if (!selectedPatch) return;
    event.preventDefault();
    event.stopPropagation();
    patchGestureRef.current = { pointerId: event.pointerId, transform, startX: event.clientX, startY: event.clientY, patch: selectedPatch };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const movePatchGesture = (event: ReactPointerEvent<SVGElement>) => {
    const gesture = patchGestureRef.current;
    const preview = previewRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId || !preview) return;
    event.preventDefault();
    const rect = preview.getBoundingClientRect();
    const next = transformColorPatch(
      gesture.patch,
      gesture.transform,
      (event.clientX - gesture.startX) * layout.width / rect.width,
      (event.clientY - gesture.startY) * layout.height / rect.height,
      layout.width,
      layout.height,
    );
    setPatches((current) => current.map((patch) => patch.id === next.id ? next : patch));
  };

  const endPatchGesture = (event: ReactPointerEvent<SVGElement>) => {
    if (patchGestureRef.current?.pointerId !== event.pointerId) return;
    patchGestureRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const updateSelectedPatch = (update: Partial<ColorPatch>) => {
    if (!selectedPatchId) return;
    setPatches((current) => current.map((patch) => patch.id === selectedPatchId ? { ...patch, ...update } : patch));
  };

  const deleteSelectedPatch = () => {
    if (!selectedPatchId) return;
    setPatches((current) => current.filter((patch) => patch.id !== selectedPatchId));
    setSelectedPatchId(undefined);
  };

  const reverseZones = () => {
    const reverseHead = <T,>(values: T[]) => [...values.slice(0, panelCount).reverse(), ...values.slice(panelCount)];
    setImages(reverseHead);
    setCrops(reverseHead);
    setFits(reverseHead);
    setZoneSplits(reverseHead);
    setSplitRatios(reverseHead);
    setActiveZone(panelCount - 1 - activeZone);
    setActiveCell(0);
  };

  const setZoneSplit = (count: SubpanelCount) => {
    setZoneSplits((current) => current.map((value, index) => index === activeZone ? count : value));
    setActiveCell((current) => Math.min(current, count - 1));
  };

  const setSubBoundary = (index: number, value: number) => {
    const count = zoneSplits[activeZone];
    setSplitRatios((current) => current.map((setting, zone) => {
      if (zone !== activeZone) return setting;
      const next = setting[count].map((ratio, ratioIndex) => ratioIndex === index ? value : ratio);
      return { ...setting, [count]: normalizeSubpanelRatios(count, next) };
    }));
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

  const activePolygon = activeGeometry.polygon.map((point) => `${point.x},${point.y}`).join(" ");
  const handleSize = Math.max(34, layout.width * 0.055);
  const patchEvents = {
    onPointerMove: movePatchGesture,
    onPointerUp: endPatchGesture,
    onPointerCancel: endPatchGesture,
  };

  return (
    <section className="two-panel-editor" aria-label="2・3コマ結合">
      <input ref={inputRef} hidden type="file" accept="image/*" onChange={(event) => { void setImageFromFiles(event.target.files); event.target.value = ""; }} />

      <header className="two-panel-topbar">
        <button title="キャンセル" onClick={onCancel}><X size={20} /><span>キャンセル</span></button>
        <div><strong>{panelCount}段コマ結合</strong><span>{layout.width} x {layout.height}px</span></div>
        <button title="段の上下を入れ替え" disabled={!images.slice(0, panelCount).flat().some(Boolean)} onClick={reverseZones}><ArrowUpDown size={20} /></button>
        <button className="primary" title="結合して編集" disabled={!allImagesReady} onClick={apply}><Check size={20} /><span>結合して編集</span></button>
      </header>

      <div ref={stageRef} className="two-panel-stage">
        <div className="two-panel-stage-layout">
          <div ref={previewRef} className="two-panel-preview" style={previewStyle}>
            <canvas ref={canvasRef} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} />
            <svg className="two-panel-overlay" viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden="true">
              {!selectedPatch && <polygon className="two-panel-selection" points={activePolygon} />}
              {layout.boundaries.map((boundary, index) => (
                <line key={`row-${index}`} className="two-panel-seam" x1="0" y1={boundary.leftY} x2={layout.width} y2={boundary.rightY} />
              ))}
              {zoneCells.flatMap((cells, zone) => cells.slice(0, -1).map((cell, index) => (
                <line key={`cell-${zone}-${index}`} className="two-panel-sub-seam" x1={cell.polygon[1].x} y1={cell.polygon[1].y} x2={cell.polygon[2].x} y2={cell.polygon[2].y} />
              )))}
              {selectedPatch && (
                <g className="color-patch-selection">
                  <rect className="color-patch-outline" x={selectedPatch.x} y={selectedPatch.y} width={selectedPatch.width} height={selectedPatch.height} />
                  <rect className="color-patch-hit" x={selectedPatch.x} y={selectedPatch.y} width={selectedPatch.width} height={selectedPatch.height} onPointerDown={(event) => beginPatchGesture(event, "move")} {...patchEvents} />
                  <rect className="color-patch-handle" x={selectedPatch.x - handleSize / 2} y={selectedPatch.y + selectedPatch.height / 2 - handleSize / 2} width={handleSize} height={handleSize} onPointerDown={(event) => beginPatchGesture(event, "west")} {...patchEvents} />
                  <rect className="color-patch-handle" x={selectedPatch.x + selectedPatch.width - handleSize / 2} y={selectedPatch.y + selectedPatch.height / 2 - handleSize / 2} width={handleSize} height={handleSize} onPointerDown={(event) => beginPatchGesture(event, "east")} {...patchEvents} />
                  <rect className="color-patch-handle" x={selectedPatch.x + selectedPatch.width / 2 - handleSize / 2} y={selectedPatch.y - handleSize / 2} width={handleSize} height={handleSize} onPointerDown={(event) => beginPatchGesture(event, "north")} {...patchEvents} />
                  <rect className="color-patch-handle" x={selectedPatch.x + selectedPatch.width / 2 - handleSize / 2} y={selectedPatch.y + selectedPatch.height - handleSize / 2} width={handleSize} height={handleSize} onPointerDown={(event) => beginPatchGesture(event, "south")} {...patchEvents} />
                  <rect className="color-patch-handle corner" x={selectedPatch.x + selectedPatch.width - handleSize / 2} y={selectedPatch.y + selectedPatch.height - handleSize / 2} width={handleSize} height={handleSize} onPointerDown={(event) => beginPatchGesture(event, "southeast")} {...patchEvents} />
                </g>
              )}
            </svg>
            {zoneCells.flatMap((cells, zone) => cells.map((cell, index) => !images[zone][index] && (
              <button
                key={`${zone}-${index}`}
                className={`two-panel-empty-slot${zoneSplits[zone] === 3 ? " compact" : ""}`}
                style={{
                  left: `${(cell.contentRect.x + cell.contentRect.width / 2) / layout.width * 100}%`,
                  top: `${(cell.contentRect.y + cell.contentRect.height / 2) / layout.height * 100}%`,
                  width: `${Math.max(11, Math.min(zoneSplits[zone] === 3 ? 18 : 28, cell.contentRect.width / layout.width * 100 - 2))}%`,
                }}
                aria-label={`${zoneLabel(zone, panelCount)}${zoneSplits[zone] > 1 ? index + 1 : ""}の画像を選ぶ`}
                title="画像を選ぶ"
                onClick={() => openImagePicker(zone, index)}
              >
                <ImagePlus size={19} /><span>{zoneLabel(zone, panelCount)}{zoneSplits[zone] > 1 ? index + 1 : ""}</span>
              </button>
            )))}
          </div>

          <div className="two-panel-zone-rail" style={{ height: previewStyle?.height }} aria-label="調整する段">
            {layout.panels.map((zone, index) => (
              <button
                key={index}
                className={activeZone === index ? "active" : ""}
                style={{ top: `${(zone.contentRect.y + zone.contentRect.height / 2) / layout.height * 100}%` }}
                title={`${zoneLabel(index, panelCount)}の段`}
                onClick={() => { setActiveZone(index); setActiveCell(0); setSelectedPatchId(undefined); }}
              >
                <PanelsTopLeft size={16} /><span>{zoneLabel(index, panelCount)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <footer className="two-panel-controls">
        <div className="two-panel-count-switch" aria-label="段数">
          <button className={panelCount === 2 ? "active" : ""} onClick={() => { setPanelCount(2); setActiveZone((current) => Math.min(current, 1)); setActiveCell(0); }}>2段</button>
          <button className={panelCount === 3 ? "active" : ""} onClick={() => setPanelCount(3)}>3段</button>
        </div>

        <div className="two-panel-split-switch" aria-label="段内の分割数">
          {[1, 2, 3].map((value) => (
            <button key={value} className={zoneSplits[activeZone] === value ? "active" : ""} onClick={() => setZoneSplit(value as SubpanelCount)}>{value}コマ</button>
          ))}
        </div>

        <div className="two-panel-cell-tabs" aria-label="調整する小コマ" style={{ gridTemplateColumns: `repeat(${zoneSplits[activeZone]}, minmax(0, 1fr))` }}>
          {zoneCells[activeZone].map((_, index) => (
            <button key={index} className={activeCell === index && !selectedPatch ? "active" : ""} onClick={() => { setActiveCell(index); setSelectedPatchId(undefined); }}>
              コマ{index + 1}
            </button>
          ))}
        </div>

        <button className="two-panel-reselect" onClick={() => openImagePicker(activeZone, activeCell)}><ImagePlus size={18} />画像を選び直す</button>

        <div className="two-panel-fit-switch" aria-label="画像の表示方法">
          <button className={activeFit === "contain" && !selectedPatch ? "active" : ""} onClick={() => setActiveFit("contain")}>画像全体</button>
          <button className={activeFit === "cover" && !selectedPatch ? "active" : ""} onClick={() => setActiveFit("cover")}>枠いっぱい</button>
          <button className={activeFit === "custom" && !selectedPatch ? "active" : ""} onClick={() => setActiveFit("custom")}>カスタム</button>
        </div>

        <div className="two-panel-tool-switch" aria-label="編集ツール">
          <button className={composerTool === "image" ? "active" : ""} title="画像・色矩形を調整" onClick={() => setComposerTool("image")}><Move size={17} />調整</button>
          <button className={composerTool === "eyedropper" ? "active" : ""} title="タップ位置の色で隠す" onClick={() => { setComposerTool("eyedropper"); setSelectedPatchId(undefined); }}><Pipette size={17} />スポイト</button>
        </div>

        {selectedPatch && (
          <div className="color-patch-controls">
            <label className="color-patch-color-field">色<input type="color" value={selectedPatch.color} onChange={(event) => updateSelectedPatch({ color: event.target.value })} /></label>
            <PatchDimensionField label="矩形の幅" value={selectedPatch.width} max={layout.width - selectedPatch.x} onChange={(width) => updateSelectedPatch({ width })} />
            <PatchDimensionField label="矩形の高さ" value={selectedPatch.height} max={layout.height - selectedPatch.y} onChange={(height) => updateSelectedPatch({ height })} />
            <button className="mosaic-clear-button" onClick={deleteSelectedPatch}><Trash2 size={17} />色矩形を削除</button>
          </div>
        )}

        <div className="two-panel-size-controls">
          <DimensionField label="外枠の幅" value={outputWidth} onChange={setOutputWidth} />
          <DimensionField label="外枠の高さ" value={outputHeight} onChange={setOutputHeight} />
        </div>

        {boundaryRatios[panelCount].map((ratio, index) => (
          <label key={`row-${index}`} className="two-panel-range-field">
            <span>{panelCount === 2 ? "段境界" : `段境界${index + 1}`} <b>{Math.round(ratio * 100)}%</b></span>
            <input type="range" min={panelCount === 2 ? 0.2 : index === 0 ? 0.15 : 0.35} max={panelCount === 2 ? 0.8 : index === 0 ? 0.65 : 0.85} step="0.01" value={ratio} onChange={(event) => setBoundaryRatio(index, Number(event.target.value))} />
          </label>
        ))}

        {splitRatios[activeZone][zoneSplits[activeZone]].map((ratio, index) => (
          <label key={`cell-${index}`} className="two-panel-range-field subpanel-boundary-field">
            <span>コマ境界{zoneSplits[activeZone] === 2 ? "" : index + 1} <b>{Math.round(ratio * 100)}%</b></span>
            <input type="range" min={zoneSplits[activeZone] === 2 ? 0.2 : index === 0 ? 0.15 : 0.35} max={zoneSplits[activeZone] === 2 ? 0.8 : index === 0 ? 0.65 : 0.85} step="0.01" value={ratio} onChange={(event) => setSubBoundary(index, Number(event.target.value))} />
          </label>
        ))}

        <div className="two-panel-angle-field">
          <span>段境界の傾き <b>{angles[panelCount]}%</b></span>
          <label className="two-panel-remember-angle"><input type="checkbox" checked={rememberAngles[panelCount]} onChange={(event) => setRememberAngle(event.target.checked)} />既定にする</label>
          <input type="range" min="-100" max="100" step="1" value={angles[panelCount]} onChange={(event) => setAngle(Number(event.target.value))} />
        </div>

        <label className="two-panel-range-field two-panel-zoom-field">
          <span>画像の拡大 <b>{Math.round(activeCrop.zoom * 100)}%</b></span>
          <input type="range" min={activeFit === "custom" ? "0.25" : "1"} max="4" step="0.01" value={activeCrop.zoom} onChange={(event) => setActiveCrop({ zoom: Number(event.target.value) })} />
        </label>

        <button className="two-panel-reset" onClick={() => setActiveCrop({ ...DEFAULT_PANEL_CROP })}><RotateCcw size={18} />位置と拡大を戻す</button>
        {error && <span className="two-panel-error">{error}</span>}
      </footer>
    </section>
  );
}
