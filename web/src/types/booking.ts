export interface Booking {
  id: string;
  title: string;
  other_name: string;
  agreed_price?: number;
  status: string;
  category?: string;
  artisan_name?: string;
  client_id: string;
  artisan_id?: string;
  created_at: string;
  updated_at?: string;
  time_label?: string;
  price?: number;
}
