export interface FeatureHighlight {
  title: string;
  description: string;
}

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  dismissed: boolean;
  releaseUrl: string;
  featureHighlight?: FeatureHighlight;
  dismiss: () => void;
}

export function useUpdateCheck(): UpdateInfo | null {
  return null;
}
