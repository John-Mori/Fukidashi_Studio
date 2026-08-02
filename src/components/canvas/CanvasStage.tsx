import { useEffect, useLayoutEffect, useRef } from "react";
import { FabricEditorAdapter } from "../../editor/fabric/FabricEditorAdapter";
import { createPinchSnapshot, type PinchSnapshot } from "../../editor/touchGestures";
import type { EditorObject, ProjectDocument } from "../../project/model/types";

type CanvasStageProps = {
  project: ProjectDocument;
  activeTool: string;
  onReady: (engine: FabricEditorAdapter) => void;
  onCommit: (objects: EditorObject[], history: boolean) => void;
  onSelection: (ids: string[]) => void;
  onZoom: (zoom: number) => void;
  onColorPicked: (color: string) => void;
  onToast: (text: string, tone?: "info" | "success" | "warning" | "error") => void;
};

export function CanvasStage({ project, activeTool, onReady, onCommit, onSelection, onZoom, onColorPicked, onToast }: CanvasStageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<FabricEditorAdapter | null>(null);

  useLayoutEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    const engine = new FabricEditorAdapter(canvasRef.current, project, {
      onCommit,
      onSelection,
      onZoom,
      onColorPicked,
      onToast,
    });
    engineRef.current = engine;
    onReady(engine);
    void engine.restore(project, true);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      engine.setViewportSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(containerRef.current);

    const container = containerRef.current;
    let pinch: PinchSnapshot | null = null;
    let gestureActive = false;
    const snapshotFromTouches = (touches: TouchList) => createPinchSnapshot(
      { x: touches[0].clientX, y: touches[0].clientY },
      { x: touches[1].clientX, y: touches[1].clientY },
    );
    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length < 2) return;
      event.preventDefault();
      event.stopPropagation();
      gestureActive = true;
      pinch = snapshotFromTouches(event.touches);
    };
    const handleTouchMove = (event: TouchEvent) => {
      if (!gestureActive) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.touches.length < 2 || !pinch) return;
      const next = snapshotFromTouches(event.touches);
      const rect = container.getBoundingClientRect();
      engine.zoomBy(next.distance / pinch.distance, {
        x: pinch.midpoint.x - rect.left,
        y: pinch.midpoint.y - rect.top,
      });
      engine.panBy(
        next.midpoint.x - pinch.midpoint.x,
        next.midpoint.y - pinch.midpoint.y,
      );
      pinch = next;
    };
    const handleTouchEnd = (event: TouchEvent) => {
      if (!gestureActive) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.touches.length >= 2) {
        pinch = snapshotFromTouches(event.touches);
      } else {
        pinch = null;
        if (event.touches.length === 0) gestureActive = false;
      }
    };
    const listenerOptions: AddEventListenerOptions = { passive: false, capture: true };
    container.addEventListener("touchstart", handleTouchStart, listenerOptions);
    container.addEventListener("touchmove", handleTouchMove, listenerOptions);
    container.addEventListener("touchend", handleTouchEnd, listenerOptions);
    container.addEventListener("touchcancel", handleTouchEnd, listenerOptions);

    return () => {
      observer.disconnect();
      container.removeEventListener("touchstart", handleTouchStart, true);
      container.removeEventListener("touchmove", handleTouchMove, true);
      container.removeEventListener("touchend", handleTouchEnd, true);
      container.removeEventListener("touchcancel", handleTouchEnd, true);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setActiveTool(activeTool);
  }, [activeTool]);

  useEffect(() => {
    engineRef.current?.setProjectReference(project);
  }, [project]);

  return (
    <div className="canvas-shell" ref={containerRef}>
      <canvas ref={canvasRef} className="editor-canvas" />
    </div>
  );
}
