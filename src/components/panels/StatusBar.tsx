import type { ObjectType, ProjectDocument } from "../../project/model/types";

type StatusBarProps = {
  project: ProjectDocument;
  zoom: number;
  selectedType: ObjectType | "none" | "multiple";
  currentColor: string;
  autosaveAvailable: boolean;
};

export function StatusBar({ project, zoom, selectedType, currentColor, autosaveAvailable }: StatusBarProps) {
  const imageSize = project.assets.baseImage ? `${project.canvas.width} x ${project.canvas.height}px` : "No image";
  return (
    <div className="status-bar">
      <span>Image: {imageSize}</span>
      <span>Zoom: {Math.round(zoom * 100)}%</span>
      <span>Selection: {selectedType}</span>
      <span>Color: {currentColor}</span>
      <span>{autosaveAvailable ? "Autosave ready" : "Autosave empty"}</span>
    </div>
  );
}
