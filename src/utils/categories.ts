import type { Category } from "../types/domain";

export function findCategoryById(categories: Category[], categoryId: string) {
  return categories.find((category) => category.id === categoryId);
}

export function getCategoryName(categories: Category[], categoryId: string) {
  return findCategoryById(categories, categoryId)?.name ?? "Uncategorized";
}

