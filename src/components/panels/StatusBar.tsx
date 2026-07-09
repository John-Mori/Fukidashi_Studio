import type { ObjectType, ProjectDocument } from "../../project/model/types";

type StatusBarProps = {
  project: ProjectDocument;
  zoom: number;
  selectedType: ObjectType | "none" | "multiple";
  currentColor: string;
  autosaveAvailable: boolean;
};

const SELECTION_LABEL: Record<StatusBarProps["selectedType"], string> = {
  none: "なし",
  multiple: "複数",
  bubble: "吹き出し",
  text: "文字",
  shape: "図形",
};

export function StatusBar({ project, zoom, selectedType, currentColor, autosaveAvailable }: StatusBarProps) {
  const imageSize = project.assets.baseImage ? `${project.canvas.width} x ${project.canvas.height}px` : "未読込";
  return (
    <div className="status-bar">
      <span>画像: {imageSize}</span>
      <span>表示: {Math.round(zoom * 100)}%</span>
      <span>選択: {SELECTION_LABEL[selectedType]}</span>
      <span>色: {currentColor}</span>
      <span>{autosaveAvailable ? "自動保存あり" : "自動保存なし"}</span>
    </div>
  );
}
