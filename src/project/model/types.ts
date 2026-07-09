export type ObjectType = "bubble" | "text" | "shape";
export type ShapeKind = "rect" | "ellipse" | "line";
export type WritingMode = "vertical" | "horizontal";
export type ExportFormat = "png" | "jpeg" | "webp";
export type PreviewPosition = "right" | "left";

export type CanvasSize = {
  width: number;
  height: number;
};

export type Transform = {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
};

export type BaseImageAsset = {
  id: string;
  name: string;
  mimeType: string;
  width: number;
  height: number;
  dataUrl: string;
  createdAt: string;
};

export type TemplateAsset = {
  id: string;
  name: string;
  originalFileName: string;
  mimeType: string;
  width: number;
  height: number;
  dataUrl: string;
  createdAt: string;
};

export type BaseEditorObject = {
  id: string;
  type: ObjectType;
  name: string;
  transform: Transform;
  opacity: number;
  visible: boolean;
  locked: boolean;
  zIndex: number;
  pairId?: string;
};

export type BubbleObject = BaseEditorObject & {
  type: "bubble";
  assetId: string;
  width: number;
  height: number;
};

export type TextObject = BaseEditorObject & {
  type: "text";
  text: string;
  writingMode: WritingMode;
  fontFamily: string;
  fontSize: number;
  fill: string;
  strokeEnabled: boolean;
  stroke: string;
  strokeWidth: number;
  fontWeight: "normal" | "bold";
  fontStyle: "normal" | "italic";
  textAlign: "left" | "center" | "right";
  lineHeight: number;
  charSpacing: number;
  width: number;
};

export type ShapeObject = BaseEditorObject & {
  type: "shape";
  kind: ShapeKind;
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
};

export type EditorObject = BubbleObject | TextObject | ShapeObject;

export type ProjectDocument = {
  schemaVersion: number;
  projectId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  canvas: {
    width: number;
    height: number;
    backgroundAssetId?: string;
  };
  assets: {
    baseImage?: BaseImageAsset;
    templates: TemplateAsset[];
  };
  objects: EditorObject[];
  settings: {
    exportFormat: ExportFormat;
    exportQuality: number;
    layout: {
      previewPosition: PreviewPosition;
    };
  };
};

export type SelectionState = {
  selectedIds: string[];
  selectedType: ObjectType | "none" | "multiple";
};

export type ViewState = {
  zoom: number;
  panX: number;
  panY: number;
};

export type ExportOptions = {
  format: ExportFormat;
  quality: number;
  renderScale?: number;
};
