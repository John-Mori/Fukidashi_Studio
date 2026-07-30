import { AlignCenter, FlipHorizontal2, FlipVertical2, MessageSquareText, Minus, Palette, Plus, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { findPairedFrameText, isTextFrameObject, type TextFrameObject } from "../../project/model/frameText";
import type { BubbleObject, EditorObject, ProjectDocument, ShapeObject, TextObject } from "../../project/model/types";

type MobileInspectorProps = {
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

type InspectorSection = "content" | "style" | "position";

type CompactStepperProps = {
  label: string;
  value: number;
  step?: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
};

function clamp(value: number, min?: number, max?: number) {
  let next = Number.isFinite(value) ? value : 0;
  if (typeof min === "number") next = Math.max(min, next);
  if (typeof max === "number") next = Math.min(max, next);
  return next;
}

function shownNumber(value: number, step: number) {
  return step < 1 ? Number(value.toFixed(2)) : Math.round(value);
}

function CompactStepper({ label, value, step = 1, min, max, onChange }: CompactStepperProps) {
  const shown = shownNumber(value, step);
  const commit = (next: number) => onChange(clamp(next, min, max));
  return (
    <label className="mobile-stepper">
      <span>{label}</span>
      <span className="mobile-stepper-control">
        <button type="button" title={`${label}を減らす`} onClick={() => commit(shown - step)}><Minus size={18} /></button>
        <input type="number" value={shown} step={step} min={min} max={max} onChange={(event) => commit(Number(event.target.value))} />
        <button type="button" title={`${label}を増やす`} onClick={() => commit(shown + step)}><Plus size={18} /></button>
      </span>
    </label>
  );
}

function ColorControl({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="mobile-color-control">
      <span>{label}</span>
      <span>
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
        <code>{value.toUpperCase()}</code>
      </span>
    </label>
  );
}

function MobileBoldButton({ text, onPatch, onSetFrameText, frame }: {
  text?: TextObject;
  frame?: TextFrameObject;
  onPatch: MobileInspectorProps["onPatch"];
  onSetFrameText: MobileInspectorProps["onSetFrameText"];
}) {
  const active = text?.fontWeight === "bold";
  return (
    <button
      type="button"
      className={active ? "mobile-format-button active" : "mobile-format-button"}
      onClick={() => {
        if (text) onPatch(text.id, { fontWeight: active ? "normal" : "bold" } as Partial<EditorObject>);
        else if (frame) onSetFrameText(frame, "セリフ");
      }}
    >
      <strong>B</strong> 太字
    </button>
  );
}

export function MobileInspector(props: MobileInspectorProps) {
  const { project, selectedObject, currentColor, onPatch, onSetCurrentColor, onLinkNearestBubble, onCenterPair, onSetFrameText, onCleanBubbleFrame } = props;
  const [section, setSection] = useState<InspectorSection>("content");

  useEffect(() => {
    setSection("content");
  }, [selectedObject?.id]);

  if (!selectedObject) {
    return (
      <footer className="inspector-panel mobile-inspector-panel mobile-inspector-empty">
        <strong>調整する枠や文字を選択</strong>
        <span>画像上の対象をタップすると、ここに編集項目が表示されます。</span>
      </footer>
    );
  }

  const patchTransform = (key: keyof EditorObject["transform"], value: number | boolean) => {
    onPatch(selectedObject.id, { transform: { ...selectedObject.transform, [key]: value } } as Partial<EditorObject>);
  };
  const frame = isTextFrameObject(selectedObject) ? selectedObject : undefined;
  const pairedText = frame ? findPairedFrameText(project.objects, frame) : undefined;
  const displayName = frame ? "枠を編集" : selectedObject.type === "text" ? "文字を編集" : selectedObject.name;

  return (
    <footer className="inspector-panel mobile-inspector-panel">
      <div className="mobile-inspector-title">
        <div>
          <strong>{displayName}</strong>
          <span>{selectedObject.name}</span>
        </div>
        <span className="direct-edit-hint">画像上でも移動・拡大できます</span>
      </div>

      <nav className="mobile-inspector-tabs" aria-label="調整項目">
        <button className={section === "content" ? "active" : ""} onClick={() => setSection("content")}><MessageSquareText size={18} />文字</button>
        <button className={section === "style" ? "active" : ""} onClick={() => setSection("style")}><Palette size={18} />見た目</button>
        <button className={section === "position" ? "active" : ""} onClick={() => setSection("position")}><SlidersHorizontal size={18} />配置</button>
      </nav>

      <div className="mobile-inspector-body">
        {section === "content" && (
          <div className="mobile-inspector-section">
            {frame ? (
              <>
                <label className="mobile-frame-text">
                  <span>枠内文字</span>
                  <textarea
                    placeholder="枠の中に入れる文字"
                    value={pairedText?.text ?? ""}
                    onChange={(event) => onSetFrameText(frame, event.target.value)}
                  />
                </label>
                <div className="mobile-inline-tools">
                  <MobileBoldButton text={pairedText} frame={frame} onPatch={onPatch} onSetFrameText={onSetFrameText} />
                  {pairedText && (
                    <select
                      aria-label="文字方向"
                      value={pairedText.writingMode}
                      onChange={(event) => onPatch(pairedText.id, { writingMode: event.target.value as TextObject["writingMode"] } as Partial<EditorObject>)}
                    >
                      <option value="vertical">縦書き</option>
                      <option value="horizontal">横書き</option>
                    </select>
                  )}
                  {pairedText && <CompactStepper label="文字サイズ" min={8} max={180} value={pairedText.fontSize} onChange={(value) => onPatch(pairedText.id, { fontSize: value } as Partial<EditorObject>)} />}
                  <button type="button" onClick={() => onSetFrameText(frame, pairedText?.text ?? "セリフ")}><AlignCenter size={18} />余白を整える</button>
                </div>
              </>
            ) : selectedObject.type === "text" ? (
              <>
                <label className="mobile-frame-text">
                  <span>文字</span>
                  <textarea value={selectedObject.text} onChange={(event) => onPatch(selectedObject.id, { text: event.target.value } as Partial<EditorObject>)} />
                </label>
                <div className="mobile-inline-tools">
                  <MobileBoldButton text={selectedObject} onPatch={onPatch} onSetFrameText={onSetFrameText} />
                  <select
                    aria-label="文字方向"
                    value={selectedObject.writingMode}
                    onChange={(event) => onPatch(selectedObject.id, { writingMode: event.target.value as TextObject["writingMode"] } as Partial<EditorObject>)}
                  >
                    <option value="vertical">縦書き</option>
                    <option value="horizontal">横書き</option>
                  </select>
                  <CompactStepper label="文字サイズ" min={8} max={180} value={selectedObject.fontSize} onChange={(value) => onPatch(selectedObject.id, { fontSize: value } as Partial<EditorObject>)} />
                  <button type="button" onClick={() => onLinkNearestBubble(selectedObject)}>近い枠にリンク</button>
                </div>
              </>
            ) : (
              <div className="mobile-panel-note">このオブジェクトには文字を設定できません。</div>
            )}
          </div>
        )}

        {section === "style" && (
          <div className="mobile-inspector-section mobile-style-grid">
            {selectedObject.type === "shape" && selectedObject.kind !== "line" && (
              <ColorControl
                label="枠内"
                value={selectedObject.fill === "transparent" ? "#ffffff" : selectedObject.fill}
                onChange={(value) => { onSetCurrentColor(value); onPatch(selectedObject.id, { fill: value } as Partial<EditorObject>); }}
              />
            )}
            {selectedObject.type === "shape" && (
              <>
                <ColorControl label="枠線" value={selectedObject.stroke} onChange={(value) => { onSetCurrentColor(value); onPatch(selectedObject.id, { stroke: value } as Partial<EditorObject>); }} />
                <CompactStepper label="線の太さ" min={0} max={80} value={selectedObject.strokeWidth} onChange={(value) => onPatch(selectedObject.id, { strokeWidth: value } as Partial<EditorObject>)} />
              </>
            )}
            {selectedObject.type === "text" && (
              <>
                <ColorControl label="文字色" value={selectedObject.fill} onChange={(value) => { onSetCurrentColor(value); onPatch(selectedObject.id, { fill: value } as Partial<EditorObject>); }} />
                <ColorControl label="フチ色" value={selectedObject.stroke} onChange={(value) => onPatch(selectedObject.id, { stroke: value } as Partial<EditorObject>)} />
                <CompactStepper label="フチ幅" min={0} max={20} value={selectedObject.strokeWidth} onChange={(value) => onPatch(selectedObject.id, { strokeWidth: value, strokeEnabled: value > 0 } as Partial<EditorObject>)} />
              </>
            )}
            {pairedText && (
              <ColorControl label="枠内文字" value={pairedText.fill} onChange={(value) => { onSetCurrentColor(value); onPatch(pairedText.id, { fill: value } as Partial<EditorObject>); }} />
            )}
            <label className="mobile-range-control">
              <span>不透明度 <b>{Math.round(selectedObject.opacity * 100)}%</b></span>
              <input type="range" min="0" max="1" step="0.01" value={selectedObject.opacity} onChange={(event) => onPatch(selectedObject.id, { opacity: Number(event.target.value) } as Partial<EditorObject>)} />
            </label>
            {selectedObject.type === "bubble" && (
              <button type="button" className="mobile-wide-button" onClick={() => onCleanBubbleFrame(selectedObject)}>内側白・外側透過</button>
            )}
          </div>
        )}

        {section === "position" && (
          <div className="mobile-inspector-section mobile-position-grid">
            <CompactStepper label="左右" value={selectedObject.transform.x} step={10} onChange={(value) => patchTransform("x", value)} />
            <CompactStepper label="上下" value={selectedObject.transform.y} step={10} onChange={(value) => patchTransform("y", value)} />
            {selectedObject.type === "shape" ? (
              <>
                <CompactStepper label="幅" min={1} max={4000} value={selectedObject.width} step={10} onChange={(value) => onPatch(selectedObject.id, { width: value } as Partial<EditorObject>)} />
                {selectedObject.kind !== "line" && <CompactStepper label="高さ" min={1} max={4000} value={selectedObject.height} step={10} onChange={(value) => onPatch(selectedObject.id, { height: value } as Partial<EditorObject>)} />}
              </>
            ) : (
              <>
                <CompactStepper label="横拡大" min={0.05} max={20} value={selectedObject.transform.scaleX} step={0.05} onChange={(value) => patchTransform("scaleX", value)} />
                <CompactStepper label="縦拡大" min={0.05} max={20} value={selectedObject.transform.scaleY} step={0.05} onChange={(value) => patchTransform("scaleY", value)} />
              </>
            )}
            <CompactStepper label="回転" min={-360} max={360} value={selectedObject.transform.rotation} step={5} onChange={(value) => patchTransform("rotation", value)} />
            <div className="mobile-flip-controls">
              <button className={selectedObject.transform.flipX ? "active" : ""} title="左右反転" onClick={() => patchTransform("flipX", !selectedObject.transform.flipX)}><FlipHorizontal2 size={19} />左右</button>
              <button className={selectedObject.transform.flipY ? "active" : ""} title="上下反転" onClick={() => patchTransform("flipY", !selectedObject.transform.flipY)}><FlipVertical2 size={19} />上下</button>
            </div>
            {selectedObject.pairId && <button type="button" className="mobile-wide-button" onClick={() => onCenterPair(selectedObject)}><AlignCenter size={18} />枠の中央へ</button>}
          </div>
        )}
      </div>
    </footer>
  );
}
