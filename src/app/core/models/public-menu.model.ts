import { BackgroundMode, PublicBackground } from './background.model';

export interface PublicItemVariant {
  id: string;
  name: string;
  price: number;
  isDefault: boolean;
}

export interface PublicItemAddOn {
  id: string;
  name: string;
  price: number;
}

export interface PublicMenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  isVeg: boolean;
  tag: string | null;
  isAvailable: boolean;
  variants: PublicItemVariant[];
  addOns: PublicItemAddOn[];
}

export interface PublicCategory {
  id: string;
  name: string;
  sortOrder: number;
  items: PublicMenuItem[];
}

export interface PublicRestaurant {
  name: string;
  slug: string;
  tagline: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
  whatsAppNumber: string;
  openTime: string;
  closeTime: string;
  isOpenNow: boolean;
  isGstEnabled: boolean;
  gstPercentage: number;
  isServiceChargeEnabled: boolean;
  serviceChargePercentage: number;
  showWelcomeMessage: boolean;
  welcomeMessage: string | null;
  backgroundMode: BackgroundMode;
  backgrounds: PublicBackground[];
  themeColor: string;
  /** Set when the restaurant takes UPI payments from customers. */
  upiId: string | null;
  upiPayeeName: string | null;
  /** False when the restaurant's plan has run out: the menu can be browsed but not ordered from. */
  orderingEnabled: boolean;
}

export interface PublicMenuResponse {
  restaurant: PublicRestaurant;
  categories: PublicCategory[];
}
