export interface Category {
  id: string;
  name: string;
  sortOrder: number;
  itemCount: number;
}

export interface CreateCategoryRequest {
  name: string;
}

export interface UpdateCategoryRequest {
  name: string;
}
