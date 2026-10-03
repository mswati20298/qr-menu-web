export interface MenuScanItem {
  category: string;
  name: string;
  price: number | null;
  isVeg: boolean;
  description: string | null;
}

export interface MenuScanResult {
  items: MenuScanItem[];
}
