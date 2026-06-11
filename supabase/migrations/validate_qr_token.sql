-- =========================================================================
-- Function: validate_qr_token
-- Permite a un negocio validar el token QR de un cliente sin necesidad de
-- exponer la tabla customer_qr_tokens vía RLS al rol business.
--
-- Devuelve un objeto JSON:
--   { success: true, customer_id, profile }
--   { success: false, error: 'unauthorized' | 'not_found' | 'used' | 'expired' }
-- =========================================================================

create or replace function public.validate_qr_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.customer_qr_tokens%rowtype;
  v_profile public.profiles%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'unauthorized');
  end if;

  select * into v_row
  from public.customer_qr_tokens
  where token = p_token;

  if not found then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;

  if v_row.used then
    return jsonb_build_object('success', false, 'error', 'used');
  end if;

  if v_row.expires_at < now() then
    return jsonb_build_object('success', false, 'error', 'expired');
  end if;

  select * into v_profile
  from public.profiles
  where id = v_row.customer_id;

  return jsonb_build_object(
    'success', true,
    'customer_id', v_row.customer_id,
    'profile', to_jsonb(v_profile)
  );
end;
$$;

revoke all on function public.validate_qr_token(text) from public;
grant execute on function public.validate_qr_token(text) to authenticated;

-- =========================================================================
-- Function: consume_qr_token
-- Marca un token como usado. La llama el negocio tras añadir el sello.
-- Devuelve { success: true } o { success: false, error: ... }
-- =========================================================================

create or replace function public.consume_qr_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'unauthorized');
  end if;

  update public.customer_qr_tokens
     set used = true
   where token = p_token
     and used = false;

  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    return jsonb_build_object('success', false, 'error', 'not_found_or_already_used');
  end if;

  return jsonb_build_object('success', true);
end;
$$;

revoke all on function public.consume_qr_token(text) from public;
grant execute on function public.consume_qr_token(text) to authenticated;
