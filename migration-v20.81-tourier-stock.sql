-- v20.81 — table stock tourier (modèle pâtissier). Déjà passée par Phil.
create table if not exists tourier_stock (
  tenant_id text not null, product_id text not null,
  stock numeric not null default 0, mini numeric,
  updated_at timestamptz default now(), updated_by text,
  primary key (tenant_id, product_id)
);
alter table tourier_stock enable row level security;
drop policy if exists tourier_stock_all on tourier_stock;
create policy tourier_stock_all on tourier_stock for all to anon using (true) with check (true);
insert into tourier_stock (tenant_id, product_id, stock, mini)
select p.tenant_id, p.id, 0, p.seuil_stock from products p
where p.category in ('viennoiserie','brioches_special') and p.actif = true
on conflict (tenant_id, product_id) do nothing;
