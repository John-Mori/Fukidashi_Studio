import { findPairedFrameText, isTextFrameObject, type TextFrameObject } from "../../project/model/frameText";
import type { BubbleObject, EditorObject, ProjectDocument, ShapeObject, TextObject } from "../../project/model/types";

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

function numberValue(value: number, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

export function Inspector({ project, selectedObject, currentColor, onPatch, onSetCurrentColor, onLinkNearestBubble, onCenterPair, onSetFrameText, onCleanBubbleFrame }: InspectorProps) {
  if (!selectedObject) {
    return (
      <footer className="inspector-panel">
        <div className="inspector-empty">
          <strong>キャンバス</strong>
          <span>{project.canvas.width} x {project.canvas.height}px</span>
          <span>画像を開いて、吹き出し・文字・図形を配置します。</span>
        </div>
      </footer>
    );
  }

  const patchTransform = (key: keyof EditorObject["transform"], value: number | boolean) => {
    onPatch(selectedObject.id, { transform: { ...selectedObject.transform, [key]: value } } as Partial<EditorObject>);
  };
  const pairedFrameText = isTextFrameObject(selectedObject) ? findPairedFrameText(project.objects, selectedObject) : undefined;

  return (
    <footer className="inspector-panel">
      <div className="inspector-grid">
        <label>
          横位置
          <input type="number" value={Math.round(selectedObject.transform.x)} onChange={(event) => patchTransform("x", Number(event.target.value))} />
        </label>
        <label>
          縦位置
          <input type="number" value={Math.round(selectedObject.transform.y)} onChange={(event) => patchTransform("y", Number(event.target.value))} />
        </label>
        <label>
          横拡大
          <input type="number" step="0.05" value={numberValue(selectedObject.transform.scaleX, 1)} onChange={(event) => patchTransform("scaleX", Number(event.target.value))} />
        </label>
        <label>
          縦拡大
          <input type="number" step="0.05" value={numberValue(selectedObject.transform.scaleY, 1)} onChange={(event) => patchTransform("scaleY", Number(event.target.value))} />
        </label>
        <label>
          回転
          <input type="number" value={Math.round(selectedObject.transform.rotation)} onChange={(event) => patchTransform("rotation", Number(event.target.value))} />
        </label>
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
        {isTextFrameObject(selectedObject) && <FrameTextInspector object={selectedObject} pairedText={pairedFrameText} onSetFrameText={onSetFrameText} />}
        {selectedObject.type === "bubble" && <BubbleInspector object={selectedObject} onCleanBubbleFrame={onCleanBubbleFrame} />}
      </div>
    </footer>
  );
}

function TextInspector({ object, onPatch, onSetCurrentColor, onLinkNearestBubble, onCenterPair }: { object: TextObject; onPatch: (id: string, patch: Partial<EditorObject>) => void; onSetCurrentColor: (color: string) => void; onLinkNearestBubble: (object: TextObject) => void; onCenterPair: (object: EditorObject) => void }) {
  return (
    <>
      <label className="wide-field">
        文字
        <textarea value={object.text} onChange={(event) => onPatch(object.id, { text: event.target.value } as Partial<EditorObject>)} />
      </label>
      <label>
        文字方向
        <select value={object.writingMode} onChange={(event) => onPatch(object.id, { writingMode: event.target.value as TextObject["writingMode"] } as Partial<EditorObject>)}>
          <option value="vertical">縦</option>
          <option value="horizontal">横</option>
        </select>
      </label>
      <label>
        文字サイズ
        <input type="number" min="8" max="180" value={object.fontSize} onChange={(event) => onPatch(object.id, { fontSize: Number(event.target.value) } as Partial<EditorObject>)} />
      </label>
      <label>
        文字色
        <input type="color" value={object.fill} onChange={(event) => { onSetCurrentColor(event.target.value); onPatch(object.id, { fill: event.target.value } as Partial<EditorObject>); }} />
      </label>
      <label>
        フチ色
        <input type="color" value={object.stroke} onChange={(event) => onPatch(object.id, { stroke: event.target.value } as Partial<EditorObject>)} />
      </label>
      <label>
        フチ幅
        <input type="number" min="0" max="20" value={object.strokeWidth} onChange={(event) => onPatch(object.id, { strokeWidth: Number(event.target.value), strokeEnabled: Number(event.target.value) > 0 } as Partial<EditorObject>)} />
      </label>
      <label>
        文字枠幅
        <input type="number" min="20" max="1000" value={object.width} onChange={(event) => onPatch(object.id, { width: Number(event.target.value) } as Partial<EditorObject>)} />
      </label>
      <label>
        行間
        <input type="number" step="0.05" min="0.5" max="3" value={object.lineHeight} onChange={(event) => onPatch(object.id, { lineHeight: Number(event.target.value) } as Partial<EditorObject>)} />
      </label>
      <label className="toggle-label">
        <input type="checkbox" checked={object.fontWeight === "bold"} onChange={(event) => onPatch(object.id, { fontWeight: event.target.checked ? "bold" : "normal" } as Partial<EditorObject>)} /> 太字
      </label>
      <button type="button" onClick={() => onLinkNearestBubble(object)}>近い枠にリンク</button>
      <button type="button" onClick={() => onCenterPair(object)}>枠中央へ配置</button>
    </>
  );
}

function ShapeInspector({ object, currentColor, onPatch, onSetCurrentColor }: { object: ShapeObject; currentColor: string; onPatch: (id: string, patch: Partial<EditorObject>) => void; onSetCurrentColor: (color: string) => void }) {
  return (
    <>
      <label>
        幅
        <input type="number" min="1" max="2000" value={object.width} onChange={(event) => onPatch(object.id, { width: Number(event.target.value) } as Partial<EditorObject>)} />
      </label>
      {object.kind !== "line" && (
        <label>
          高さ
          <input type="number" min="1" max="2000" value={object.height} onChange={(event) => onPatch(object.id, { height: Number(event.target.value) } as Partial<EditorObject>)} />
        </label>
      )}
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
      <label>
        線幅
        <input type="number" min="0" max="80" value={object.strokeWidth} onChange={(event) => onPatch(object.id, { strokeWidth: Number(event.target.value) } as Partial<EditorObject>)} />
      </label>
    </>
  );
}

function FrameTextInspector({ object, pairedText, onSetFrameText }: { object: TextFrameObject; pairedText?: TextObject; onSetFrameText: (object: TextFrameObject, text: string) => void }) {
  return (
    <>
      <label className="wide-field frame-text-field">
        枠内文字
        <textarea placeholder="枠の中に入れる文字" value={pairedText?.text ?? ""} onChange={(event) => onSetFrameText(object, event.target.value)} />
      </label>
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
