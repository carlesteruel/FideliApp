-- =========================================================================
-- add_stamp: Implementación completa para todos los tipos de campaña.
--
-- IMPORTANTE: El stamp se inserta ANTES de actualizar loyalty_cards para
-- que el trigger tg_block_stamps_for_inactive_campaign lea el valor OLD
-- de is_completed (no el que vamos a escribir ahora).
--
-- Tipos de campaña:
--   punch_card     : X sellos → premio; reinicia counter al completar
--   points         : Acumula puntos por € (sin auto-premio; usa catálogo)
--   streak         : X visitas en Y días → premio; resetea si pasa demasiado
--   birthday       : Solo registra la tarjeta; el premio lo emite claim_birthday_reward()
--   first_visit    : Premio únicamente en el primer sello de la tarjeta
--   min_spend      : Premio si el gasto >= min_amount en esa visita
--   monthly_visits : X visitas en el mes natural → premio; se reinicia cada mes
--   referral       : Cada sello = confirmación de un referido → premio directo
-- =========================================================================

-- Asegurar columnas necesarias en loyalty_cards
alter table public.loyalty_cards
  add column if not exists last_visit_at timestamptz;

alter table public.loyalty_cards
  add column if not exists current_streak integer not null default 0;

-- ─── Función add_stamp ──────────────────────────────────────────────────────
create or replace function public.add_stamp(
  p_customer_id  uuid,
  p_campaign_id  uuid,
  p_stamped_by   uuid,
  p_amount_spent numeric  default null,
  p_notes        text     default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign         public.campaigns%rowtype;
  v_card             public.loyalty_cards%rowtype;
  v_stamp_id         uuid;
  v_reward_id        uuid;
  v_reward_earned    boolean  := false;
  v_config           jsonb;
  v_points_added     integer  := 0;

  -- streak
  v_visits_required  integer;
  v_period_days      integer;
  v_new_streak       integer;

  -- punch_card / monthly_visits
  v_total_stamps     integer;
  v_effective_stamps integer;

  -- min_spend
  v_min_amount       numeric;
begin
  -- ── Auth ─────────────────────────────────────────────────────────
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'unauthorized');
  end if;

  -- ── Cargar campaña ───────────────────────────────────────────────
  select * into v_campaign from public.campaigns where id = p_campaign_id;
  if not found then
    return jsonb_build_object('success', false, 'error', 'campaign_not_found');
  end if;
  if v_campaign.status = 'archived' then
    return jsonb_build_object('success', false, 'error', 'campaign_archived');
  end if;
  -- Campaña activa pero pausada (is_active=false con status='active')
  if v_campaign.status = 'active' and not v_campaign.is_active then
    return jsonb_build_object('success', false, 'error', 'campaign_paused');
  end if;

  v_config := to_jsonb(v_campaign.config);

  -- ── Obtener o crear loyalty_card ─────────────────────────────────
  -- El trigger tg_block_new_cards disparará aquí si la campaña está ended/archived.
  select * into v_card
    from public.loyalty_cards
   where customer_id = p_customer_id and campaign_id = p_campaign_id
   for update;

  if not found then
    insert into public.loyalty_cards (customer_id, campaign_id, business_id)
    values (p_customer_id, p_campaign_id, v_campaign.business_id)
    returning * into v_card;
  end if;

  -- ── Pre-calcular valores por tipo ────────────────────────────────
  -- (necesario antes del INSERT en stamps para incluir points_added)

  if v_campaign.type = 'punch_card' then
    v_total_stamps  := coalesce((v_config->>'total_stamps')::integer, 10);
    v_reward_earned := (v_card.current_stamps + 1 >= v_total_stamps);

  elsif v_campaign.type = 'points' then
    if p_amount_spent is not null and p_amount_spent > 0 then
      v_points_added := floor(
        p_amount_spent * coalesce((v_config->>'points_per_euro')::numeric, 10)
      )::integer;
    end if;

  elsif v_campaign.type = 'streak' then
    v_visits_required := coalesce((v_config->>'visits_required')::integer, 5);
    v_period_days     := coalesce((v_config->>'period_days')::integer, 7);

    if v_card.last_visit_at is null
       or now() - v_card.last_visit_at > (v_period_days || ' days')::interval
    then
      v_new_streak := 1;
    else
      v_new_streak := v_card.current_streak + 1;
    end if;
    v_reward_earned := (v_new_streak >= v_visits_required);

  elsif v_campaign.type = 'first_visit' then
    v_reward_earned := (v_card.total_stamps_ever = 0);

  elsif v_campaign.type = 'min_spend' then
    v_min_amount    := coalesce((v_config->>'min_amount')::numeric, 20);
    v_reward_earned := (p_amount_spent is not null and p_amount_spent >= v_min_amount);

  elsif v_campaign.type = 'monthly_visits' then
    v_total_stamps := coalesce((v_config->>'visits_required')::integer, 4);
    -- Determinar el contador efectivo (0 si el mes cambió)
    if v_card.last_visit_at is not null
       and date_trunc('month', v_card.last_visit_at) = date_trunc('month', now())
    then
      v_effective_stamps := v_card.current_stamps;
    else
      v_effective_stamps := 0;
    end if;
    v_reward_earned := (v_effective_stamps + 1 >= v_total_stamps);

  elsif v_campaign.type = 'referral' then
    -- Cada sello = confirmación de un referido → premio directo
    v_reward_earned := true;

  -- birthday / cashback / resto: sin auto-premio
  end if;

  -- ── INSERT stamp (ANTES de actualizar loyalty_card) ──────────────
  -- El trigger tg_block_stamps_for_inactive_campaign lee el valor ACTUAL
  -- (antes de este UPDATE) de loyalty_cards.is_completed, que es correcto.
  insert into public.stamps
    (loyalty_card_id, customer_id, business_id, campaign_id,
     stamped_by, points_added, amount_spent, notes)
  values
    (v_card.id, p_customer_id, v_campaign.business_id, p_campaign_id,
     p_stamped_by, v_points_added, p_amount_spent, p_notes)
  returning id into v_stamp_id;

  -- ── UPDATE loyalty_card ──────────────────────────────────────────
  if v_campaign.type = 'punch_card' then
    update public.loyalty_cards
       set current_stamps    = case when v_reward_earned then 0 else current_stamps + 1 end,
           total_stamps_ever = total_stamps_ever + 1,
           is_completed      = v_reward_earned,
           times_completed   = times_completed + (case when v_reward_earned then 1 else 0 end),
           last_visit_at     = now(),
           updated_at        = now()
     where id = v_card.id;

  elsif v_campaign.type = 'points' then
    update public.loyalty_cards
       set current_points    = current_points + v_points_added,
           total_points_ever = total_points_ever + v_points_added,
           total_stamps_ever = total_stamps_ever + 1,
           last_visit_at     = now(),
           updated_at        = now()
     where id = v_card.id;

  elsif v_campaign.type = 'streak' then
    update public.loyalty_cards
       set current_streak    = case when v_reward_earned then 0 else v_new_streak end,
           total_stamps_ever = total_stamps_ever + 1,
           times_completed   = times_completed + (case when v_reward_earned then 1 else 0 end),
           last_visit_at     = now(),
           updated_at        = now()
     where id = v_card.id;

  elsif v_campaign.type = 'first_visit' then
    update public.loyalty_cards
       set total_stamps_ever = total_stamps_ever + 1,
           times_completed   = times_completed + (case when v_reward_earned then 1 else 0 end),
           last_visit_at     = now(),
           updated_at        = now()
     where id = v_card.id;

  elsif v_campaign.type = 'min_spend' then
    update public.loyalty_cards
       set total_stamps_ever = total_stamps_ever + 1,
           times_completed   = times_completed + (case when v_reward_earned then 1 else 0 end),
           last_visit_at     = now(),
           updated_at        = now()
     where id = v_card.id;

  elsif v_campaign.type = 'monthly_visits' then
    update public.loyalty_cards
       set current_stamps    = case when v_reward_earned then 0 else v_effective_stamps + 1 end,
           total_stamps_ever = total_stamps_ever + 1,
           times_completed   = times_completed + (case when v_reward_earned then 1 else 0 end),
           last_visit_at     = now(),
           updated_at        = now()
     where id = v_card.id;

  elsif v_campaign.type = 'referral' then
    update public.loyalty_cards
       set total_stamps_ever = total_stamps_ever + 1,
           times_completed   = times_completed + 1,
           last_visit_at     = now(),
           updated_at        = now()
     where id = v_card.id;

  else -- birthday, cashback, otros
    update public.loyalty_cards
       set total_stamps_ever = total_stamps_ever + 1,
           last_visit_at     = now(),
           updated_at        = now()
     where id = v_card.id;
  end if;

  -- ── Crear premio si se ganó ───────────────────────────────────────
  if v_reward_earned then
    insert into public.rewards
      (customer_id, campaign_id, loyalty_card_id, business_id,
       description, status, expires_at)
    values
      (p_customer_id, p_campaign_id, v_card.id, v_campaign.business_id,
       v_campaign.reward_description, 'pending',
       now() + interval '90 days')
    returning id into v_reward_id;
  end if;

  return jsonb_build_object(
    'success',       true,
    'stamp_id',      v_stamp_id,
    'card_id',       v_card.id,
    'reward_earned', v_reward_earned,
    'reward_id',     v_reward_id
  );
end;
$$;

revoke all on function public.add_stamp(uuid, uuid, uuid, numeric, text) from public;
grant execute on function public.add_stamp(uuid, uuid, uuid, numeric, text) to authenticated;
