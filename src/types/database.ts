// ============================================================
// Tipos generados del schema de Supabase
// ============================================================

export type UserRole = 'client' | 'business' | 'admin';
export type CampaignType = 'punch_card' | 'points' | 'birthday' | 'streak' | 'cashback' | 'referral';
export type RewardStatus = 'pending' | 'redeemed' | 'expired';
export type BusinessCategory = 'restaurant' | 'cafe' | 'bar' | 'bakery' | 'fast_food' | 'pizza' | 'sushi' | 'other';

// ─── Configuraciones por tipo de campaña ───────────────────
export interface PunchCardConfig {
  total_stamps: number;
  reward: string;
}
export interface PointsConfig {
  points_per_euro: number;
  points_to_reward: number;
  reward: string;
}
export interface BirthdayConfig {
  reward: string;
  days_window: number;
}
export interface StreakConfig {
  visits_required: number;
  period_days: number;
  reward: string;
}
export interface CashbackConfig {
  percentage: number;
  min_purchase: number;
}
export interface ReferralConfig {
  referrer_reward: string;
  referee_reward: string;
}

export type CampaignConfig =
  | PunchCardConfig
  | PointsConfig
  | BirthdayConfig
  | StreakConfig
  | CashbackConfig
  | ReferralConfig;

// ─── Tablas de la base de datos ─────────────────────────────
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
      };
      businesses: {
        Row: Business;
        Insert: BusinessInsert;
        Update: BusinessUpdate;
      };
      campaigns: {
        Row: Campaign;
        Insert: CampaignInsert;
        Update: CampaignUpdate;
      };
      loyalty_cards: {
        Row: LoyaltyCard;
        Insert: LoyaltyCardInsert;
        Update: LoyaltyCardUpdate;
      };
      stamps: {
        Row: Stamp;
        Insert: StampInsert;
        Update: never;
      };
      rewards: {
        Row: Reward;
        Insert: RewardInsert;
        Update: RewardUpdate;
      };
      customer_qr_tokens: {
        Row: CustomerQrToken;
        Insert: CustomerQrTokenInsert;
        Update: CustomerQrTokenUpdate;
      };
      push_tokens: {
        Row: PushToken;
        Insert: PushTokenInsert;
        Update: PushTokenUpdate;
      };
    };
    Functions: {
      add_stamp: {
        Args: {
          p_customer_id: string;
          p_campaign_id: string;
          p_stamped_by: string;
          p_amount_spent?: number;
          p_notes?: string;
        };
        Returns: AddStampResult;
      };
      redeem_reward: {
        Args: {
          p_reward_id: string;
          p_redeemed_by: string;
        };
        Returns: RedeemRewardResult;
      };
    };
  };
}

// ─── Profile ────────────────────────────────────────────────
export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  birth_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
export type ProfileInsert = Omit<Profile, 'created_at' | 'updated_at'>;
export type ProfileUpdate = Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>;

// ─── Business ───────────────────────────────────────────────
export interface Business {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  category: BusinessCategory;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logo_url: string | null;
  cover_url: string | null;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
export type BusinessInsert = Omit<Business, 'id' | 'created_at' | 'updated_at'>;
export type BusinessUpdate = Partial<Omit<Business, 'id' | 'owner_id' | 'created_at' | 'updated_at'>>;

// ─── Campaign ───────────────────────────────────────────────
export interface Campaign {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  type: CampaignType;
  config: CampaignConfig;
  reward_description: string;
  image_url: string | null;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  max_redemptions: number | null;
  total_redemptions: number;
  created_at: string;
  updated_at: string;
}
export type CampaignInsert = Omit<Campaign, 'id' | 'total_redemptions' | 'created_at' | 'updated_at'>;
export type CampaignUpdate = Partial<Omit<Campaign, 'id' | 'business_id' | 'created_at' | 'updated_at'>>;

// ─── LoyaltyCard ────────────────────────────────────────────
export interface LoyaltyCard {
  id: string;
  customer_id: string;
  campaign_id: string;
  business_id: string;
  current_stamps: number;
  total_stamps_ever: number;
  current_points: number;
  total_points_ever: number;
  current_streak: number;
  last_visit_at: string | null;
  is_completed: boolean;
  times_completed: number;
  created_at: string;
  updated_at: string;
}
export type LoyaltyCardInsert = Pick<LoyaltyCard, 'customer_id' | 'campaign_id' | 'business_id'>;
export type LoyaltyCardUpdate = Partial<Pick<LoyaltyCard, 'current_stamps' | 'current_points' | 'current_streak' | 'is_completed'>>;

// ─── Stamp ──────────────────────────────────────────────────
export interface Stamp {
  id: string;
  loyalty_card_id: string;
  customer_id: string;
  business_id: string;
  campaign_id: string;
  stamped_by: string;
  points_added: number;
  amount_spent: number | null;
  notes: string | null;
  created_at: string;
}
export type StampInsert = Omit<Stamp, 'id' | 'created_at'>;

// ─── Reward ─────────────────────────────────────────────────
export interface Reward {
  id: string;
  customer_id: string;
  campaign_id: string;
  loyalty_card_id: string;
  business_id: string;
  description: string;
  status: RewardStatus;
  redeemed_at: string | null;
  redeemed_by: string | null;
  expires_at: string | null;
  created_at: string;
}
export type RewardInsert = Omit<Reward, 'id' | 'redeemed_at' | 'redeemed_by' | 'created_at'>;
export type RewardUpdate = Partial<Pick<Reward, 'status' | 'redeemed_at' | 'redeemed_by'>>;

// ─── QR Token ───────────────────────────────────────────────
export interface CustomerQrToken {
  id: string;
  customer_id: string;
  token: string;
  expires_at: string;
  used: boolean;
  created_at: string;
}
export type CustomerQrTokenInsert = Pick<CustomerQrToken, 'customer_id'>;
export type CustomerQrTokenUpdate = Pick<CustomerQrToken, 'used'>;

// ─── PushToken ──────────────────────────────────────────────
export interface PushToken {
  id: string;
  user_id: string;
  token: string;
  platform: 'android' | 'ios';
  created_at: string;
  updated_at: string;
}
export type PushTokenInsert = Omit<PushToken, 'id' | 'created_at' | 'updated_at'>;
export type PushTokenUpdate = Partial<Pick<PushToken, 'token'>>;

// ─── Funciones RPC results ──────────────────────────────────
export interface AddStampResult {
  success: boolean;
  stamp_id?: string;
  reward_earned?: boolean;
  reward_id?: string;
  card_id?: string;
  error?: string;
}
export interface RedeemRewardResult {
  success: boolean;
  message?: string;
  error?: string;
}

// ─── Tipos extendidos con joins ─────────────────────────────
export interface CampaignWithBusiness extends Campaign {
  businesses: Pick<Business, 'id' | 'name' | 'logo_url' | 'city' | 'category'>;
}

export interface LoyaltyCardWithCampaign extends LoyaltyCard {
  campaigns: CampaignWithBusiness;
}

export interface RewardWithDetails extends Reward {
  campaigns: Pick<Campaign, 'id' | 'name' | 'type'>;
  businesses: Pick<Business, 'id' | 'name' | 'logo_url'>;
}
