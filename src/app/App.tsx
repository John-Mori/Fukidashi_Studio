import { useCallback, useEffect, useMemo, useRef } from "react";
import { CanvasStage } from "../components/canvas/CanvasStage";
import { Inspector } from "../components/panels/Inspector";
import { SidePanel } from "../components/panels/SidePanel";
import { StatusBar } from "../components/panels/StatusBar";
import { HeaderToolbar } from "../components/toolbar/HeaderToolbar";
import type { FabricEditorAdapter } from "../editor/fabric/FabricEditorAdapter";
import { clearAutosave, loadAutosave, saveAutosave } from "../project/autosave/autosave";
import { createEmptyProject, createId, nowIso } from "../project/model/defaults";
import type { BaseImageAsset, EditorObject, ProjectDocument, ShapeKind, TemplateAsset, TextObject } from "../project/model/types";
import { readFileAsDataUrl, loadImageSize, downloadDataUrl } from "../platform/browser/fileHelpers";
import { getSelectedType, useProjectStore } from "../store/projectStore";
import "../styles/global.css";

const SUPPORTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function projectDownloadUrl(project: ProjectDocument): string {
  const json = JSON.stringify(project, null, 2);
  return `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;
}

function fileStem(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

export function App() {
  const engineRef = useRef<FabricEditorAdapter | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const templateInputRef = useRef<HTMLInputElement | null>(null);
  const projectInputRef = useRef<HTMLInputElement | null>(null);
  const autosaveLoadedRef = useRef(false);

  const project = useProjectStore((state) => state.project);
  const past = useProjectStore((state) => state.past);
  const future = useProjectStore((state) => state.future);
  const selectedIds = useProjectStore((state) => state.selectedIds);
  const zoom = useProjectStore((state) => state.zoom);
  const activeTool = useProjectStore((state) => state.activeTool);
  const currentColor = useProjectStore((state) => state.currentColor);
  const toast = useProjectStore((state) => state.toast);
  const autosaveAvailable = useProjectStore((state) => state.autosaveAvailable);
  const setProject = useProjectStore((state) => state.setProject);
  const patchProject = useProjectStore((state) => state.patchProject);
  const setObjectsFromCanvas = useProjectStore((state) => state.setObjectsFromCanvas);
  const addTemplate = useProjectStore((state) => state.addTemplate);
  const setSelectedIds = useProjectStore((state) => state.setSelectedIds);
  const setZoom = useProjectStore((state) => state.setZoom);
  const setActiveTool = useProjectStore((state) => state.setActiveTool);
  const setCurrentColor = useProjectStore((state) => state.setCurrentColor);
  const pushToast = useProjectStore((state) => state.pushToast);
  const clearToast = useProjectStore((state) => state.clearToast);
  const undo = useProjectStore((state) => state.undo);
  const redo = useProjectStore((state) => state.redo);
  const markAutosaveAvailable = useProjectStore((state) => state.markAutosaveAvailable);

  const selectedObject = useMemo(() => project.objects.find((object) => selectedIds.includes(object.id)), [project.objects, selectedIds]);
  const selectedType = getSelectedType();
  const isPreviewLeft = project.settings.layout.previewPosition === "left";

  useEffect(() => {
    const autosave = loadAutosave();
    if (autosave) markAutosaveAvailable(true);
  }, [markAutosaveAvailable]);

  useEffect(() => {
    if (!project.assets.baseImage && project.objects.length === 0) return;
    const handle = window.setTimeout(() => {
      const ok = saveAutosave(project);
      markAutosaveAvailable(ok);
    }, 450);
    return () => window.clearTimeout(handle);
  }, [project, markAutosaveAvailable]);

  useEffect(() => {
    if (!toast) return;
    const handle = window.setTimeout(clearToast, 3600);
    return () => window.clearTimeout(handle);
  }, [toast, clearToast]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) handleRedo();
        else handleUndo();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        handleRedo();
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) return;
        engineRef.current?.deleteSelected();
      }
      if (event.key === "Escape") setActiveTool("select");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const restoreProject = useCallback(async (next: ProjectDocument, history = true, fit = true) => {
    setProject(next, history);
    setSelectedIds([]);
    await engineRef.current?.restore(next, fit);
  }, [setProject, setSelectedIds]);

  const loadBaseImageFile = useCallback(async (file: File) => {
    if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
      pushToast("この画像形式は読み込めません。PNG / JPEG / WebP を使ってください。", "error");
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const size = await loadImageSize(dataUrl);
      const baseImage: BaseImageAsset = {
        id: createId("base"),
        name: file.name,
        mimeType: file.type,
        width: size.width,
        height: size.height,
        dataUrl,
        createdAt: nowIso(),
      };
      const next = createEmptyProject(size);
      next.name = fileStem(file.name);
      next.canvas.backgroundAssetId = baseImage.id;
      next.assets = { baseImage, templates: project.assets.templates };
      next.settings.layout.previewPosition = project.settings.layout.previewPosition;
      await restoreProject(next, true, true);
      pushToast(`画像を開きました: ${size.width} x ${size.height}px`, "success");
    } catch {
      pushToast("画像を読み込めませんでした。ファイルを確認してください。", "error");
    }
  }, [project.assets.templates, project.settings.layout.previewPosition, pushToast, restoreProject]);

  const handleImageInput = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    await loadBaseImageFile(file);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const handleTemplateInput = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    let imported = 0;
    for (const file of Array.from(files)) {
      if (!SUPPORTED_IMAGE_TYPES.has(file.type)) continue;
      try {
        const dataUrl = await readFileAsDataUrl(file);
        const size = await loadImageSize(dataUrl);
        const asset: TemplateAsset = {
          id: createId("template"),
          name: fileStem(file.name),
          originalFileName: file.name,
          mimeType: file.type,
          width: size.width,
          height: size.height,
          dataUrl,
          createdAt: nowIso(),
        };
        addTemplate(asset);
        imported += 1;
      } catch {
        pushToast(`${file.name} をテンプレとして読み込めませんでした。`, "warning");
      }
    }
    if (templateInputRef.current) templateInputRef.current.value = "";
    if (imported > 0) pushToast(`${imported}件のテンプレを追加しました。`, "success");
  };

  const handleProjectInput = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const loaded = JSON.parse(text) as ProjectDocument;
      if (!loaded.canvas || !loaded.assets || !Array.isArray(loaded.objects)) {
        throw new Error("invalid project");
      }
      await restoreProject(loaded, true, true);
      pushToast("プロジェクトJSONを開きました。", "success");
    } catch {
      pushToast("プロジェクトJSONを読み込めませんでした。", "error");
    } finally {
      if (projectInputRef.current) projectInputRef.current.value = "";
    }
  };

  const ensureImage = () => {
    if (project.assets.baseImage) return true;
    pushToast("先にベース画像を開いてください。", "warning");
    return false;
  };

  const handleAddText = async () => {
    if (!ensureImage()) return;
    await engineRef.current?.addText({ fill: currentColor });
    setActiveTool("select");
  };

  const handleAddShape = async (kind: ShapeKind) => {
    if (!ensureImage()) return;
    await engineRef.current?.addShape(kind, kind === "line" ? "transparent" : "#ffffff", currentColor);
    setActiveTool("select");
  };

  const handleAddTemplate = async (asset: TemplateAsset) => {
    if (!ensureImage()) return;
    await engineRef.current?.addTemplateBubble(asset);
    setActiveTool("select");
  };

  const handlePatchObject = (id: string, patch: Partial<EditorObject>) => {
    engineRef.current?.updateObject(id, patch, true);
  };

  const handleUndo = () => {
    const previous = undo();
    if (previous) void engineRef.current?.restore(previous, false);
  };

  const handleRedo = () => {
    const next = redo();
    if (next) void engineRef.current?.restore(next, false);
  };

  const handleExport = async () => {
    if (!ensureImage()) return;
    try {
      const dataUrl = await engineRef.current?.exportImage({ format: project.settings.exportFormat, quality: project.settings.exportQuality });
      if (!dataUrl) return;
      downloadDataUrl(dataUrl, `${project.name || "fukidashi"}_${project.canvas.width}x${project.canvas.height}.png`);
      pushToast("元画像サイズでPNGを書き出しました。", "success");
    } catch {
      pushToast("書き出しに失敗しました。", "error");
    }
  };

  const handleSaveProject = () => {
    downloadDataUrl(projectDownloadUrl(project), `${project.name || "fukidashi"}.fukidashi.json`);
    pushToast("プロジェクトJSONを保存しました。", "success");
  };

  const handleRestoreAutosave = async () => {
    const autosave = loadAutosave();
    if (!autosave) {
      pushToast("復旧できる自動保存がありません。", "warning");
      return;
    }
    autosaveLoadedRef.current = true;
    await restoreProject(autosave, true, true);
    pushToast("自動保存から復旧しました。", "success");
  };

  const handleClearAutosave = () => {
    clearAutosave();
    markAutosaveAvailable(false);
    pushToast("自動保存をクリアしました。", "success");
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = Array.from(event.dataTransfer.files).find((candidate) => SUPPORTED_IMAGE_TYPES.has(candidate.type));
    if (file) await loadBaseImageFile(file);
  };

  const handleToggleVisible = (object: EditorObject) => handlePatchObject(object.id, { visible: !object.visible } as Partial<EditorObject>);
  const handleToggleLocked = (object: EditorObject) => handlePatchObject(object.id, { locked: !object.locked } as Partial<EditorObject>);

  const objectSize = (object: EditorObject) => {
    if (object.type === "text") {
      const lineCount = object.writingMode === "vertical"
        ? Math.max(1, Array.from(object.text.replace(/\n/g, "")).length)
        : Math.max(1, object.text.split("\n").length);
      return {
        width: object.width * object.transform.scaleX,
        height: object.fontSize * object.lineHeight * lineCount * object.transform.scaleY,
      };
    }
    return {
      width: object.width * object.transform.scaleX,
      height: object.height * object.transform.scaleY,
    };
  };

  const objectCenter = (object: EditorObject) => {
    const size = objectSize(object);
    return {
      x: object.transform.x + size.width / 2,
      y: object.transform.y + size.height / 2,
    };
  };

  const handleLinkNearestBubble = (text: TextObject) => {
    const bubbles = project.objects.filter((object) => object.type === "bubble");
    if (bubbles.length === 0) {
      pushToast("リンクできる吹き出しがありません。", "warning");
      return;
    }
    const textCenter = objectCenter(text);
    const nearest = bubbles.reduce((best, bubble) => {
      const center = objectCenter(bubble);
      const distance = (center.x - textCenter.x) ** 2 + (center.y - textCenter.y) ** 2;
      return !best || distance < best.distance ? { bubble, distance } : best;
    }, undefined as { bubble: EditorObject; distance: number } | undefined)?.bubble;
    if (!nearest) return;
    engineRef.current?.updateObject(text.id, { pairId: nearest.id } as Partial<EditorObject>, true);
    engineRef.current?.updateObject(nearest.id, { pairId: text.id } as Partial<EditorObject>, true);
    pushToast("最寄りの吹き出しとリンクしました。", "success");
  };

  const handleCenterPair = (object: EditorObject) => {
    const pair = project.objects.find((candidate) => candidate.id === object.pairId);
    if (!pair) {
      pushToast("先に吹き出しとリンクしてください。", "warning");
      return;
    }
    const pairCenter = objectCenter(pair);
    const size = objectSize(object);
    engineRef.current?.updateObject(object.id, {
      transform: {
        ...object.transform,
        x: pairCenter.x - size.width / 2,
        y: pairCenter.y - size.height / 2,
      },
    } as Partial<EditorObject>, true);
  };

  return (
    <div className="app-root" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
      <input ref={imageInputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void handleImageInput(event.target.files)} />
      <input ref={templateInputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(event) => void handleTemplateInput(event.target.files)} />
      <input ref={projectInputRef} hidden type="file" accept="application/json,.json,.fukidashi.json" onChange={(event) => void handleProjectInput(event.target.files)} />
      <HeaderToolbar
        canUndo={past.length > 0}
        canRedo={future.length > 0}
        zoom={zoom}
        onOpenImage={() => imageInputRef.current?.click()}
        onOpenProject={() => projectInputRef.current?.click()}
        onImportTemplate={() => templateInputRef.current?.click()}
        onSaveProject={handleSaveProject}
        onExport={() => void handleExport()}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onFit={() => engineRef.current?.fitToViewport()}
        onZoomIn={() => engineRef.current?.zoomBy(1.15)}
        onZoomOut={() => engineRef.current?.zoomBy(0.85)}
        onAddText={() => void handleAddText()}
        onAddRect={() => void handleAddShape("rect")}
        onAddEllipse={() => void handleAddShape("ellipse")}
        onAddLine={() => void handleAddShape("line")}
        onDelete={() => engineRef.current?.deleteSelected()}
        onEyedropper={() => setActiveTool(activeTool === "eyedropper" ? "select" : "eyedropper")}
        onSwapLayout={() => patchProject((draft) => ({
          ...draft,
          settings: {
            ...draft.settings,
            layout: { previewPosition: draft.settings.layout.previewPosition === "right" ? "left" : "right" },
          },
        }))}
      />

      <main className={isPreviewLeft ? "workspace preview-left" : "workspace"}>
        <SidePanel
          project={project}
          selectedIds={selectedIds}
          currentColor={currentColor}
          onAddText={() => void handleAddText()}
          onAddTemplate={(asset) => void handleAddTemplate(asset)}
          onImportTemplate={() => templateInputRef.current?.click()}
          onAddShape={(kind) => void handleAddShape(kind)}
          onSelectObject={(id) => {
            setSelectedIds([id]);
            engineRef.current?.selectObject(id);
          }}
          onToggleVisible={handleToggleVisible}
          onToggleLocked={handleToggleLocked}
        />
        <section className="preview-panel">
          {!project.assets.baseImage && (
            <div className="empty-canvas-state">
              <strong>画像をここへドロップ</strong>
              <span>PNG / JPEG / WebP</span>
              <button onClick={() => imageInputRef.current?.click()}>画像を開く</button>
              {autosaveAvailable && <button className="secondary" onClick={() => void handleRestoreAutosave()}>自動保存を復旧</button>}
            </div>
          )}
          <CanvasStage
            project={project}
            activeTool={activeTool}
            onReady={(engine) => { engineRef.current = engine; }}
            onCommit={(objects, history) => setObjectsFromCanvas(objects, history)}
            onSelection={setSelectedIds}
            onZoom={setZoom}
            onColorPicked={setCurrentColor}
            onToast={pushToast}
          />
        </section>
      </main>

      <Inspector project={project} selectedObject={selectedObject} currentColor={currentColor} onPatch={handlePatchObject} onSetCurrentColor={setCurrentColor} onLinkNearestBubble={handleLinkNearestBubble} onCenterPair={handleCenterPair} />
      <StatusBar project={project} zoom={zoom} selectedType={selectedType} currentColor={currentColor} autosaveAvailable={autosaveAvailable} />

      <div className="autosave-actions">
        {autosaveAvailable && project.assets.baseImage && <button onClick={() => void handleRestoreAutosave()}>復旧</button>}
        {autosaveAvailable && <button onClick={handleClearAutosave}>自動保存クリア</button>}
      </div>
      {toast && <div className={`toast ${toast.tone}`}>{toast.text}</div>}
    </div>
  );
}



