-- =========================================================================
-- Flujo automatizado de códigos de referido
--
-- 1) Columna referred_by en profiles: quién refirió a este usuario.
-- 2) use_referral_code(p_code): el NUEVO USUARIO la llama justo después de
--    registrarse. Busca al referidor, valida el código, marca referred_by y,
--    para cada campaña de tipo 'referral' ACTIVA donde el referidor ya tenga
--    una loyalty_card, crea:
--      · Un premio pendiente para el REFERIDOR  (reward_description)
--      · Un premio pendiente para el REFERIDO   (config.referee_reward), si existe
--
-- Errores posibles:
--   'unauthorized'     → usuario no autenticado
--   'invalid_code'     → código no encontrado
--   'self_referral'    → el usuario intentó usar su propio código
--   'already_referred' → el usuario ya tiene un código aplicado
-- =========================================================================

-- ─── 1. Columna referred_by en profiles ─────────────────────────────────
alter table public.profiles
  add column if not exists referred_by uuid references public.profiles(id);

create index if not exists idx_profiles_referred_by on public.profiles(referred_by);

-- ─── 2. Función use_referral_code ───────────────────────────────────────
create or replace function public.use_referral_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referee_id      uuid;
  v_referrer        public.profiles%rowtype;
  v_already_ref     boolean;
  v_campaign        public.campaigns%rowtype;
  v_ref_card        public.loyalty_cards%rowtype;   -- tarjeta del referidor
  v_new_card        public.loyalty_cards%rowtype;   -- tarjeta del referido
  v_ref_reward_id   uuid;
  v_new_reward_id   uuid;
  v_referee_reward  text;
  v_rewards         jsonb := '[]'::jsonb;
  v_biz_name        text;
begin
  -- ── Autenticación ──────────────────────────────────────────
  v_referee_id := auth.uid();
  if v_referee_id is null then
    return jsonb_build_object('success', false, 'error', 'unauthorized');
  end if;

  -- ── Buscar referidor ───────────────────────────────────────
  select * into v_referrer
  from public.profiles
  where referral_code = upper(trim(p_code));

  if not found then
    return jsonb_build_object('success', false, 'error', 'invalid_code');
  end if;

  -- ── Validaciones ───────────────────────────────────────────
  if v_referrer.id = v_referee_id then
    return jsonb_build_object('success', false, 'error', 'self_referral');
  end if;

  select (referred_by is not null) into v_already_ref
  from public.profiles
  where id = v_referee_id;

  if v_already_ref then
    return jsonb_build_object('success', false, 'error', 'already_referred');
  end if;

  -- ── Marcar el referido ──────────────────────────────────────
  update public.profiles
  set referred_by = v_referrer.id
  where id = v_referee_id;

  -- ── Crear premios en las campañas de referidos aplicables ──
  -- Solo en campañas donde el REFERIDOR ya tiene una loyalty_card activa
  -- (evita premios en negocios que el referidor nunca visitó).
  for v_campaign in
    select c.*
    from public.campaigns c
    join public.loyalty_cards lc
      on lc.campaign_id = c.id
     and lc.customer_id = v_referrer.id
    where c.type     = 'referral'
      and c.status   = 'active'
      and c.is_active = true
  loop
    -- Nombre del negocio (para la respuesta)
    select name into v_biz_name
    from public.businesses
    where id = v_campaign.business_id;

    -- ── Premio para el REFERIDOR ──────────────────────────────
    select * into v_ref_card
    from public.loyalty_cards
    where customer_id = v_referrer.id
      and campaign_id = v_campaign.id;

    insert into public.rewards
      (customer_id, campaign_id, loyalty_card_id, business_id,
       description, status, expires_at)
    values
      (v_referrer.id, v_campaign.id, v_ref_card.id, v_campaign.business_id,
       v_campaign.reward_description, 'pending', now() + interval '90 days')
    returning id into v_ref_reward_id;

    -- Actualizar contadores de la tarjeta del referidor
    update public.loyalty_cards
    set total_stamps_ever = total_stamps_ever + 1,
        times_completed   = times_completed + 1,
        last_visit_at     = now(),
        updated_at        = now()
    where id = v_ref_card.id;

    -- ── Premio para el REFERIDO (si el negocio lo configura) ─
    v_referee_reward := trim(coalesce(to_jsonb(v_campaign.config) ->> 'referee_reward', ''));

    if v_referee_reward != '' then
      -- Obtener o crear loyalty_card para el referido
      select * into v_new_card
      from public.loyalty_cards
      where customer_id = v_referee_id
        and campaign_id = v_campaign.id;

      if not found then
        insert into public.loyalty_cards
          (customer_id, campaign_id, business_id)
        values
          (v_referee_id, v_campaign.id, v_campaign.business_id)
        returning * into v_new_card;
      end if;

      insert into public.rewards
        (customer_id, campaign_id, loyalty_card_id, business_id,
         description, status, expires_at)
      values
        (v_referee_id, v_campaign.id, v_new_card.id, v_campaign.business_id,
         v_referee_reward, 'pending', now() + interval '90 days')
      returning id into v_new_reward_id;

      update public.loyalty_cards
      set total_stamps_ever = total_stamps_ever + 1,
          updated_at        = now()
      where id = v_new_card.id;
    else
      v_new_reward_id := null;
    end if;

    -- Acumular resultado
    v_rewards := v_rewards || jsonb_build_object(
      'campaign_id',        v_campaign.id,
      'business_name',      v_biz_name,
      'referrer_reward_id', v_ref_reward_id,
      'referee_reward_id',  v_new_reward_id
    );

  end loop;

  return jsonb_build_object(
    'success',         true,
    'referrer_id',     v_referrer.id,
    'rewards_created', v_rewards
  );
end;
$$;

revoke all on function public.use_referral_code(text) from public;
grant execute on function public.use_referral_code(text) to authenticated;
