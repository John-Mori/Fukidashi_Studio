import { create } from "zustand";
import { createEmptyProject, nowIso } from "../project/model/defaults";
import type { EditorObject, ObjectType, ProjectDocument, TemplateAsset } from "../project/model/types";

type ToastTone = "info" | "success" | "warning" | "error";

export type ToastMessage = {
  id: string;
  tone: ToastTone;
  text: string;
};

type ProjectState = {
  project: ProjectDocument;
  past: ProjectDocument[];
  future: ProjectDocument[];
  selectedIds: string[];
  zoom: number;
  activeTool: "select" | "pan" | "text" | "bubble" | "rect" | "ellipse" | "line" | "eyedropper";
  currentColor: string;
  toast?: ToastMessage;
  autosaveAvailable: boolean;
  setProject: (project: ProjectDocument, history?: boolean) => void;
  patchProject: (patcher: (project: ProjectDocument) => ProjectDocument, history?: boolean) => void;
  setObjectsFromCanvas: (objects: EditorObject[], history?: boolean) => void;
  addTemplate: (asset: TemplateAsset) => void;
  setSelectedIds: (ids: string[]) => void;
  setZoom: (zoom: number) => void;
  setActiveTool: (tool: ProjectState["activeTool"]) => void;
  setCurrentColor: (color: string) => void;
  pushToast: (text: string, tone?: ToastTone) => void;
  clearToast: () => void;
  undo: () => ProjectDocument | undefined;
  redo: () => ProjectDocument | undefined;
  markAutosaveAvailable: (available: boolean) => void;
};

const HISTORY_LIMIT = 50;

function cloneProject(project: ProjectDocument): ProjectDocument {
  return JSON.parse(JSON.stringify(project)) as ProjectDocument;
}

function touchProject(project: ProjectDocument): ProjectDocument {
  return { ...project, updatedAt: nowIso() };
}

function selectedType(project: ProjectDocument, selectedIds: string[]): ObjectType | "none" | "multiple" {
  if (selectedIds.length === 0) return "none";
  const types = new Set(project.objects.filter((object) => selectedIds.includes(object.id)).map((object) => object.type));
  if (types.size !== 1) return "multiple";
  return [...types][0] ?? "none";
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: createEmptyProject(),
  past: [],
  future: [],
  selectedIds: [],
  zoom: 1,
  activeTool: "select",
  currentColor: "#111111",
  autosaveAvailable: false,
  setProject: (project, history = true) => {
    const current = get().project;
    set({
      project: touchProject(project),
      past: history ? [...get().past.slice(-(HISTORY_LIMIT - 1)), cloneProject(current)] : get().past,
      future: history ? [] : get().future,
    });
  },
  patchProject: (patcher, history = true) => {
    const current = get().project;
    const next = touchProject(patcher(cloneProject(current)));
    set({
      project: next,
      past: history ? [...get().past.slice(-(HISTORY_LIMIT - 1)), cloneProject(current)] : get().past,
      future: history ? [] : get().future,
    });
  },
  setObjectsFromCanvas: (objects, history = true) => {
    get().patchProject((project) => ({ ...project, objects }), history);
  },
  addTemplate: (asset) => {
    get().patchProject((project) => ({
      ...project,
      assets: { ...project.assets, templates: [asset, ...project.assets.templates] },
    }));
  },
  setSelectedIds: (ids) => set({ selectedIds: ids }),
  setZoom: (zoom) => set({ zoom }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setCurrentColor: (color) => set({ currentColor: color }),
  pushToast: (text, tone = "info") => set({ toast: { id: `${Date.now()}`, text, tone } }),
  clearToast: () => set({ toast: undefined }),
  undo: () => {
    const state = get();
    const previous = state.past[state.past.length - 1];
    if (!previous) return undefined;
    set({
      project: cloneProject(previous),
      past: state.past.slice(0, -1),
      future: [cloneProject(state.project), ...state.future.slice(0, HISTORY_LIMIT - 1)],
      selectedIds: [],
    });
    return previous;
  },
  redo: () => {
    const state = get();
    const next = state.future[0];
    if (!next) return undefined;
    set({
      project: cloneProject(next),
      past: [...state.past.slice(-(HISTORY_LIMIT - 1)), cloneProject(state.project)],
      future: state.future.slice(1),
      selectedIds: [],
    });
    return next;
  },
  markAutosaveAvailable: (available) => set({ autosaveAvailable: available }),
}));

export function getSelectedType(): ObjectType | "none" | "multiple" {
  const state = useProjectStore.getState();
  return selectedType(state.project, state.selectedIds);
}
