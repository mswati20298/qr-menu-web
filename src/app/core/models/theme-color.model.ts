export interface ThemeColorOption {
  key: string;
  label: string;
  hex: string;
}

/** Brand colours a restaurant can choose. Keys must match the API (ThemeColors) and the
 * [data-accent] rules in styles/_theme.scss. */
export const THEME_COLORS: ThemeColorOption[] = [
  { key: 'masala', label: 'Masala', hex: '#C2410C' },
  { key: 'ocean', label: 'Ocean Blue', hex: '#2563EB' },
  { key: 'purple', label: 'Royal Purple', hex: '#7C3AED' },
  { key: 'emerald', label: 'Emerald Green', hex: '#059669' },
  { key: 'sunset', label: 'Sunset Orange', hex: '#EA580C' },
  { key: 'ruby', label: 'Ruby Red', hex: '#DC2626' },
  { key: 'rose', label: 'Rose Pink', hex: '#E11D48' },
  { key: 'cyan', label: 'Cyan', hex: '#0891B2' },
  { key: 'amber', label: 'Amber', hex: '#D97706' }
];

export const DEFAULT_THEME_COLOR = 'masala';

export function isThemeColor(key: string | null | undefined): key is string {
  return !!key && THEME_COLORS.some((color) => color.key === key);
}
