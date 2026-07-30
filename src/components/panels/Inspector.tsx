import { findPairedFrameText, isTextFrameObject, type TextFrameObject } from "../../project/model/frameText";
import type { BubbleObject, EditorObject, ProjectDocument, ShapeObject, TextObject } from "../../project/model/types";
import { MobileInspector } from "./MobileInspector";

type InspectorProps = {
  project: ProjectDocument;
  selectedObject?: EditorObject;
  currentColor: string;
  onPatch: (id: string, patch: Partial<EditorObject>) => void;
  onSetCurrentColor: (color: string) => void;
  onLinkNearestBubble: (object: TextObject) => void;
  onCenterPair: (object: EditorObject) => void;
  onSetFrameText: (object: TextFrameObject, text: string) => void;
  onCleanBubbleFrame: (object: BubbleObject) => void;
};

type NumberFieldProps = {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
};

function numberValue(value: number, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function clampValue(value: number, min?: number, max?: number) {
  let next = value;
  if (typeof min === "number") next = Math.max(min, next);
  if (typeof max === "number") next = Math.min(max, next);
  return next;
}

function NumberField({ label, value, min, max, step = 1, onChange }: NumberFieldProps) {
  const shownValue = numberValue(value, 0);
  const commit = (next: number) => onChange(clampValue(next, min, max));
  return (
    <label className="number-field">
      {label}
      <span className="number-control">
        <input type="number" min={min} max={max} step={step} value={shownValue} onChange={(event) => commit(Number(event.target.value))} />
        <span className="number-buttons">
          <button type="button" title={`${label}を増やす`} onClick={() => commit(shownValue + step)}>↑</button>
          <button type="button" title={`${label}を減らす`} onClick={() => commit(shownValue - step)}>↓</button>
        </span>
      </span>
    </label>
  );
}

function BoldButton({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button type="button" className={active ? "format-button active" : "format-button"} onClick={onToggle}>
      <strong>B</strong> 太字
    </button>
  );
}

export function Inspector({ project, selectedObject, currentColor, onPatch, onSetCurrentColor, onLinkNearestBubble, onCenterPair, onSetFrameText, onCleanBubbleFrame }: InspectorProps) {
  if (!selectedObject) {
    return (
      <>
        <footer className="inspector-panel desktop-inspector-panel">
          <div className="inspector-empty">
            <strong>キャンバス</strong>
            <span>{project.canvas.width} x {project.canvas.height}px</span>
            <span>画像を開いて、吹き出し・文字・図形を配置します。</span>
          </div>
        </footer>
        <MobileInspector project={project} currentColor={currentColor} onPatch={onPatch} onSetCurrentColor={onSetCurrentColor} onLinkNearestBubble={onLinkNearestBubble} onCenterPair={onCenterPair} onSetFrameText={onSetFrameText} onCleanBubbleFrame={onCleanBubbleFrame} />
      </>
    );
  }

  const patchTransform = (key: keyof EditorObject["transform"], value: number | boolean) => {
    onPatch(selectedObject.id, { transform: { ...selectedObject.transform, [key]: value } } as Partial<EditorObject>);
  };
  const pairedFrameText = isTextFrameObject(selectedObject) ? findPairedFrameText(project.objects, selectedObject) : undefined;

  return (
    <>
      <footer className="inspector-panel desktop-inspector-panel">
      <div className="inspector-grid">
        <NumberField label="横位置" value={Math.round(selectedObject.transform.x)} onChange={(value) => patchTransform("x", value)} />
        <NumberField label="縦位置" value={Math.round(selectedObject.transform.y)} onChange={(value) => patchTransform("y", value)} />
        <NumberField label="横拡大" value={numberValue(selectedObject.transform.scaleX, 1)} step={0.05} onChange={(value) => patchTransform("scaleX", value)} />
        <NumberField label="縦拡大" value={numberValue(selectedObject.transform.scaleY, 1)} step={0.05} onChange={(value) => patchTransform("scaleY", value)} />
        <NumberField label="回転" value={Math.round(selectedObject.transform.rotation)} onChange={(value) => patchTransform("rotation", value)} />
        <label>
          不透明度
          <input type="range" min="0" max="1" step="0.01" value={selectedObject.opacity} onChange={(event) => onPatch(selectedObject.id, { opacity: Number(event.target.value) } as Partial<EditorObject>)} />
        </label>
        <label className="toggle-label">
          <input type="checkbox" checked={selectedObject.transform.flipX} onChange={(event) => patchTransform("flipX", event.target.checked)} /> 左右反転
        </label>
        <label className="toggle-label">
          <input type="checkbox" checked={selectedObject.transform.flipY} onChange={(event) => patchTransform("flipY", event.target.checked)} /> 上下反転
        </label>
        {selectedObject.type === "text" && <TextInspector object={selectedObject} onPatch={onPatch} onSetCurrentColor={onSetCurrentColor} onLinkNearestBubble={onLinkNearestBubble} onCenterPair={onCenterPair} />}
        {selectedObject.type === "shape" && <ShapeInspector object={selectedObject} currentColor={currentColor} onPatch={onPatch} onSetCurrentColor={onSetCurrentColor} />}
        {isTextFrameObject(selectedObject) && <FrameTextInspector object={selectedObject} pairedText={pairedFrameText} onPatch={onPatch} onSetFrameText={onSetFrameText} />}
        {selectedObject.type === "bubble" && <BubbleInspector object={selectedObject} onCleanBubbleFrame={onCleanBubbleFrame} />}
      </div>
      </footer>
      <MobileInspector project={project} selectedObject={selectedObject} currentColor={currentColor} onPatch={onPatch} onSetCurrentColor={onSetCurrentColor} onLinkNearestBubble={onLinkNearestBubble} onCenterPair={onCenterPair} onSetFrameText={onSetFrameText} onCleanBubbleFrame={onCleanBubbleFrame} />
    </>
  );
}

function TextInspector({ object, onPatch, onSetCurrentColor, onLinkNearestBubble, onCenterPair }: { object: TextObject; onPatch: (id: string, patch: Partial<EditorObject>) => void; onSetCurrentColor: (color: string) => void; onLinkNearestBubble: (object: TextObject) => void; onCenterPair: (object: EditorObject) => void }) {
  return (
    <>
      <label className="wide-field text-edit-field">
        文字
        <textarea value={object.text} onChange={(event) => onPatch(object.id, { text: event.target.value } as Partial<EditorObject>)} />
      </label>
      <div className="format-controls">
        <BoldButton active={object.fontWeight === "bold"} onToggle={() => onPatch(object.id, { fontWeight: object.fontWeight === "bold" ? "normal" : "bold" } as Partial<EditorObject>)} />
      </div>
      <label>
        文字方向
        <select value={object.writingMode} onChange={(event) => onPatch(object.id, { writingMode: event.target.value as TextObject["writingMode"] } as Partial<EditorObject>)}>
          <option value="vertical">縦</option>
          <option value="horizontal">横</option>
        </select>
      </label>
      <NumberField label="文字サイズ" min={8} max={180} value={object.fontSize} onChange={(value) => onPatch(object.id, { fontSize: value } as Partial<EditorObject>)} />
      <label>
        文字色
        <input type="color" value={object.fill} onChange={(event) => { onSetCurrentColor(event.target.value); onPatch(object.id, { fill: event.target.value } as Partial<EditorObject>); }} />
      </label>
      <label>
        フチ色
        <input type="color" value={object.stroke} onChange={(event) => onPatch(object.id, { stroke: event.target.value } as Partial<EditorObject>)} />
      </label>
      <NumberField label="フチ幅" min={0} max={20} value={object.strokeWidth} onChange={(value) => onPatch(object.id, { strokeWidth: value, strokeEnabled: value > 0 } as Partial<EditorObject>)} />
      <NumberField label="文字枠幅" min={20} max={1000} value={object.width} onChange={(value) => onPatch(object.id, { width: value } as Partial<EditorObject>)} />
      <NumberField label="行間" min={0.5} max={3} step={0.05} value={object.lineHeight} onChange={(value) => onPatch(object.id, { lineHeight: value } as Partial<EditorObject>)} />
      <button type="button" onClick={() => onLinkNearestBubble(object)}>近い枠にリンク</button>
      <button type="button" onClick={() => onCenterPair(object)}>枠中央へ配置</button>
    </>
  );
}

function ShapeInspector({ object, currentColor, onPatch, onSetCurrentColor }: { object: ShapeObject; currentColor: string; onPatch: (id: string, patch: Partial<EditorObject>) => void; onSetCurrentColor: (color: string) => void }) {
  return (
    <>
      <NumberField label="幅" min={1} max={2000} value={object.width} onChange={(value) => onPatch(object.id, { width: value } as Partial<EditorObject>)} />
      {object.kind !== "line" && <NumberField label="高さ" min={1} max={2000} value={object.height} onChange={(value) => onPatch(object.id, { height: value } as Partial<EditorObject>)} />}
      {object.kind !== "line" && (
        <label>
          塗り
          <input type="color" value={object.fill === "transparent" ? currentColor : object.fill} onChange={(event) => { onSetCurrentColor(event.target.value); onPatch(object.id, { fill: event.target.value } as Partial<EditorObject>); }} />
        </label>
      )}
      <label>
        線色
        <input type="color" value={object.stroke} onChange={(event) => { onSetCurrentColor(event.target.value); onPatch(object.id, { stroke: event.target.value } as Partial<EditorObject>); }} />
      </label>
      <NumberField label="線幅" min={0} max={80} value={object.strokeWidth} onChange={(value) => onPatch(object.id, { strokeWidth: value } as Partial<EditorObject>)} />
    </>
  );
}

function FrameTextInspector({ object, pairedText, onPatch, onSetFrameText }: { object: TextFrameObject; pairedText?: TextObject; onPatch: (id: string, patch: Partial<EditorObject>) => void; onSetFrameText: (object: TextFrameObject, text: string) => void }) {
  return (
    <>
      <label className="wide-field frame-text-field">
        枠内文字
        <textarea placeholder="枠の中に入れる文字" value={pairedText?.text ?? ""} onChange={(event) => onSetFrameText(object, event.target.value)} />
      </label>
      <div className="format-controls">
        <BoldButton active={pairedText?.fontWeight === "bold"} onToggle={() => {
          if (pairedText) onPatch(pairedText.id, { fontWeight: pairedText.fontWeight === "bold" ? "normal" : "bold" } as Partial<EditorObject>);
          else onSetFrameText(object, "セリフ");
        }} />
      </div>
      <button type="button" onClick={() => onSetFrameText(object, pairedText?.text ?? "セリフ")}>余白を整える</button>
    </>
  );
}

function BubbleInspector({ object, onCleanBubbleFrame }: { object: BubbleObject; onCleanBubbleFrame: (object: BubbleObject) => void }) {
  return (
    <button type="button" className="wide-action" onClick={() => onCleanBubbleFrame(object)}>
      内側白・外側透過
    </button>
  );
}
