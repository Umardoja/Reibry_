/** Client-safe canonical taxonomy. No network or server dependencies. */
export const MEMORY_CATEGORIES = [
  "Education & Learning", "Technology", "Food & Cooking", "Finance", "Travel", "Health & Fitness",
  "Work & Career", "Entertainment", "Shopping", "Personal", "Ideas & Inspiration", "Other",
] as const;
export type MemoryCategory = typeof MEMORY_CATEGORIES[number];
