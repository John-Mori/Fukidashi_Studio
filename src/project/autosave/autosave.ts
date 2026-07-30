import type { ProjectDocument } from "../model/types";

const AUTOSAVE_KEY = "fukidashi-studio.autosave.v1";
const SETTINGS_KEY = "fukidashi-studio.settings.v1";

export function saveAutosave(project: ProjectDocument): boolean {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(project));
    return true;
  } catch {
    return false;
  }
}

export function loadAutosave(): ProjectDocument | undefined {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return undefined;
    return JSON.parse(raw) as ProjectDocument;
  } catch {
    return undefined;
  }
}

export function clearAutosave(): void {
  try {
    localStorage.removeItem(AUTOSAVE_KEY);
  } catch {
    // Ignore storage failures in browser fallback mode.
  }
}

export function saveSetting<T>(key: string, value: T): void {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const settings = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    settings[key] = value;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Best effort only.
  }
}

export function loadSetting<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return fallback;
    const settings = JSON.parse(raw) as Record<string, unknown>;
    return (settings[key] as T | undefined) ?? fallback;
  } catch {
    return fallback;
  }
}
