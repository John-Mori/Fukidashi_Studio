import type { EditorObject, ProjectDocument, ShapeObject, TextObject } from "../../project/model/types";

type InspectorProps = {
  project: ProjectDocument;
  selectedObject?: EditorObject;
  currentColor: string;
  onPatch: (id: string, patch: Partial<EditorObject>) => void;
  onSetCurrentColor: (color: string) => void;
  onLinkNearestBubble: (object: TextObject) => void;
  onCenterPair: (object: EditorObject) => void;
};

function numberValue(value: number, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

export function Inspector({ project, selectedObject, currentColor, onPatch, onSetCurrentColor, onLinkNearestBubble, onCenterPair }: InspectorProps) {
  if (!selectedObject) {
    return (
      <footer className="inspector-panel">
        <div className="inspector-empty">
          <strong>Canvas</strong>
          <span>{project.canvas.width} x {project.canvas.height}px</span>
          <span>画像を開いて、吹き出し・文字・図形を配置します。</span>
        </div>
      </footer>
    );
  }

  const patchTransform = (key: keyof EditorObject["transform"], value: number | boolean) => {
    onPatch(selectedObject.id, { transform: { ...selectedObject.transform, [key]: value } } as Partial<EditorObject>);
  };

  return (
    <footer className="inspector-panel">
      <div className="inspector-grid">
        <label>
          X
          <input type="number" value={Math.round(selectedObject.transform.x)} onChange={(event) => patchTransform("x", Number(event.target.value))} />
        </label>
        <label>
          Y
          <input type="number" value={Math.round(selectedObject.transform.y)} onChange={(event) => patchTransform("y", Number(event.target.value))} />
        </label>
        <label>
          Scale X
          <input type="number" step="0.05" value={numberValue(selectedObject.transform.scaleX, 1)} onChange={(event) => patchTransform("scaleX", Number(event.target.value))} />
        </label>
        <label>
          Scale Y
          <input type="number" step="0.05" value={numberValue(selectedObject.transform.scaleY, 1)} onChange={(event) => patchTransform("scaleY", Number(event.target.value))} />
        </label>
        <label>
          Rotate
          <input type="number" value={Math.round(selectedObject.transform.rotation)} onChange={(event) => patchTransform("rotation", Number(event.target.value))} />
        </label>
        <label>
          Opacity
          <input type="range" min="0" max="1" step="0.01" value={selectedObject.opacity} onChange={(event) => onPatch(selectedObject.id, { opacity: Number(event.target.value) } as Partial<EditorObject>)} />
        </label>
        <label className="toggle-label">
          <input type="checkbox" checked={selectedObject.transform.flipX} onChange={(event) => patchTransform("flipX", event.target.checked)} /> Flip X
        </label>
        <label className="toggle-label">
          <input type="checkbox" checked={selectedObject.transform.flipY} onChange={(event) => patchTransform("flipY", event.target.checked)} /> Flip Y
        </label>
        {selectedObject.type === "text" && <TextInspector object={selectedObject} onPatch={onPatch} onSetCurrentColor={onSetCurrentColor} onLinkNearestBubble={onLinkNearestBubble} onCenterPair={onCenterPair} />}
        {selectedObject.type === "shape" && <ShapeInspector object={selectedObject} currentColor={currentColor} onPatch={onPatch} onSetCurrentColor={onSetCurrentColor} />}
      </div>
    </footer>
  );
}

function TextInspector({ object, onPatch, onSetCurrentColor, onLinkNearestBubble, onCenterPair }: { object: TextObject; onPatch: (id: string, patch: Partial<EditorObject>) => void; onSetCurrentColor: (color: string) => void; onLinkNearestBubble: (object: TextObject) => void; onCenterPair: (object: EditorObject) => void }) {
  return (
    <>
      <label className="wide-field">
        Text
        <textarea value={object.text} onChange={(event) => onPatch(object.id, { text: event.target.value } as Partial<EditorObject>)} />
      </label>
      <label>
        Direction
        <select value={object.writingMode} onChange={(event) => onPatch(object.id, { writingMode: event.target.value as TextObject["writingMode"] } as Partial<EditorObject>)}>
          <option value="vertical">縦</option>
          <option value="horizontal">横</option>
        </select>
      </label>
      <label>
        Font size
        <input type="number" min="8" max="180" value={object.fontSize} onChange={(event) => onPatch(object.id, { fontSize: Number(event.target.value) } as Partial<EditorObject>)} />
      </label>
      <label>
        Text color
        <input type="color" value={object.fill} onChange={(event) => { onSetCurrentColor(event.target.value); onPatch(object.id, { fill: event.target.value } as Partial<EditorObject>); }} />
      </label>
      <label>
        Stroke
        <input type="color" value={object.stroke} onChange={(event) => onPatch(object.id, { stroke: event.target.value } as Partial<EditorObject>)} />
      </label>
      <label>
        Stroke width
        <input type="number" min="0" max="20" value={object.strokeWidth} onChange={(event) => onPatch(object.id, { strokeWidth: Number(event.target.value), strokeEnabled: Number(event.target.value) > 0 } as Partial<EditorObject>)} />
      </label>
      <label>
        Width
        <input type="number" min="20" max="1000" value={object.width} onChange={(event) => onPatch(object.id, { width: Number(event.target.value) } as Partial<EditorObject>)} />
      </label>
      <label>
        Line height
        <input type="number" step="0.05" min="0.5" max="3" value={object.lineHeight} onChange={(event) => onPatch(object.id, { lineHeight: Number(event.target.value) } as Partial<EditorObject>)} />
      </label>
      <label className="toggle-label">
        <input type="checkbox" checked={object.fontWeight === "bold"} onChange={(event) => onPatch(object.id, { fontWeight: event.target.checked ? "bold" : "normal" } as Partial<EditorObject>)} /> Bold
      </label>
      <button type="button" onClick={() => onLinkNearestBubble(object)}>Link bubble</button>
      <button type="button" onClick={() => onCenterPair(object)}>Center pair</button>
    </>
  );
}

function ShapeInspector({ object, currentColor, onPatch, onSetCurrentColor }: { object: ShapeObject; currentColor: string; onPatch: (id: string, patch: Partial<EditorObject>) => void; onSetCurrentColor: (color: string) => void }) {
  return (
    <>
      <label>
        Width
        <input type="number" min="1" max="2000" value={object.width} onChange={(event) => onPatch(object.id, { width: Number(event.target.value) } as Partial<EditorObject>)} />
      </label>
      {object.kind !== "line" && (
        <label>
          Height
          <input type="number" min="1" max="2000" value={object.height} onChange={(event) => onPatch(object.id, { height: Number(event.target.value) } as Partial<EditorObject>)} />
        </label>
      )}
      {object.kind !== "line" && (
        <label>
          Fill
          <input type="color" value={object.fill === "transparent" ? currentColor : object.fill} onChange={(event) => { onSetCurrentColor(event.target.value); onPatch(object.id, { fill: event.target.value } as Partial<EditorObject>); }} />
        </label>
      )}
      <label>
        Stroke
        <input type="color" value={object.stroke} onChange={(event) => { onSetCurrentColor(event.target.value); onPatch(object.id, { stroke: event.target.value } as Partial<EditorObject>); }} />
      </label>
      <label>
        Stroke width
        <input type="number" min="0" max="80" value={object.strokeWidth} onChange={(event) => onPatch(object.id, { strokeWidth: Number(event.target.value) } as Partial<EditorObject>)} />
      </label>
    </>
  );
}

