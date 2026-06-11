-- =========================================================================
-- Ciclo de vida de campañas (activa / terminada / archivada) + catálogo de
-- puntos canjeables.
--
-- 1) Estados de campaña:
--    - active   : funcionamiento normal.
--    - ended    : "terminada". No se admiten nuevos clientes (no se crean
--                 nuevas loyalty_cards), pero los clientes que ya tienen un
--                 cartón en curso pueden seguir sellando hasta completarlo.
--                 Una vez completado (is_completed = true) ya no se puede usar.
--    - archived : "oculta". Congelada por completo (sin nuevas tarjetas ni
--                 sellos). Se oculta del listado del negocio. Los premios ya
--                 ganados siguen siendo canjeables.
--
-- 2) Catálogo de puntos: cada campaña de tipo "points" puede tener varios
--    artículos canjeables por puntos (reward_catalog_items). El cliente
--    canjea un artículo (redeem_catalog_item), se le descuentan los puntos y
--    se le crea un premio pendiente que canjea con el flujo de QR existente.
-- =========================================================================

-- ─── 1. Columnas de ciclo de vida en campaigns ──────────────────────────
alter table public.campaigns
  add column if not exists status text not null default 'active';

alter table public.campaigns
  add column if not exists ended_at timestamptz;

alter table public.campaigns
  add column if not exists archived_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'campaigns_status_check'
  ) then
    alter table public.campaigns
      add constraint campaigns_status_check
      check (status in ('active', 'ended', 'archived'));
  end if;
end $$;

-- Aseguramos que las campañas existentes quedan como 'active'.
update public.campaigns set status = 'active' where status is null;

-- ─── 2. Función para cambiar el estado de una campaña ───────────────────
-- La llama el NEGOCIO (dueño). Devuelve { success: true } o { success:false }.
create or replace function public.set_campaign_status(p_campaign_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_biz uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'unauthorized');
  end if;

  if p_status not in ('active', 'ended', 'archived') then
    return jsonb_build_object('success', false, 'error', 'invalid_status');
  end if;

  select business_id into v_biz from public.campaigns where id = p_campaign_id;
  if not found then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;

  if not exists (
    select 1 from public.businesses b
    where b.id = v_biz and b.owner_id = auth.uid()
  ) then
    return jsonb_build_object('success', false, 'error', 'unauthorized');
  end if;

  update public.campaigns
     set status      = p_status,
         ended_at    = case
                         when p_status = 'ended'  then coalesce(ended_at, now())
                         when p_status = 'active' then null
                         else ended_at
                       end,
         archived_at = case
                         when p_status = 'archived' then now()
                         when p_status = 'active'   then null
                         else archived_at
                       end,
         -- Al reactivar dejamos is_active a su estado; al terminar/archivar
         -- la marcamos como no activa para que deje de "aceptar todo".
         is_active   = case when p_status = 'active' then is_active else false end,
         updated_at  = now()
   where id = p_campaign_id;

  return jsonb_build_object('success', true);
end;
$$;

revoke all on function public.set_campaign_status(uuid, text) from public;
grant execute on function public.set_campaign_status(uuid, text) to authenticated;

-- ─── 3. Triggers de enforcement del ciclo de vida ───────────────────────
-- Bloquean a nivel de BD la creación de tarjetas/sellos cuando la campaña no
-- lo permite. Se aplican aunque el insert venga de add_stamp (SECURITY
-- DEFINER): los triggers siempre se ejecutan.

-- 3a) No crear nuevas loyalty_cards en campañas terminadas/archivadas.
create or replace function public.tg_block_cards_for_inactive_campaign()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select status into v_status from public.campaigns where id = new.campaign_id;
  if v_status in ('ended', 'archived') then
    raise exception 'campaign_not_accepting_new_cards'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_block_new_cards on public.loyalty_cards;
create trigger trg_block_new_cards
  before insert on public.loyalty_cards
  for each row execute function public.tg_block_cards_for_inactive_campaign();

-- 3b) No sellar en campañas archivadas; en terminadas solo se permite sellar
--     cartones aún no completados (para "rematar el último cartón").
create or replace function public.tg_block_stamps_for_inactive_campaign()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status    text;
  v_completed boolean;
begin
  select status into v_status from public.campaigns where id = new.campaign_id;

  if v_status = 'archived' then
    raise exception 'campaign_archived' using errcode = 'P0001';
  end if;

  if v_status = 'ended' then
    select is_completed into v_completed
      from public.loyalty_cards where id = new.loyalty_card_id;
    if coalesce(v_completed, false) then
      raise exception 'campaign_ended_card_completed' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_block_stamps on public.stamps;
create trigger trg_block_stamps
  before insert on public.stamps
  for each row execute function public.tg_block_stamps_for_inactive_campaign();

-- ─── 4. Catálogo de puntos ──────────────────────────────────────────────
create table if not exists public.reward_catalog_items (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id)  on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  name        text not null,
  description text,
  points_cost integer not null check (points_cost > 0),
  image_url   text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists idx_catalog_items_campaign on public.reward_catalog_items(campaign_id);
create index if not exists idx_catalog_items_business on public.reward_catalog_items(business_id);

alter table public.reward_catalog_items enable row level security;

-- El dueño del negocio gestiona (CRUD) sus artículos.
drop policy if exists "catalog_owner_all" on public.reward_catalog_items;
create policy "catalog_owner_all" on public.reward_catalog_items
  for all to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = reward_catalog_items.business_id and b.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = reward_catalog_items.business_id and b.owner_id = auth.uid()
    )
  );

-- Cualquier usuario autenticado puede leer los artículos activos (catálogo).
drop policy if exists "catalog_client_read" on public.reward_catalog_items;
create policy "catalog_client_read" on public.reward_catalog_items
  for select to authenticated
  using (is_active = true);

-- ─── 5. Canje de un artículo del catálogo por puntos ────────────────────
-- La llama el CLIENTE. Descuenta puntos de su tarjeta y crea un premio
-- pendiente (que luego canjea con el QR de recompensa existente).
create or replace function public.redeem_catalog_item(p_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item     public.reward_catalog_items%rowtype;
  v_campaign public.campaigns%rowtype;
  v_card     public.loyalty_cards%rowtype;
  v_reward_id uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'unauthorized');
  end if;

  select * into v_item from public.reward_catalog_items where id = p_item_id for update;
  if not found then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;
  if not v_item.is_active then
    return jsonb_build_object('success', false, 'error', 'inactive');
  end if;

  select * into v_campaign from public.campaigns where id = v_item.campaign_id;
  if not found then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;
  if v_campaign.status = 'archived' then
    return jsonb_build_object('success', false, 'error', 'campaign_archived');
  end if;

  select * into v_card
    from public.loyalty_cards
   where customer_id = auth.uid() and campaign_id = v_item.campaign_id
   for update;
  if not found then
    return jsonb_build_object('success', false, 'error', 'no_card');
  end if;

  if v_card.current_points < v_item.points_cost then
    return jsonb_build_object('success', false, 'error', 'insufficient_points');
  end if;

  update public.loyalty_cards
     set current_points = current_points - v_item.points_cost,
         updated_at = now()
   where id = v_card.id;

  insert into public.rewards
    (customer_id, campaign_id, loyalty_card_id, business_id, description, status, expires_at)
  values
    (auth.uid(), v_item.campaign_id, v_card.id, v_item.business_id, v_item.name, 'pending', now() + interval '30 days')
  returning id into v_reward_id;

  return jsonb_build_object(
    'success', true,
    'reward_id', v_reward_id,
    'points_left', v_card.current_points - v_item.points_cost
  );
end;
$$;

revoke all on function public.redeem_catalog_item(uuid) from public;
grant execute on function public.redeem_catalog_item(uuid) to authenticated;
