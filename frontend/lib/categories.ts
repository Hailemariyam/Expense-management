/**
 * Suggested expense categories. The backend stores `category` as free text
 * (no lookup table in this milestone), so this is a convenience list for the
 * create form and filters — users can still type anything.
 */
export const CATEGORY_SUGGESTIONS = [
  'Travel',
  'Meals',
  'Accommodation',
  'Transport',
  'Software',
  'Office',
  'Training',
  'Other',
] as const;
