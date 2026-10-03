export interface RegisterRequest {
  restaurantName: string;
  ownerName: string;
  email: string;
  password: string;
  whatsAppNumber: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  ownerName: string;
  restaurantId: string;
  restaurantSlug: string;
  restaurantName: string;
}
