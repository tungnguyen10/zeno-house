-- Read-only catalog checks; no tenant, contract, invoice or Auth row is modified.
begin;
do $$
declare
  v_table text;
  v_role text;
  v_column text;
begin
  foreach v_table in array array['contracts', 'contract_occupants', 'invoices'] loop
    foreach v_role in array array['anon', 'authenticated'] loop
      if pg_catalog.has_table_privilege(v_role, 'public.' || v_table, 'select') then
        raise exception 'Unexpected table SELECT for % on %', v_role, v_table;
      end if;
      for v_column in select attname from pg_catalog.pg_attribute
        where attrelid = pg_catalog.to_regclass('public.' || v_table)
          and attnum > 0 and not attisdropped loop
        if pg_catalog.has_column_privilege(v_role, 'public.' || v_table, v_column, 'select') then
          raise exception 'Unexpected column SELECT for % on %.%', v_role, v_table, v_column;
        end if;
      end loop;
    end loop;
    if not pg_catalog.has_table_privilege('service_role', 'public.' || v_table, 'select') then
      raise exception 'Server read missing for %', v_table;
    end if;
    if not (select relrowsecurity from pg_catalog.pg_class where oid = pg_catalog.to_regclass('public.' || v_table)) then
      raise exception 'RLS disabled on %', v_table;
    end if;
  end loop;

  foreach v_role in array array['anon', 'authenticated'] loop
    if pg_catalog.has_table_privilege(v_role, 'public.support_requests', 'insert,update,delete') then
      raise exception 'Unexpected direct support write for %', v_role;
    end if;
    for v_column in select attname from pg_catalog.pg_attribute
      where attrelid = 'public.support_requests'::regclass and attnum > 0 and not attisdropped loop
      if pg_catalog.has_column_privilege(v_role, 'public.support_requests', v_column, 'insert,update') then
        raise exception 'Unexpected support column write for % on %', v_role, v_column;
      end if;
    end loop;
  end loop;
  if not pg_catalog.has_table_privilege('service_role', 'public.support_requests', 'insert') then
    raise exception 'Server support insert missing';
  end if;
end;
$$;
rollback;
