-- ============================================================
-- SCHEMA COMPLETO - App de Fidelización de Negocios
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- ─────────────────────────────────────────
-- EXTENSIONES
-- ─────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- para búsquedas de texto

-- ─────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────
CREATE TYPE user_role AS ENUM ('client', 'business', 'admin');
CREATE TYPE campaign_type AS ENUM ('punch_card', 'points', 'birthday', 'streak', 'cashback', 'referral');
CREATE TYPE reward_status AS ENUM ('pending', 'redeemed', 'expired');
CREATE TYPE business_category AS ENUM ('restaurant', 'cafe', 'bar', 'bakery', 'fast_food', 'pizza', 'sushi', 'other');

-- ─────────────────────────────────────────
-- TABLA: profiles (extiende auth.users)
-- ─────────────────────────────────────────
CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role          user_role NOT NULL DEFAULT 'client',
  full_name     TEXT NOT NULL,
  email         TEXT NOT NULL,
  phone         TEXT,
  avatar_url    TEXT,
  birth_date    DATE,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- TABLA: businesses
-- ─────────────────────────────────────────
CREATE TABLE businesses (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  category      business_category NOT NULL DEFAULT 'other',
  address       TEXT,
  city          TEXT,
  phone         TEXT,
  email         TEXT,
  website       TEXT,
  logo_url      TEXT,
  cover_url     TEXT,
  latitude      DECIMAL(10, 8),
  longitude     DECIMAL(11, 8),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- TABLA: campaigns (campañas de fidelización)
-- ─────────────────────────────────────────
CREATE TABLE campaigns (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id         UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  description         TEXT,
  type                campaign_type NOT NULL DEFAULT 'punch_card',
  -- Configuración flexible por tipo:
  -- punch_card:   { "total_stamps": 10, "reward": "Café gratis" }
  -- points:       { "points_per_euro": 10, "points_to_reward": 500, "reward": "5€ descuento" }
  -- birthday:     { "reward": "Postre gratis", "days_window": 7 }
  -- streak:       { "visits_required": 5, "period_days": 7, "reward": "Bebida gratis" }
  -- cashback:     { "percentage": 5, "min_purchase": 10 }
  -- referral:     { "referrer_reward": "Café gratis", "referee_reward": "10% descuento" }
  config              JSONB NOT NULL DEFAULT '{}',
  reward_description  TEXT NOT NULL,
  image_url           TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  start_date          DATE,
  end_date            DATE,
  max_redemptions     INTEGER, -- null = ilimitado
  total_redemptions   INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- TABLA: loyalty_cards (tarjeta del cliente por campaña)
-- ─────────────────────────────────────────
CREATE TABLE loyalty_cards (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  campaign_id       UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  business_id       UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  -- Punch card
  current_stamps    INTEGER NOT NULL DEFAULT 0,
  total_stamps_ever INTEGER NOT NULL DEFAULT 0, -- histórico total
  -- Points
  current_points    INTEGER NOT NULL DEFAULT 0,
  total_points_ever INTEGER NOT NULL DEFAULT 0,
  -- Streak
  current_streak    INTEGER NOT NULL DEFAULT 0,
  last_visit_at     TIMESTAMPTZ,
  -- Estado
  is_completed      BOOLEAN NOT NULL DEFAULT FALSE, -- completada pero no canjeada
  times_completed   INTEGER NOT NULL DEFAULT 0,     -- veces que ha completado la tarjeta
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(customer_id, campaign_id)
);

-- ─────────────────────────────────────────
-- TABLA: stamps (registro de cada sello/visita)
-- ─────────────────────────────────────────
CREATE TABLE stamps (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loyalty_card_id   UUID NOT NULL REFERENCES loyalty_cards(id) ON DELETE CASCADE,
  customer_id       UUID NOT NULL REFERENCES profiles(id),
  business_id       UUID NOT NULL REFERENCES businesses(id),
  campaign_id       UUID NOT NULL REFERENCES campaigns(id),
  stamped_by        UUID NOT NULL REFERENCES profiles(id), -- empleado/dueño del negocio
  points_added      INTEGER NOT NULL DEFAULT 0,
  amount_spent      DECIMAL(10,2), -- importe gastado (para cashback/puntos por €)
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- TABLA: rewards (premios ganados)
-- ─────────────────────────────────────────
CREATE TABLE rewards (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  campaign_id       UUID NOT NULL REFERENCES campaigns(id),
  loyalty_card_id   UUID NOT NULL REFERENCES loyalty_cards(id),
  business_id       UUID NOT NULL REFERENCES businesses(id),
  description       TEXT NOT NULL,
  status            reward_status NOT NULL DEFAULT 'pending',
  redeemed_at       TIMESTAMPTZ,
  redeemed_by       UUID REFERENCES profiles(id), -- quién validó el canje
  expires_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- TABLA: customer_qr_tokens (token temporal para escaneo)
-- ─────────────────────────────────────────
CREATE TABLE customer_qr_tokens (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token         TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),
  used          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- TABLA: business_staff (empleados del negocio)
-- ─────────────────────────────────────────
CREATE TABLE business_staff (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  profile_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(business_id, profile_id)
);

-- ─────────────────────────────────────────
-- TABLA: push_tokens (para notificaciones)
-- ─────────────────────────────────────────
CREATE TABLE push_tokens (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token         TEXT NOT NULL,
  platform      TEXT NOT NULL CHECK (platform IN ('android', 'ios')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, token)
);

-- ─────────────────────────────────────────
-- ÍNDICES para performance
-- ─────────────────────────────────────────
CREATE INDEX idx_businesses_owner ON businesses(owner_id);
CREATE INDEX idx_businesses_category ON businesses(category);
CREATE INDEX idx_businesses_city ON businesses(city);
CREATE INDEX idx_campaigns_business ON campaigns(business_id);
CREATE INDEX idx_campaigns_type ON campaigns(type);
CREATE INDEX idx_campaigns_active ON campaigns(is_active);
CREATE INDEX idx_loyalty_cards_customer ON loyalty_cards(customer_id);
CREATE INDEX idx_loyalty_cards_campaign ON loyalty_cards(campaign_id);
CREATE INDEX idx_loyalty_cards_business ON loyalty_cards(business_id);
CREATE INDEX idx_stamps_customer ON stamps(customer_id);
CREATE INDEX idx_stamps_business ON stamps(business_id);
CREATE INDEX idx_stamps_created ON stamps(created_at DESC);
CREATE INDEX idx_rewards_customer ON rewards(customer_id);
CREATE INDEX idx_rewards_status ON rewards(status);
CREATE INDEX idx_qr_tokens_token ON customer_qr_tokens(token);
CREATE INDEX idx_qr_tokens_customer ON customer_qr_tokens(customer_id);

-- ─────────────────────────────────────────
-- FUNCIÓN: actualizar updated_at automáticamente
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_businesses_updated_at
  BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_loyalty_cards_updated_at
  BEFORE UPDATE ON loyalty_cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────
-- FUNCIÓN: crear profile al registrarse
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'client')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─────────────────────────────────────────
-- FUNCIÓN: añadir sello / puntos a tarjeta
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION add_stamp(
  p_customer_id   UUID,
  p_campaign_id   UUID,
  p_stamped_by    UUID,
  p_amount_spent  DECIMAL DEFAULT NULL,
  p_notes         TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_campaign      campaigns%ROWTYPE;
  v_business      businesses%ROWTYPE;
  v_card          loyalty_cards%ROWTYPE;
  v_stamp_id      UUID;
  v_reward_earned BOOLEAN := FALSE;
  v_reward_id     UUID;
  v_total_stamps  INTEGER;
  v_points_add    INTEGER := 1;
BEGIN
  -- Obtener campaña
  SELECT * INTO v_campaign FROM campaigns WHERE id = p_campaign_id AND is_active = TRUE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Campaña no encontrada o inactiva');
  END IF;

  -- Obtener negocio
  SELECT * INTO v_business FROM businesses WHERE id = v_campaign.business_id;

  -- Calcular puntos a añadir según tipo
  IF v_campaign.type = 'points' AND p_amount_spent IS NOT NULL THEN
    v_points_add := FLOOR(p_amount_spent * COALESCE((v_campaign.config->>'points_per_euro')::INTEGER, 10));
  END IF;

  -- Obtener o crear tarjeta del cliente
  INSERT INTO loyalty_cards (customer_id, campaign_id, business_id)
  VALUES (p_customer_id, p_campaign_id, v_campaign.business_id)
  ON CONFLICT (customer_id, campaign_id) DO NOTHING;

  SELECT * INTO v_card FROM loyalty_cards 
  WHERE customer_id = p_customer_id AND campaign_id = p_campaign_id;

  -- Crear el sello
  INSERT INTO stamps (loyalty_card_id, customer_id, business_id, campaign_id, stamped_by, points_added, amount_spent, notes)
  VALUES (v_card.id, p_customer_id, v_campaign.business_id, p_campaign_id, p_stamped_by, v_points_add, p_amount_spent, p_notes)
  RETURNING id INTO v_stamp_id;

  -- Actualizar tarjeta según tipo de campaña
  v_total_stamps := v_campaign.config->>'total_stamps';

  IF v_campaign.type = 'punch_card' THEN
    UPDATE loyalty_cards
    SET 
      current_stamps = current_stamps + 1,
      total_stamps_ever = total_stamps_ever + 1,
      last_visit_at = NOW(),
      is_completed = (current_stamps + 1 >= COALESCE(v_total_stamps, 10)),
      updated_at = NOW()
    WHERE id = v_card.id
    RETURNING * INTO v_card;

    -- Si completó la tarjeta → generar premio
    IF v_card.is_completed THEN
      v_reward_earned := TRUE;
      INSERT INTO rewards (customer_id, campaign_id, loyalty_card_id, business_id, description, expires_at)
      VALUES (
        p_customer_id, p_campaign_id, v_card.id, v_campaign.business_id,
        v_campaign.reward_description,
        NOW() + INTERVAL '30 days'
      )
      RETURNING id INTO v_reward_id;

      -- Reiniciar la tarjeta
      UPDATE loyalty_cards
      SET current_stamps = 0, is_completed = FALSE, times_completed = times_completed + 1, updated_at = NOW()
      WHERE id = v_card.id;

      -- Actualizar contador de la campaña
      UPDATE campaigns SET total_redemptions = total_redemptions + 1 WHERE id = p_campaign_id;
    END IF;

  ELSIF v_campaign.type = 'points' THEN
    UPDATE loyalty_cards
    SET 
      current_points = current_points + v_points_add,
      total_points_ever = total_points_ever + v_points_add,
      last_visit_at = NOW(),
      updated_at = NOW()
    WHERE id = v_card.id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'stamp_id', v_stamp_id,
    'reward_earned', v_reward_earned,
    'reward_id', v_reward_id,
    'card_id', v_card.id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────
-- FUNCIÓN: canjear premio
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION redeem_reward(
  p_reward_id   UUID,
  p_redeemed_by UUID
)
RETURNS JSONB AS $$
DECLARE
  v_reward rewards%ROWTYPE;
BEGIN
  SELECT * INTO v_reward FROM rewards WHERE id = p_reward_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Premio no encontrado');
  END IF;

  IF v_reward.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'El premio ya fue canjeado o expiró');
  END IF;

  IF v_reward.expires_at < NOW() THEN
    UPDATE rewards SET status = 'expired' WHERE id = p_reward_id;
    RETURN jsonb_build_object('success', false, 'error', 'El premio ha expirado');
  END IF;

  UPDATE rewards
  SET status = 'redeemed', redeemed_at = NOW(), redeemed_by = p_redeemed_by
  WHERE id = p_reward_id;

  RETURN jsonb_build_object('success', true, 'message', 'Premio canjeado correctamente');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────

-- Habilitar RLS en todas las tablas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE stamps ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_qr_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- ── profiles ──
CREATE POLICY "Usuarios ven su propio perfil" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Usuarios actualizan su perfil" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Negocios ven perfiles de clientes" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- ── businesses ──
CREATE POLICY "Negocios públicamente visibles" ON businesses
  FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Dueño gestiona su negocio" ON businesses
  FOR ALL USING (owner_id = auth.uid());

-- ── campaigns ──
CREATE POLICY "Campañas activas visibles por todos" ON campaigns
  FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Negocio gestiona sus campañas" ON campaigns
  FOR ALL USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

-- ── loyalty_cards ──
CREATE POLICY "Cliente ve sus tarjetas" ON loyalty_cards
  FOR SELECT USING (customer_id = auth.uid());

CREATE POLICY "Negocio ve tarjetas de su campaña" ON loyalty_cards
  FOR SELECT USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

CREATE POLICY "Sistema crea/actualiza tarjetas" ON loyalty_cards
  FOR INSERT WITH CHECK (customer_id = auth.uid());

-- ── stamps ──
CREATE POLICY "Cliente ve sus sellos" ON stamps
  FOR SELECT USING (customer_id = auth.uid());

CREATE POLICY "Negocio ve sellos de sus campañas" ON stamps
  FOR SELECT USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

-- ── rewards ──
CREATE POLICY "Cliente ve sus premios" ON rewards
  FOR SELECT USING (customer_id = auth.uid());

CREATE POLICY "Negocio ve premios de sus campañas" ON rewards
  FOR SELECT USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

-- ── customer_qr_tokens ──
CREATE POLICY "Cliente ve y crea sus QR tokens" ON customer_qr_tokens
  FOR ALL USING (customer_id = auth.uid());

-- ── push_tokens ──
CREATE POLICY "Usuario gestiona sus tokens push" ON push_tokens
  FOR ALL USING (user_id = auth.uid());

-- ─────────────────────────────────────────
-- DATOS DE EJEMPLO (opcional, para testing)
-- ─────────────────────────────────────────
-- Descomenta para insertar datos de prueba después de crear usuarios en Auth
/*
-- Ejemplo de negocio y campaña punch card
INSERT INTO businesses (owner_id, name, category, description, city)
VALUES ('<TU_USER_ID>', 'Café Central', 'cafe', 'El mejor café del barrio', 'Barcelona');

INSERT INTO campaigns (business_id, name, type, config, reward_description)
VALUES (
  '<BUSINESS_ID>',
  '10 Cafés y el siguiente gratis',
  'punch_card',
  '{"total_stamps": 10, "reward": "1 café gratis"}',
  '1 café de cualquier tipo completamente gratis'
);
*/
