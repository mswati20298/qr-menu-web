export interface RestaurantTable {
  id: string;
  number: string;
  capacity: number | null;
  isActive: boolean;
  hasActiveOrder: boolean;
  /** Secret printed in this table's QR link (?k=). */
  qrCode: string;
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
