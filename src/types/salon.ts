export interface Salon {
  id: number;
  bcart_customer_id: string | null;
  name: string;
  postal_code: string | null;
  prefecture: string | null;
  address: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  customer_group_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SalonWithDistance extends Salon {
  distance_km: number;
}

export interface SearchRequest {
  prefecture?: string;
  address?: string;
  lat?: number;
  lng?: number;
  radius_km?: number;
  limit?: number;
}

export interface SearchResponse {
  salons: SalonWithDistance[];
  total: number;
  query_lat: number | null;
  query_lng: number | null;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  formatted_address: string;
}

export interface BcartCustomer {
  id: string;
  name: string;
  postal_code: string;
  prefecture: string;
  address: string;
  phone: string;
  group_id: string;
}
