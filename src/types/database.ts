// ============================================================
// Tipos generados del schema de Supabase
// ============================================================

export type UserRole = 'client' | 'business' | 'admin';
export type CampaignType =
  | 'punch_card'
  | 'points'
  | 'birthday'
  | 'streak'
  | 'cashback'
  | 'referral'
  | 'first_visit'
  | 'min_spend'
  | 'monthly_visits';
export type CampaignStatus = 'active' | 'ended' | 'archived';
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
export interface FirstVisitConfig {
  reward: string;
}
export interface MinSpendConfig {
  min_amount: number;
  reward: string;
}
export interface MonthlyVisitsConfig {
  visits_required: number;
  reward: string;
}

export type CampaignConfig =
  | PunchCardConfig
  | PointsConfig
  | BirthdayConfig
  | StreakConfig
  | CashbackConfig
  | ReferralConfig
  | FirstVisitConfig
  | MinSpendConfig
  | MonthlyVisitsConfig;

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
      reward_qr_tokens: {
        Row: RewardQrToken;
        Insert: RewardQrTokenInsert;
        Update: RewardQrTokenUpdate;
      };
      push_tokens: {
        Row: PushToken;
        Insert: PushTokenInsert;
        Update: PushTokenUpdate;
      };
      reward_catalog_items: {
        Row: RewardCatalogItem;
        Insert: RewardCatalogItemInsert;
        Update: RewardCatalogItemUpdate;
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
      create_reward_token: {
        Args: { p_reward_id: string };
        Returns: CreateRewardTokenResult;
      };
      validate_reward_token: {
        Args: { p_token: string };
        Returns: ValidateRewardTokenResult;
      };
      redeem_reward_token: {
        Args: { p_token: string };
        Returns: RedeemRewardResult;
      };
      set_campaign_status: {
        Args: { p_campaign_id: string; p_status: CampaignStatus };
        Returns: SetCampaignStatusResult;
      };
      redeem_catalog_item: {
        Args: { p_item_id: string };
        Returns: RedeemCatalogItemResult;
      };
      claim_birthday_reward: {
        Args: Record<string, never>;
        Returns: ClaimBirthdayRewardResult;
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
  referral_code: string | null;
  referred_by: string | null;
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
  card_color: string | null;
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
  status: CampaignStatus;
  ended_at: string | null;
  archived_at: string | null;
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

// ─── Reward Catalog Item (catálogo de puntos) ───────────────
export interface RewardCatalogItem {
  id: string;
  campaign_id: string;
  business_id: string;
  name: string;
  description: string | null;
  points_cost: number;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
}
export type RewardCatalogItemInsert = Pick<
  RewardCatalogItem,
  'campaign_id' | 'business_id' | 'name' | 'description' | 'points_cost' | 'image_url'
>;
export type RewardCatalogItemUpdate = Partial<
  Pick<RewardCatalogItem, 'name' | 'description' | 'points_cost' | 'image_url' | 'is_active'>
>;


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

// ─── Reward QR Token (canje) ────────────────────────────────
export interface RewardQrToken {
  id: string;
  reward_id: string;
  token: string;
  expires_at: string;
  used: boolean;
  created_at: string;
}
export type RewardQrTokenInsert = Pick<RewardQrToken, 'reward_id'>;
export type RewardQrTokenUpdate = Pick<RewardQrToken, 'used'>;

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
  reward_id?: string;
  error?: RewardTokenError | string;
}

export type RewardTokenError =
  | 'unauthorized'
  | 'not_found'
  | 'used'
  | 'expired'
  | 'already_redeemed';

export interface CreateRewardTokenResult {
  success: boolean;
  token?: string;
  expires_at?: string;
  error?: RewardTokenError | string;
}

export interface ValidateRewardTokenResult {
  success: boolean;
  reward?: Reward;
  campaign?: Campaign;
  profile?: Profile;
  error?: RewardTokenError | string;
}

export interface SetCampaignStatusResult {
  success: boolean;
  error?: 'unauthorized' | 'invalid_status' | 'not_found' | string;
}

export type RedeemCatalogItemError =
  | 'unauthorized'
  | 'not_found'
  | 'inactive'
  | 'campaign_archived'
  | 'no_card'
  | 'insufficient_points';

export interface RedeemCatalogItemResult {
  success: boolean;
  reward_id?: string;
  points_left?: number;
  error?: RedeemCatalogItemError | string;
}

export interface ClaimBirthdayRewardResult {
  success: boolean;
  rewards_created?: Array<{ campaign_id: string; reward_id: string }>;
  error?: string;
}

export type UseReferralCodeError =
  | 'unauthorized'
  | 'invalid_code'
  | 'self_referral'
  | 'already_referred';

export interface UseReferralCodeResult {
  success: boolean;
  referrer_id?: string;
  rewards_created?: Array<{
    campaign_id: string;
    business_name: string;
    referrer_reward_id: string | null;
    referee_reward_id: string | null;
  }>;
  error?: UseReferralCodeError | string;
}


// ─── Tipos extendidos con joins ─────────────────────────────
export interface CampaignWithBusiness extends Campaign {
  businesses: Pick<Business, 'id' | 'name' | 'logo_url' | 'cover_url' | 'card_color' | 'city' | 'category'>;
}

export interface LoyaltyCardWithCampaign extends LoyaltyCard {
  campaigns: CampaignWithBusiness;
}

export interface RewardWithDetails extends Reward {
  campaigns: Pick<Campaign, 'id' | 'name' | 'type'>;
  businesses: Pick<Business, 'id' | 'name' | 'logo_url'>;
}
