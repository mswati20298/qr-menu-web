export type BackgroundMode = 'Fixed' | 'TimeOfDay';

/** Bit mask values for BackgroundItem.slots (must match the API). */
export const BACKGROUND_SLOT = {
  Morning: 1,
  Afternoon: 2,
  Evening: 4,
  Night: 8
} as const;

export interface BackgroundItem {
  id: string;
  imageUrl: string;
  slots: number;
  isDefault: boolean;
}

export interface BackgroundSettings {
  mode: BackgroundMode;
  items: BackgroundItem[];
}

/** What the public menu receives for each background. */
export interface PublicBackground {
  imageUrl: string;
  slots: number;
  isDefault: boolean;
}
