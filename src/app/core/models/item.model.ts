export interface ItemVariant {
  id: string;
  name: string;
  price: number;
  isDefault: boolean;
  sortOrder: number;
}

export interface ItemAddOn {
  id: string;
  name: string;
  price: number;
  sortOrder: number;
}

export interface VariantInput {
  name: string;
  price: number;
  isDefault: boolean;
}

export interface AddOnInput {
  name: string;
  price: number;
}

export interface MenuItem {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  isVeg: boolean;
  tag: string | null;
  isAvailable: boolean;
  sortOrder: number;
  variants: ItemVariant[];
  addOns: ItemAddOn[];
}

export interface CreateItemRequest {
  categoryId: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  isVeg: boolean;
  tag: string | null;
  variants: VariantInput[];
  addOns: AddOnInput[];
}

export interface UpdateItemRequest {
  categoryId: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  isVeg: boolean;
  tag: string | null;
  variants: VariantInput[];
  addOns: AddOnInput[];
}
