export type NutritionScore = "a" | "b" | "c" | "d" | "e" | null;

export interface ProductSummary {
  code: string;
  name: string;
  brands: string;
  imageThumb: string | null;
  image: string | null;
  nutriScore: NutritionScore;
  quantity: string | null;
  categories: string[];
  nutriments: Record<string, number | string>;
  ingredients: string | null;
  allergens: string | null;
  origins: string | null;
  countries: string[];
}

export interface ApiResponse<T> {
  data: T;
}

export interface ErrorResponse {
  error: string;
}
