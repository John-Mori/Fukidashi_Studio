import * as fabric from "fabric";
import { createBubbleObject, createShapeObject, createTextObject, displayTextForWritingMode } from "../../project/model/defaults";
import type { BubbleObject, CanvasSize, EditorObject, ExportOptions, ProjectDocument, ShapeObject, TemplateAsset, TextObject, ViewState } from "../../project/model/types";
import { clampZoom, fitToViewport, zoomAroundPoint } from "../viewport";
import { rgbaToHex } from "../../platform/browser/fileHelpers";
import { createEyedropperPatchShape } from "../eyedropperPatch";

type FabricObject = any;
type FabricCanvas = any;

type AdapterCallbacks = {
  onCommit: (objects: EditorObject[], history: boolean) => void;
  onSelection: (ids: string[]) => void;
  onZoom: (zoom: number) => void;
  onColorPicked: (color: string) => void;
  onToast: (text: string, tone?: "info" | "success" | "warning" | "error") => void;
};

const ImageClass = (fabric as any).FabricImage ?? (fabric as any).Image;
const CanvasClass = (fabric as any).Canvas;
const StaticCanvasClass = (fabric as any).StaticCanvas;
const TextboxClass = (fabric as any).Textbox;
const RectClass = (fabric as any).Rect;
const EllipseClass = (fabric as any).Ellipse;
const LineClass = (fabric as any).Line;

function loadHtmlImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image decode failed"));
    image.src = dataUrl;
  });
}

async function createFabricImage(dataUrl: string): Promise<FabricObject> {
  const image = await loadHtmlImage(dataUrl);
  return new ImageClass(image);
}

function sortByZIndex(objects: EditorObject[]): EditorObject[] {
  return [...objects].sort((a, b) => a.zIndex - b.zIndex);
}

function usesTouchControls(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}

function objectData(object: FabricObject) {
  return object.data ?? {};
}

function applyTransform(fabricObject: FabricObject, object: EditorObject): void {
  fabricObject.set({
    left: object.transform.x,
    top: object.transform.y,
    scaleX: object.transform.scaleX,
    scaleY: object.transform.scaleY,
    angle: object.transform.rotation,
    flipX: object.transform.flipX,
    flipY: object.transform.flipY,
    opacity: object.opacity,
    visible: object.visible,
    selectable: !object.locked,
    evented: !object.locked,
    lockMovementX: object.locked,
    lockMovementY: object.locked,
    lockRotation: object.locked,
    lockScalingX: object.locked,
    lockScalingY: object.locked,
    cornerSize: usesTouchControls() ? 22 : 13,
    touchCornerSize: 40,
    padding: usesTouchControls() ? 6 : 0,
    transparentCorners: false,
    cornerColor: "#4f9cff",
  });
}

function transformFromFabric(object: FabricObject) {
  return {
    x: Number(object.left ?? 0),
    y: Number(object.top ?? 0),
    scaleX: Number(object.scaleX ?? 1),
    scaleY: Number(object.scaleY ?? 1),
    rotation: Number(object.angle ?? 0),
    flipX: Boolean(object.flipX),
    flipY: Boolean(object.flipY),
  };
}

function commonFromFabric(object: FabricObject) {
  const data = objectData(object);
  return {
    id: String(data.id),
    name: String(data.name ?? data.type),
    transform: transformFromFabric(object),
    opacity: Number(object.opacity ?? 1),
    visible: Boolean(object.visible ?? true),
    locked: Boolean(data.locked ?? false),
    zIndex: Number(data.zIndex ?? 1),
    pairId: data.pairId as string | undefined,
  };
}

function hexOrFallback(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

export class FabricEditorAdapter {
  private readonly canvas: FabricCanvas;
  private readonly callbacks: AdapterCallbacks;
  private project: ProjectDocument;
  private viewport: CanvasSize = { width: 1, height: 1 };
  private view: ViewState = { zoom: 1, panX: 0, panY: 0 };
  private activeTool = "select";
  private isPanning = false;
  private lastPanPoint = { x: 0, y: 0 };
  private isRestoring = false;

  constructor(canvasElement: HTMLCanvasElement, project: ProjectDocument, callbacks: AdapterCallbacks) {
    this.project = project;
    this.callbacks = callbacks;
    this.canvas = new CanvasClass(canvasElement, {
      selection: true,
      preserveObjectStacking: true,
      backgroundColor: "#111827",
      stopContextMenu: true,
      fireRightClick: true,
      allowTouchScrolling: false,
    });
    this.bindEvents();
  }

  dispose(): void {
    this.canvas.dispose();
  }

  setProjectReference(project: ProjectDocument): void {
    this.project = project;
  }

  setActiveTool(tool: string): void {
    this.activeTool = tool;
    this.canvas.defaultCursor = tool === "pan" ? "grab" : tool === "eyedropper" ? "crosshair" : "default";
  }

  setViewportSize(size: CanvasSize): void {
    this.viewport = { width: Math.max(1, size.width), height: Math.max(1, size.height) };
    this.canvas.setDimensions(this.viewport);
    if (this.project.assets.baseImage) {
      this.fitToViewport();
    }
  }

  async restore(project: ProjectDocument, fit = false): Promise<void> {
    this.isRestoring = true;
    this.project = project;
    this.canvas.clear();
    this.canvas.backgroundColor = "#111827";

    if (project.assets.baseImage) {
      const background = await createFabricImage(project.assets.baseImage.dataUrl);
      background.set({
        left: 0,
        top: 0,
        originX: "left",
        originY: "top",
        selectable: false,
        evented: false,
        data: { system: "background" },
      });
      this.canvas.add(background);
      background.sendToBack?.();
    }

    for (const object of sortByZIndex(project.objects)) {
      const fabricObject = await this.createFabricObject(object);
      if (fabricObject) this.canvas.add(fabricObject);
    }

    this.canvas.discardActiveObject();
    this.canvas.requestRenderAll();
    if (fit) this.fitToViewport();
    else this.applyViewport();
    this.isRestoring = false;
  }

  fitToViewport(): void {
    this.view = fitToViewport(this.project.canvas, this.viewport);
    this.applyViewport();
  }

  setZoom(zoom: number): void {
    const center = { x: this.viewport.width / 2, y: this.viewport.height / 2 };
    this.view = zoomAroundPoint(this.view, clampZoom(zoom), center);
    this.applyViewport();
  }

  zoomBy(delta: number, point?: { x: number; y: number }): void {
    const pivot = point ?? { x: this.viewport.width / 2, y: this.viewport.height / 2 };
    this.view = zoomAroundPoint(this.view, this.view.zoom * delta, pivot);
    this.applyViewport();
  }

  panBy(deltaX: number, deltaY: number): void {
    this.view = { ...this.view, panX: this.view.panX + deltaX, panY: this.view.panY + deltaY };
    this.applyViewport();
  }

  async loadBaseImage(asset: ProjectDocument["assets"]["baseImage"]): Promise<void> {
    if (!asset) return;
    const next: ProjectDocument = {
      ...this.project,
      canvas: { width: asset.width, height: asset.height, backgroundAssetId: asset.id },
      assets: { ...this.project.assets, baseImage: asset },
      objects: [],
    };
    await this.restore(next, true);
    this.callbacks.onCommit([], true);
  }

  async addTemplateBubble(asset: TemplateAsset): Promise<string> {
    const bubble = createBubbleObject(asset, this.project.canvas);
    const fabricObject = await this.createFabricObject(bubble);
    if (!fabricObject) throw new Error("Bubble image could not be created");
    this.canvas.add(fabricObject);
    this.canvas.setActiveObject(fabricObject);
    this.commit(true);
    return bubble.id;
  }

  async addText(initial?: Partial<TextObject>): Promise<string> {
    const text = createTextObject({
      ...initial,
      transform: initial?.transform ?? {
        x: this.project.canvas.width * 0.42,
        y: this.project.canvas.height * 0.22,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        flipX: false,
        flipY: false,
      },
    });
    const fabricObject = await this.createFabricObject(text);
    this.canvas.add(fabricObject);
    this.canvas.setActiveObject(fabricObject);
    this.commit(true);
    return text.id;
  }

  async addShape(kind: ShapeObject["kind"], fill: string, stroke: string): Promise<string> {
    const shape = createShapeObject(kind, this.project.canvas, fill, stroke);
    const fabricObject = await this.createFabricObject(shape);
    this.canvas.add(fabricObject);
    this.canvas.setActiveObject(fabricObject);
    this.commit(true);
    return shape.id;
  }

  updateObject(id: string, patch: Partial<EditorObject>, history = true): void {
    const object = this.findObject(id);
    if (!object) return;
    const current = this.serializeObject(object);
    if (!current) return;
    const next = { ...current, ...patch } as EditorObject;
    if (patch.transform) next.transform = { ...current.transform, ...patch.transform };
    this.applyEditorObject(object, next);
    object.setCoords();
    this.canvas.requestRenderAll();
    this.commit(history);
  }

  selectObject(id: string): void {
    const object = this.findObject(id);
    if (!object) return;
    this.canvas.setActiveObject(object);
    this.canvas.requestRenderAll();
    this.emitSelection();
  }

  deleteSelected(): void {
    const selected = this.canvas.getActiveObjects();
    for (const object of selected) this.canvas.remove(object);
    this.canvas.discardActiveObject();
    this.commit(true);
  }

  duplicateSelected(): void {
    const selected = this.canvas.getActiveObjects();
    if (selected.length === 0) return;
    const clones: FabricObject[] = [];
    for (const object of selected) {
      const serialized = this.serializeObject(object);
      if (!serialized) continue;
      const cloneObject: EditorObject = {
        ...serialized,
        id: `${serialized.id}_copy_${Date.now().toString(36)}`,
        name: `${serialized.name} Copy`,
        transform: {
          ...serialized.transform,
          x: serialized.transform.x + 24,
          y: serialized.transform.y + 24,
        },
      } as EditorObject;
      void this.createFabricObject(cloneObject).then((clone) => {
        if (!clone) return;
        clones.push(clone);
        this.canvas.add(clone);
        this.canvas.setActiveObject(clone);
        this.commit(true);
      });
    }
  }

  moveLayer(id: string, direction: "front" | "back" | "up" | "down"): void {
    const object = this.findObject(id);
    if (!object) return;
    if (direction === "front") object.bringToFront?.();
    if (direction === "back") object.sendToBack?.();
    if (direction === "up") object.bringForward?.();
    if (direction === "down") object.sendBackwards?.();
    this.renumberZIndexes();
    this.commit(true);
  }

  async exportImage(options: ExportOptions): Promise<string> {
    const json = this.canvas.toJSON(["data"]);
    const exportScale = Math.max(1, options.renderScale ?? 1);
    const exportCanvas = new StaticCanvasClass(document.createElement("canvas"), {
      width: this.project.canvas.width,
      height: this.project.canvas.height,
      backgroundColor: "#ffffff",
      enableRetinaScaling: false,
      imageSmoothingEnabled: true,
    });
    const result = exportCanvas.loadFromJSON(json);
    if (result && typeof result.then === "function") await result;
    exportCanvas.setDimensions({ width: this.project.canvas.width, height: this.project.canvas.height });
    exportCanvas.viewportTransform = [1, 0, 0, 1, 0, 0];
    exportCanvas.imageSmoothingEnabled = true;
    exportCanvas.getObjects?.().forEach((object: FabricObject) => {
      if (objectData(object).type === "bubble" || objectData(object).type === "text" || objectData(object).type === "shape") {
        object.set?.({ objectCaching: false, noScaleCache: false, dirty: true });
      }
    });
    exportCanvas.requestRenderAll?.();
    exportCanvas.renderAll();
    const dataUrl = exportCanvas.toDataURL({
      format: options.format,
      quality: options.quality,
      multiplier: exportScale,
      left: 0,
      top: 0,
      width: this.project.canvas.width,
      height: this.project.canvas.height,
    });
    exportCanvas.dispose();
    return dataUrl;
  }

  getProjectSnapshot(): ProjectDocument {
    return {
      ...this.project,
      objects: this.serializeObjects(),
    };
  }

  private bindEvents(): void {
    this.canvas.on("selection:created", () => this.emitSelection());
    this.canvas.on("selection:updated", () => this.emitSelection());
    this.canvas.on("selection:cleared", () => this.callbacks.onSelection([]));
    this.canvas.on("object:modified", () => this.commit(true));

    this.canvas.on("mouse:wheel", (event: any) => {
      const native = event.e as WheelEvent;
      native.preventDefault();
      native.stopPropagation();
      const rect = this.canvas.getElement().getBoundingClientRect();
      const point = { x: native.clientX - rect.left, y: native.clientY - rect.top };
      const factor = native.deltaY > 0 ? 0.92 : 1.08;
      this.zoomBy(factor, point);
    });

    this.canvas.on("mouse:down", (event: any) => {
      const native = event.e as MouseEvent;
      if (this.activeTool === "eyedropper") {
        void this.pickColor(native);
        return;
      }
      if (this.activeTool === "pan" || native.button === 1 || native.altKey) {
        this.isPanning = true;
        this.lastPanPoint = { x: native.clientX, y: native.clientY };
        this.canvas.selection = false;
        this.canvas.defaultCursor = "grabbing";
      }
    });

    this.canvas.on("mouse:move", (event: any) => {
      if (!this.isPanning) return;
      const native = event.e as MouseEvent;
      const dx = native.clientX - this.lastPanPoint.x;
      const dy = native.clientY - this.lastPanPoint.y;
      this.lastPanPoint = { x: native.clientX, y: native.clientY };
      this.view = { ...this.view, panX: this.view.panX + dx, panY: this.view.panY + dy };
      this.applyViewport();
    });

    this.canvas.on("mouse:up", () => {
      this.isPanning = false;
      this.canvas.selection = true;
      this.canvas.defaultCursor = this.activeTool === "pan" ? "grab" : this.activeTool === "eyedropper" ? "crosshair" : "default";
    });
  }

  private async pickColor(native: MouseEvent): Promise<void> {
    const element = this.canvas.lowerCanvasEl as HTMLCanvasElement;
    const rect = element.getBoundingClientRect();
    const localX = native.clientX - rect.left;
    const localY = native.clientY - rect.top;
    const sampleX = Math.min(element.width - 1, Math.max(0, Math.floor(localX * element.width / Math.max(1, rect.width))));
    const sampleY = Math.min(element.height - 1, Math.max(0, Math.floor(localY * element.height / Math.max(1, rect.height))));
    const context = element.getContext("2d");
    if (!context) return;
    const [r, g, b, a] = context.getImageData(sampleX, sampleY, 1, 1).data;
    if (a === 0) {
      this.callbacks.onToast("透明ピクセルです。色は取得しませんでした。", "warning");
      return;
    }

    const color = rgbaToHex(r, g, b);
    const scenePoint = this.canvas.getScenePoint?.(native) ?? {
      x: (localX - this.view.panX) / this.view.zoom,
      y: (localY - this.view.panY) / this.view.zoom,
    };
    const patch = createEyedropperPatchShape(
      { x: Number(scenePoint.x), y: Number(scenePoint.y) },
      color,
      this.project.canvas,
    );
    const fabricObject = await this.createFabricObject(patch);
    if (!fabricObject) return;
    this.canvas.add(fabricObject);
    this.canvas.setActiveObject(fabricObject);
    this.commit(true);
    this.callbacks.onColorPicked(color);
    this.callbacks.onToast(`色を取得し、隠し用の四角を追加しました: ${color}`, "success");
  }

  private async createFabricObject(object: EditorObject): Promise<FabricObject | undefined> {
    if (object.type === "bubble") {
      const asset = this.project.assets.templates.find((candidate) => candidate.id === object.assetId);
      if (!asset) return undefined;
      const image = await createFabricImage(asset.dataUrl);
      image.set({ originX: "left", originY: "top" });
      this.applyEditorObject(image, object);
      return image;
    }

    if (object.type === "text") {
      const textObject = new TextboxClass(displayTextForWritingMode(object.text, object.writingMode), {
        originX: "left",
        originY: "top",
        width: object.width,
        fontFamily: object.fontFamily,
        fontSize: object.fontSize,
        fill: object.fill,
        stroke: object.strokeEnabled ? object.stroke : undefined,
        strokeWidth: object.strokeEnabled ? object.strokeWidth : 0,
        fontWeight: object.fontWeight,
        fontStyle: object.fontStyle,
        textAlign: object.textAlign,
        lineHeight: object.lineHeight,
        charSpacing: object.charSpacing,
        editable: true,
      });
      this.applyEditorObject(textObject, object);
      return textObject;
    }

    if (object.kind === "rect") {
      const rect = new RectClass({ originX: "left", originY: "top", width: object.width, height: object.height });
      this.applyEditorObject(rect, object);
      return rect;
    }

    if (object.kind === "ellipse") {
      const ellipse = new EllipseClass({ originX: "left", originY: "top", rx: object.width / 2, ry: object.height / 2, width: object.width, height: object.height });
      this.applyEditorObject(ellipse, object);
      return ellipse;
    }

    const line = new LineClass([0, 0, object.width, 0], { originX: "left", originY: "top" });
    this.applyEditorObject(line, object);
    return line;
  }

  private applyEditorObject(fabricObject: FabricObject, object: EditorObject): void {
    const commonData = {
      id: object.id,
      type: object.type,
      name: object.name,
      locked: object.locked,
      zIndex: object.zIndex,
      pairId: object.pairId,
    };

    if (object.type === "bubble") {
      fabricObject.set({ data: { ...commonData, assetId: object.assetId, width: object.width, height: object.height } });
    }

    if (object.type === "text") {
      fabricObject.set({
        text: displayTextForWritingMode(object.text, object.writingMode),
        width: object.width,
        fontFamily: object.fontFamily,
        fontSize: object.fontSize,
        fill: object.fill,
        stroke: object.strokeEnabled ? object.stroke : undefined,
        strokeWidth: object.strokeEnabled ? object.strokeWidth : 0,
        fontWeight: object.fontWeight,
        fontStyle: object.fontStyle,
        textAlign: object.textAlign,
        lineHeight: object.lineHeight,
        charSpacing: object.charSpacing,
        data: { ...commonData, rawText: object.text, writingMode: object.writingMode, strokeEnabled: object.strokeEnabled },
      });
    }

    if (object.type === "shape") {
      if (object.kind === "rect") fabricObject.set({ width: object.width, height: object.height });
      if (object.kind === "ellipse") fabricObject.set({ rx: object.width / 2, ry: object.height / 2, width: object.width, height: object.height });
      if (object.kind === "line") fabricObject.set({ x1: 0, y1: 0, x2: object.width, y2: 0, width: object.width, height: 0 });
      fabricObject.set({
        fill: object.kind === "line" ? "transparent" : object.fill,
        stroke: object.stroke,
        strokeWidth: object.strokeWidth,
        data: { ...commonData, kind: object.kind, width: object.width, height: object.height },
      });
    }

    applyTransform(fabricObject, object);
  }

  private serializeObjects(): EditorObject[] {
    return this.canvas
      .getObjects()
      .filter((object: FabricObject) => objectData(object).type)
      .map((object: FabricObject) => this.serializeObject(object))
      .filter(Boolean) as EditorObject[];
  }

  private serializeObject(object: FabricObject): EditorObject | undefined {
    const data = objectData(object);
    if (!data.type) return undefined;
    const common = commonFromFabric(object);

    if (data.type === "bubble") {
      return {
        ...common,
        type: "bubble",
        assetId: String(data.assetId),
        width: Number(data.width ?? object.width ?? 1),
        height: Number(data.height ?? object.height ?? 1),
      } as BubbleObject;
    }

    if (data.type === "text") {
      return {
        ...common,
        type: "text",
        text: String(data.rawText ?? object.text ?? ""),
        writingMode: data.writingMode === "horizontal" ? "horizontal" : "vertical",
        fontFamily: String(object.fontFamily ?? "Yu Gothic UI"),
        fontSize: Number(object.fontSize ?? 36),
        fill: hexOrFallback(object.fill, "#111111"),
        strokeEnabled: Boolean(data.strokeEnabled ?? Boolean(object.stroke)),
        stroke: hexOrFallback(object.stroke, "#ffffff"),
        strokeWidth: Number(object.strokeWidth ?? 0),
        fontWeight: object.fontWeight === "bold" ? "bold" : "normal",
        fontStyle: object.fontStyle === "italic" ? "italic" : "normal",
        textAlign: object.textAlign === "left" || object.textAlign === "right" ? object.textAlign : "center",
        lineHeight: Number(object.lineHeight ?? 1.08),
        charSpacing: Number(object.charSpacing ?? 0),
        width: Number(object.width ?? 180),
      } as TextObject;
    }

    return {
      ...common,
      type: "shape",
      kind: data.kind === "ellipse" || data.kind === "line" ? data.kind : "rect",
      width: Number(data.width ?? object.width ?? 1),
      height: Number(data.height ?? object.height ?? 0),
      fill: hexOrFallback(object.fill, "transparent"),
      stroke: hexOrFallback(object.stroke, "#111111"),
      strokeWidth: Number(object.strokeWidth ?? 1),
    } as ShapeObject;
  }

  private findObject(id: string): FabricObject | undefined {
    return this.canvas.getObjects().find((object: FabricObject) => objectData(object).id === id);
  }

  private emitSelection(): void {
    const ids = this.canvas.getActiveObjects().map((object: FabricObject) => objectData(object).id).filter(Boolean);
    this.callbacks.onSelection(ids);
  }

  private renumberZIndexes(): void {
    this.canvas.getObjects().forEach((object: FabricObject, index: number) => {
      const data = objectData(object);
      if (!data.type) return;
      object.set({ data: { ...data, zIndex: index } });
    });
  }

  private commit(history: boolean): void {
    if (this.isRestoring) return;
    this.renumberZIndexes();
    this.callbacks.onCommit(this.serializeObjects(), history);
    this.emitSelection();
  }

  private applyViewport(): void {
    this.canvas.setViewportTransform([this.view.zoom, 0, 0, this.view.zoom, this.view.panX, this.view.panY]);
    this.canvas.requestRenderAll();
    this.callbacks.onZoom(this.view.zoom);
  }
}
