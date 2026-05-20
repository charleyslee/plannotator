import type { StateCreator } from 'zustand';
import type { DiffFile } from '../../types';
import type { ReviewStore } from '../create-review-store';

export interface FilesSlice {
  files: DiffFile[];
  focusedFileIndex: number;
  focusedFilePath: string | null;
  isAllFilesActive: boolean;
  reviewBase?: string;
  activeDiffBase?: string;
  viewedFiles: Record<string, true>;
  stagedFiles: Record<string, true>;
  stagingFile: string | null;
  canStageFiles: boolean;
  stageError: string | null;

  setFiles(files: DiffFile[]): void;
  setFocusedFile(index: number): void;
  setIsAllFilesActive(active: boolean): void;
  setReviewBase(base: string | undefined): void;
  setActiveDiffBase(base: string | undefined): void;
  toggleViewed(filePath: string): void;
  setViewedFiles(files: Record<string, true>): void;
  setStagedFiles(files: Record<string, true>): void;
  setStagingFile(file: string | null): void;
  setCanStageFiles(can: boolean): void;
  setStageError(error: string | null): void;
}

export const createFilesSlice: StateCreator<
  ReviewStore,
  [['zustand/immer', never]],
  [],
  FilesSlice
> = (set) => ({
  files: [],
  focusedFileIndex: 0,
  focusedFilePath: null,
  isAllFilesActive: false,
  reviewBase: undefined,
  activeDiffBase: undefined,
  viewedFiles: {},
  stagedFiles: {},
  stagingFile: null,
  canStageFiles: false,
  stageError: null,

  setFiles(files) {
    set((state) => {
      state.files = files;
      if (files.length > 0 && state.focusedFileIndex >= files.length) {
        state.focusedFileIndex = 0;
        state.focusedFilePath = files[0]?.path ?? null;
      } else if (files.length > 0) {
        state.focusedFilePath = files[state.focusedFileIndex]?.path ?? null;
      }
    });
  },

  setFocusedFile(index) {
    set((state) => {
      state.focusedFileIndex = index;
      state.focusedFilePath = state.files[index]?.path ?? null;
    });
  },

  setIsAllFilesActive(active) {
    set((state) => {
      state.isAllFilesActive = active;
    });
  },

  setReviewBase(base) {
    set((state) => {
      state.reviewBase = base;
    });
  },

  setActiveDiffBase(base) {
    set((state) => {
      state.activeDiffBase = base;
    });
  },

  toggleViewed(filePath) {
    set((state) => {
      if (filePath in state.viewedFiles) {
        delete state.viewedFiles[filePath];
      } else {
        state.viewedFiles[filePath] = true;
      }
    });
  },

  setViewedFiles(files) {
    set((state) => {
      state.viewedFiles = files;
    });
  },

  setStagedFiles(files) {
    set((state) => {
      state.stagedFiles = files;
    });
  },

  setStagingFile(file) {
    set((state) => {
      state.stagingFile = file;
    });
  },

  setCanStageFiles(can) {
    set((state) => {
      state.canStageFiles = can;
    });
  },

  setStageError(error) {
    set((state) => {
      state.stageError = error;
    });
  },
});
