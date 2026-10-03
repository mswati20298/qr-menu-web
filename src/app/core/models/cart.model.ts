export interface CartLineAddOn {
  id: string;
  name: string;
  price: number;
}

export interface CartLine {
  lineId: string;
  itemId: string;
  name: string;
  imageUrl: string | null;
  variantId: string | null;
  variantName: string | null;
  addOns: CartLineAddOn[];
  unitPrice: number;
  qty: number;
}
