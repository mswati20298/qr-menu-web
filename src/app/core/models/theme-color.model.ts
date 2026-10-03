export interface ThemeColorOption {
  key: string;
  label: string;
  hex: string;
  emoji: string;
}

/** Brand colours a restaurant can choose. Keys must match the API (ThemeColors) and the
 * [data-accent] rules in styles/_theme.scss. */
export const THEME_COLORS: ThemeColorOption[] = [
  { key: 'masala', label: 'Masala', hex: '#C2410C', emoji: '🌶️' },
  { key: 'ocean', label: 'Ocean Blue', hex: '#2563EB', emoji: '🔵' },
  { key: 'purple', label: 'Royal Purple', hex: '#7C3AED', emoji: '🟣' },
  { key: 'emerald', label: 'Emerald Green', hex: '#059669', emoji: '🟢' },
  { key: 'sunset', label: 'Sunset Orange', hex: '#EA580C', emoji: '🟠' },
  { key: 'ruby', label: 'Ruby Red', hex: '#DC2626', emoji: '🔴' },
  { key: 'rose', label: 'Rose Pink', hex: '#E11D48', emoji: '🩷' },
  { key: 'cyan', label: 'Cyan', hex: '#0891B2', emoji: '🩵' },
  { key: 'amber', label: 'Amber', hex: '#D97706', emoji: '🟡' }
];

export const DEFAULT_THEME_COLOR = 'masala';

export function isThemeColor(key: string | null | undefined): key is string {
  return !!key && THEME_COLORS.some((color) => color.key === key);
}
