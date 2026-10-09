/** A star rating (guest about a restaurant, or owner about QRenvo). */
export interface Review {
  id: string;
  kind: 'Customer' | 'Owner';
  rating: number;
  name: string;
  comment: string | null;
  imageUrl: string | null;
  /** Uploaded photo, else (owner) the restaurant logo, else null: show the name's first letter. */
  displayImageUrl: string | null;
  restaurantName: string;
  tableNumber: string | null;
  isPublished: boolean;
  createdAt: string;
}

export interface ReviewInput {
  rating: number;
  name: string | null;
  comment: string | null;
  imageUrl: string | null;
}

export interface CustomerReviewSummary {
  average: number;
  count: number;
  /** Index 0 = 1 star ... index 4 = 5 stars. */
  countByStars: number[];
  items: Review[];
}
