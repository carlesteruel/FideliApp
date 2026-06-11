-- =========================================================================
-- Birthday campaign: claim_birthday_reward()
-- Referral: referral_code en profiles + trigger auto-generación
--
-- Flujo cumpleaños:
--   1. El negocio sella al cliente en la campaña birthday → crea loyalty_card
--   2. El cliente llama a claim_birthday_reward() al abrir la app
--   3. Si hoy está dentro de la ventana [cumpleaños ± days_window] y aún no
--      se ha generado premio este año → se crea un reward 'pending'
--   4. El cliente canjea el premio con el QR de canje existente
-- =========================================================================

-- ─── 1. Referral code en profiles ───────────────────────────────────────────
alter table public.profiles
  add column if not exists referral_code text unique;

-- Generar código para perfiles existentes (8 primeros caracteres del UUID sin guiones)
update public.profiles
   set referral_code = upper(left(replace(id::text, '-', ''), 8))
 where referral_code is null;

-- Trigger para auto-generar código en nuevos perfiles
create or replace function public.tg_set_referral_code()
returns trigger
language plpgsql
as $$
begin
  if new.referral_code is null then
    new.referral_code := upper(left(replace(new.id::text, '-', ''), 8));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_referral_code on public.profiles;
create trigger trg_set_referral_code
  before insert on public.profiles
  for each row execute function public.tg_set_referral_code();

-- ─── 2. claim_birthday_reward ────────────────────────────────────────────────
-- Llamada por el CLIENTE al abrir la app (o al entrar en Mis Premios).
-- Recorre todas las loyalty_cards de tipo 'birthday' activas del cliente.
-- Si hoy cae en la ventana del cumpleaños y aún no tiene premio este año,
-- crea un reward 'pending'.
-- Devuelve { success: true, rewards_created: [{campaign_id, reward_id},...] }
create or replace function public.claim_birthday_reward()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id      uuid;
  v_profile          public.profiles%rowtype;
  v_birth_date       date;
  v_anniversary      date;
  v_days_window      integer;
  v_rec              record;
  v_campaign         public.campaigns%rowtype;
  v_config           jsonb;
  v_reward_id        uuid;
  v_rewards_created  jsonb := '[]'::jsonb;
  v_has_reward       boolean;
begin
  v_customer_id := auth.uid();
  if v_customer_id is null then
    return jsonb_build_object('success', false, 'error', 'unauthorized');
  end if;

  -- Obtener perfil
  select * into v_profile from public.profiles where id = v_customer_id;
  if not found or v_profile.birth_date is null then
    -- Sin fecha de nacimiento → no hay premios de cumpleaños
    return jsonb_build_object('success', true, 'rewards_created', v_rewards_created);
  end if;

  v_birth_date := v_profile.birth_date::date;

  -- Recorrer tarjetas de campañas de tipo birthday activas
  for v_rec in
    select lc.id    as card_id,
           lc.campaign_id,
           lc.business_id
      from public.loyalty_cards lc
      join public.campaigns c on c.id = lc.campaign_id
     where lc.customer_id = v_customer_id
       and c.type         = 'birthday'
       and c.status       = 'active'
       and c.is_active    = true
  loop
    select * into v_campaign from public.campaigns where id = v_rec.campaign_id;
    v_config      := to_jsonb(v_campaign.config);
    v_days_window := coalesce((v_config->>'days_window')::integer, 7);

    -- Calcular aniversario de este año (capturando el caso 29-Feb en año no bisiesto)
    begin
      v_anniversary := make_date(
        extract(year from now())::int,
        extract(month from v_birth_date)::int,
        extract(day   from v_birth_date)::int
      );
    exception when others then
      -- 29-Feb → 28-Feb en año no bisiesto
      v_anniversary := make_date(
        extract(year from now())::int,
        extract(month from v_birth_date)::int,
        28
      );
    end;

    -- ¿Estamos dentro de la ventana?
    if now()::date < (v_anniversary - v_days_window)
       or now()::date > (v_anniversary + v_days_window)
    then
      continue;
    end if;

    -- ¿Ya existe un premio de cumpleaños de este año para esta campaña?
    select exists (
      select 1 from public.rewards
       where customer_id = v_customer_id
         and campaign_id = v_rec.campaign_id
         and extract(year from created_at) = extract(year from now())
    ) into v_has_reward;

    if v_has_reward then
      continue;
    end if;

    -- Crear el premio
    insert into public.rewards
      (customer_id, campaign_id, loyalty_card_id, business_id,
       description, status, expires_at)
    values
      (v_customer_id, v_rec.campaign_id, v_rec.card_id, v_rec.business_id,
       v_campaign.reward_description, 'pending',
       (v_anniversary + v_days_window + interval '1 day'))
    returning id into v_reward_id;

    v_rewards_created := v_rewards_created || jsonb_build_object(
      'campaign_id', v_rec.campaign_id,
      'reward_id',   v_reward_id
    );
  end loop;

  return jsonb_build_object(
    'success',         true,
    'rewards_created', v_rewards_created
  );
end;
$$;

revoke all on function public.claim_birthday_reward() from public;
grant execute on function public.claim_birthday_reward() to authenticated;

-- ─── 3. RLS: clientes pueden leer su propio referral_code ────────────────────
-- Los perfiles ya tienen RLS en otro lugar. Solo nos aseguramos de que
-- el campo referral_code sea visible en las queries del cliente.
-- (No se requiere política adicional si profiles ya permite select al propio usuario.)
