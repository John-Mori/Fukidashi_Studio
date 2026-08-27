import { Download, Pipette, FileDown, FilePlus2, FolderOpen, FlipHorizontal2, ImagePlus, LayoutPanelLeft, Redo2, Save, Shapes, TextCursorInput, Trash2, Undo2, ZoomIn, ZoomOut } from "lucide-react";

import { Grid3X3 } from "lucide-react";
import { PanelsTopLeft } from "lucide-react";
type HeaderToolbarProps = {
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
  onOpenImage: () => void;
  onOpenProject: () => void;
  onImportTemplate: () => void;
  onSaveProject: () => void;
  onExport: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onFit: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onAddText: () => void;
  onAddRect: () => void;
  onAddEllipse: () => void;
  onAddLine: () => void;
  onDelete: () => void;
  onEyedropper: () => void;
  onMosaic: () => void;
  onTwoPanel: () => void;
  onSwapLayout: () => void;
};

export function HeaderToolbar(props: HeaderToolbarProps) {
  return (
    <header className="header-toolbar">
      <div className="brand-block">
        <div className="brand-mark">FS</div>
        <div>
          <div className="brand-name">Fukidashi Studio</div>
          <div className="brand-subtitle">PC / スマホ対応</div>
        </div>
      </div>
      <div className="toolbar-group file-actions">
        <button title="元画像を開く" onClick={props.onOpenImage}><ImagePlus size={18} />画像</button>
        <button className="desktop-only" title="プロジェクトJSONを開く" onClick={props.onOpenProject}><FolderOpen size={18} />プロジェクト</button>
        <button className="desktop-only" title="吹き出しテンプレを追加" onClick={props.onImportTemplate}><FilePlus2 size={18} />テンプレ</button>
        <button className="desktop-only" title="プロジェクトJSONを保存" onClick={props.onSaveProject}><Save size={18} />保存</button>
        <button className="primary" title="画像を保存" onClick={props.onExport}><Download size={18} />画像を保存</button>
      </div>
      <div className="toolbar-group icon-group history-actions">
        <button title="元に戻す" disabled={!props.canUndo} onClick={props.onUndo}><Undo2 size={18} /></button>
        <button title="やり直し" disabled={!props.canRedo} onClick={props.onRedo}><Redo2 size={18} /></button>
        <button className="desktop-only" title="削除" onClick={props.onDelete}><Trash2 size={18} /></button>
      </div>
      <div className="toolbar-group icon-group insert-actions">
        <button title="文字を追加" onClick={props.onAddText}><TextCursorInput size={18} /></button>
        <button title="縦長四角を追加" onClick={props.onAddRect}><Shapes size={18} /></button>
        <button title="楕円を追加" onClick={props.onAddEllipse}><FlipHorizontal2 size={18} /></button>
        <button title="直線を追加" onClick={props.onAddLine}><FileDown size={18} /></button>
        <button title="スポイト" onClick={props.onEyedropper}><Pipette size={18} /></button>
        <button title="2・3コマ結合" onClick={props.onTwoPanel}><PanelsTopLeft size={18} /></button>
        <button title="モザイク・ぼかし" onClick={props.onMosaic}><Grid3X3 size={18} /></button>
      </div>
      <div className="toolbar-group zoom-group desktop-zoom-actions">
        <button title="縮小" onClick={props.onZoomOut}><ZoomOut size={18} /></button>
        <button title="全体表示" onClick={props.onFit}>{Math.round(props.zoom * 100)}%</button>
        <button title="拡大" onClick={props.onZoomIn}><ZoomIn size={18} /></button>
      </div>
      <button className="ghost-button" title="左右の配置を切り替え" onClick={props.onSwapLayout}><LayoutPanelLeft size={18} /></button>
    </header>
  );
}
