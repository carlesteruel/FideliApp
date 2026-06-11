-- =========================================================================
-- Flujo de canje de recompensas (sellos -> recompensa -> canje en negocio)
--
-- Reutiliza el mismo patrón que customer_qr_tokens / validate_qr_token:
--   1) El CLIENTE genera un token de canje efímero para una recompensa
--      pendiente (create_reward_token).
--   2) El NEGOCIO escanea el QR y valida (validate_reward_token).
--   3) El NEGOCIO confirma y consume el canje (redeem_reward_token), que
--      marca la recompensa como 'redeemed' e invalida el token.
--
-- Todo el acceso va por funciones SECURITY DEFINER; la tabla de tokens no
-- se expone vía RLS a ningún rol.
-- =========================================================================

-- ─── Tabla de tokens de canje ───────────────────────────────────────────
create table if not exists public.reward_qr_tokens (
  id         uuid primary key default gen_random_uuid(),
  reward_id  uuid not null references public.rewards(id) on delete cascade,
  token      text not null unique default replace(gen_random_uuid()::text, '-', ''),
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  used       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_reward_qr_tokens_token  on public.reward_qr_tokens(token);
create index if not exists idx_reward_qr_tokens_reward on public.reward_qr_tokens(reward_id);

-- Sin acceso directo: todo pasa por las funciones SECURITY DEFINER de abajo.
alter table public.reward_qr_tokens enable row level security;

-- =========================================================================
-- Function: create_reward_token
-- La llama el CLIENTE para generar un token de canje de una recompensa suya.
-- Devuelve { success: true, token, expires_at } o { success: false, error }
-- =========================================================================
create or replace function public.create_reward_token(p_reward_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reward  public.rewards%rowtype;
  v_token   text;
  v_expires timestamptz;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'unauthorized');
  end if;

  select * into v_reward from public.rewards where id = p_reward_id;
  if not found then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;

  if v_reward.customer_id <> auth.uid() then
    return jsonb_build_object('success', false, 'error', 'unauthorized');
  end if;

  if v_reward.status = 'redeemed' then
    return jsonb_build_object('success', false, 'error', 'already_redeemed');
  end if;

  if v_reward.status = 'expired'
     or (v_reward.expires_at is not null and v_reward.expires_at < now()) then
    return jsonb_build_object('success', false, 'error', 'expired');
  end if;

  -- Invalidamos tokens anteriores no usados de esta recompensa.
  update public.reward_qr_tokens
     set used = true
   where reward_id = p_reward_id
     and used = false;

  insert into public.reward_qr_tokens (reward_id)
  values (p_reward_id)
  returning token, expires_at into v_token, v_expires;

  return jsonb_build_object(
    'success', true,
    'token', v_token,
    'expires_at', v_expires
  );
end;
$$;

revoke all on function public.create_reward_token(uuid) from public;
grant execute on function public.create_reward_token(uuid) to authenticated;

-- =========================================================================
-- Function: validate_reward_token
-- La llama el NEGOCIO al escanear el QR de canje. Solo lectura/validación.
-- Devuelve { success: true, reward, campaign, profile }
--       o { success: false, error: 'unauthorized'|'not_found'|'used'|
--                                   'expired'|'already_redeemed' }
-- =========================================================================
create or replace function public.validate_reward_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tok      public.reward_qr_tokens%rowtype;
  v_reward   public.rewards%rowtype;
  v_campaign public.campaigns%rowtype;
  v_profile  public.profiles%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'unauthorized');
  end if;

  select * into v_tok from public.reward_qr_tokens where token = p_token;
  if not found then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;
  if v_tok.used then
    return jsonb_build_object('success', false, 'error', 'used');
  end if;
  if v_tok.expires_at < now() then
    return jsonb_build_object('success', false, 'error', 'expired');
  end if;

  select * into v_reward from public.rewards where id = v_tok.reward_id;
  if not found then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;
  if v_reward.status = 'redeemed' then
    return jsonb_build_object('success', false, 'error', 'already_redeemed');
  end if;
  if v_reward.status = 'expired'
     or (v_reward.expires_at is not null and v_reward.expires_at < now()) then
    return jsonb_build_object('success', false, 'error', 'expired');
  end if;

  -- Solo el dueño del negocio de esta recompensa puede validarla.
  if not exists (
    select 1 from public.businesses b
    where b.id = v_reward.business_id and b.owner_id = auth.uid()
  ) then
    return jsonb_build_object('success', false, 'error', 'unauthorized');
  end if;

  select * into v_campaign from public.campaigns where id = v_reward.campaign_id;
  select * into v_profile  from public.profiles  where id = v_reward.customer_id;

  return jsonb_build_object(
    'success', true,
    'reward', to_jsonb(v_reward),
    'campaign', to_jsonb(v_campaign),
    'profile', to_jsonb(v_profile)
  );
end;
$$;

revoke all on function public.validate_reward_token(text) from public;
grant execute on function public.validate_reward_token(text) to authenticated;

-- =========================================================================
-- Function: redeem_reward_token
-- La llama el NEGOCIO para confirmar y consumir el canje. Operación atómica:
--   - marca la recompensa como 'redeemed' (redeemed_at / redeemed_by)
--   - invalida el token
--   - incrementa campaigns.total_redemptions
-- Devuelve { success: true, reward_id } o { success: false, error }
-- =========================================================================
create or replace function public.redeem_reward_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tok    public.reward_qr_tokens%rowtype;
  v_reward public.rewards%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'unauthorized');
  end if;

  select * into v_tok from public.reward_qr_tokens where token = p_token for update;
  if not found then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;
  if v_tok.used then
    return jsonb_build_object('success', false, 'error', 'used');
  end if;
  if v_tok.expires_at < now() then
    return jsonb_build_object('success', false, 'error', 'expired');
  end if;

  select * into v_reward from public.rewards where id = v_tok.reward_id for update;
  if not found then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;
  if v_reward.status = 'redeemed' then
    return jsonb_build_object('success', false, 'error', 'already_redeemed');
  end if;

  -- Solo el dueño del negocio de esta recompensa puede canjearla.
  if not exists (
    select 1 from public.businesses b
    where b.id = v_reward.business_id and b.owner_id = auth.uid()
  ) then
    return jsonb_build_object('success', false, 'error', 'unauthorized');
  end if;

  update public.rewards
     set status = 'redeemed',
         redeemed_at = now(),
         redeemed_by = auth.uid()
   where id = v_reward.id;

  update public.reward_qr_tokens
     set used = true
   where id = v_tok.id;

  update public.campaigns
     set total_redemptions = total_redemptions + 1
   where id = v_reward.campaign_id;

  return jsonb_build_object('success', true, 'reward_id', v_reward.id);
end;
$$;

revoke all on function public.redeem_reward_token(text) from public;
grant execute on function public.redeem_reward_token(text) to authenticated;
