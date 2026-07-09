import { Circle, Eye, EyeOff, Lock, MessageSquare, MousePointer2, Square, Type, Unlock } from "lucide-react";
import type { EditorObject, ProjectDocument, TemplateAsset } from "../../project/model/types";

type SidePanelProps = {
  project: ProjectDocument;
  selectedIds: string[];
  currentColor: string;
  onAddText: () => void;
  onAddTemplate: (asset: TemplateAsset) => void;
  onImportTemplate: () => void;
  onAddShape: (kind: "rect" | "ellipse" | "line") => void;
  onSelectObject: (id: string) => void;
  onToggleVisible: (object: EditorObject) => void;
  onToggleLocked: (object: EditorObject) => void;
};

export function SidePanel(props: SidePanelProps) {
  const objects = [...props.project.objects].sort((a, b) => b.zIndex - a.zIndex);
  return (
    <aside className="side-panel">
      <section className="panel-section compact-actions">
        <h2>追加</h2>
        <button onClick={props.onAddText}><Type size={17} />テキスト</button>
        <button onClick={() => props.onAddShape("rect")}><Square size={17} />縦長四角</button>
        <button onClick={() => props.onAddShape("ellipse")}><Circle size={17} />楕円</button>
        <button onClick={() => props.onAddShape("line")}><MousePointer2 size={17} />直線</button>
      </section>

      <section className="panel-section">
        <div className="section-heading-row">
          <h2>吹き出し</h2>
          <button className="mini-button" onClick={props.onImportTemplate}>追加</button>
        </div>
        {props.project.assets.templates.length === 0 ? (
          <div className="empty-box">吹き出しテンプレがありません</div>
        ) : (
          <div className="template-grid">
            {props.project.assets.templates.map((asset) => (
              <button key={asset.id} className="template-tile" title={asset.name} onClick={() => props.onAddTemplate(asset)}>
                <img src={asset.dataUrl} alt={asset.name} />
                <span>{asset.name}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="panel-section layer-section">
        <h2>レイヤー</h2>
        {objects.length === 0 ? (
          <div className="empty-box">オブジェクトなし</div>
        ) : (
          <div className="layer-list">
            {objects.map((object) => (
              <div key={object.id} className={props.selectedIds.includes(object.id) ? "layer-row selected" : "layer-row"}>
                <button className="layer-main" onClick={() => props.onSelectObject(object.id)}>
                  {object.type === "text" ? <Type size={15} /> : object.type === "bubble" ? <MessageSquare size={15} /> : <Square size={15} />}
                  <span>{object.name}</span>
                </button>
                <button title="表示" onClick={() => props.onToggleVisible(object)}>{object.visible ? <Eye size={15} /> : <EyeOff size={15} />}</button>
                <button title="ロック" onClick={() => props.onToggleLocked(object)}>{object.locked ? <Lock size={15} /> : <Unlock size={15} />}</button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel-section swatch-section">
        <h2>現在色</h2>
        <div className="color-readout"><span style={{ backgroundColor: props.currentColor }} />{props.currentColor}</div>
      </section>
    </aside>
  );
}
