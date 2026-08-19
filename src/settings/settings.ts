// Settings persistence (MD §30): remember the last pre-calculation RunConfig
// and the post-calculation viewer settings, so the instrument opens the way the
// researcher left it. Storage is injectable for testing.

import type { RunConfig, ColorConfig, MeshConfig } from '../core/config';
import type { RenderMode } from '../core/types';

export interface ViewerSettings {
  renderMode: RenderMode;
  color: ColorConfig;
  mesh: MeshConfig;
}

export interface PersistedSettings {
  config?: RunConfig;
  viewer?: ViewerSettings;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const KEY = 'candlelens.settings';

export function saveSettings(settings: PersistedSettings, storage: StorageLike = localStorage): void {
  storage.setItem(KEY, JSON.stringify(settings));
}

export function loadSettings(storage: StorageLike = localStorage): PersistedSettings | null {
  const raw = storage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PersistedSettings;
  } catch {
    return null;
  }
}

export function clearSettings(storage: StorageLike = localStorage): void {
  storage.setItem(KEY, JSON.stringify({}));
}
