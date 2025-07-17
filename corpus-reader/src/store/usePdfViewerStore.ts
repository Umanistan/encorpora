import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface PdfViewerSettings {
  scale: number;
  rotation: number;
  viewMode: "single" | "grid";
  readingMode: "page" | "vertical";
  theme: "light" | "dark" | "system";
}

interface PdfViewerState {
  settings: PdfViewerSettings;
  setScale: (scale: number) => void;
  setRotation: (rotation: number) => void;
  setViewMode: (viewMode: "single" | "grid") => void;
  setReadingMode: (readingMode: "page" | "vertical") => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
  updateSettings: (partial: Partial<PdfViewerSettings>) => void;
  resetSettings: () => void;
}

// Default PDF viewer settings
const initialSettings: PdfViewerSettings = {
  scale: 1.2,
  rotation: 0,
  viewMode: "single",
  readingMode: "page",
  theme: "system",
};

export const usePdfViewerStore = create<PdfViewerState>()(
  persist(
    (set, get) => ({
      settings: initialSettings,
      
      setScale: (scale: number) => {
        const clampedScale = Math.max(0.5, Math.min(3, scale));
        set((state) => ({
          settings: { ...state.settings, scale: clampedScale }
        }));
      },
      
      setRotation: (rotation: number) => {
        set((state) => ({
          settings: { ...state.settings, rotation: rotation % 360 }
        }));
      },
      
      setViewMode: (viewMode: "single" | "grid") => {
        set((state) => ({
          settings: { ...state.settings, viewMode }
        }));
      },
      
      setReadingMode: (readingMode: "page" | "vertical") => {
        set((state) => ({
          settings: { ...state.settings, readingMode }
        }));
      },
      
      setTheme: (theme: "light" | "dark" | "system") => {
        set((state) => ({
          settings: { ...state.settings, theme }
        }));
      },
      
      updateSettings: (partial: Partial<PdfViewerSettings>) => {
        set((state) => ({
          settings: { ...state.settings, ...partial }
        }));
      },
      
      resetSettings: () => {
        set({ settings: initialSettings });
      },
    }),
    {
      name: "pdf-viewer-settings",
      partialize: (state) => ({ settings: state.settings }),
    }
  )
);