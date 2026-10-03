export interface RestaurantTable {
  id: string;
  number: string;
  capacity: number | null;
  isActive: boolean;
  hasActiveOrder: boolean;
}

export interface CreateTableRequest {
  number: string;
  capacity: number | null;
}

export interface UpdateTableRequest {
  number: string;
  capacity: number | null;
  isActive: boolean;
}
