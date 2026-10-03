export type KitchenStatus = 'Placed' | 'Preparing' | 'Served';

export interface KitchenOrderItem {
  name: string;
  variant: string | null;
  addOns: string[];
  qty: number;
}

export interface KitchenOrder {
  id: string;
  tableNumber: string | null;
  customerName: string | null;
  note: string | null;
  status: KitchenStatus;
  createdAt: string;
  updatedAt: string;
  items: KitchenOrderItem[];
}

export interface KitchenBoard {
  restaurantName: string;
  serverTime: string;
  orders: KitchenOrder[];
}

export interface KitchenAuthResponse {
  token: string;
  restaurantName: string;
  restaurantSlug: string;
}
