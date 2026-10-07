-- Comptes joueurs de KUBB: Kings — a executer UNE FOIS dans Supabase :
--   tableau de bord -> SQL Editor -> New query -> coller ce fichier -> Run.
-- Sans danger a relancer : tout est « create or replace » / « if not exists ».
--
-- Ce que ca cree :
--   * une table `profiles` : une ligne par joueur, sa progression en JSON
--     (XP, pieces, succes, articles, rang...), environ 1 a 3 Ko ;
--   * des regles d'acces : chaque joueur ne LIT que sa propre ligne, et ne
--     peut rien ecrire directement — il passe par `save_profile` ;
--   * `save_profile` : ecriture « optimiste » avec un numero de revision, pour
--     que deux appareils ne s'ecrasent jamais sans le savoir ;
--   * `delete_my_account` : suppression du compte et de ses donnees (RGPD).

create table if not exists public.profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  revision   integer not null default 0,
  updated_at timestamptz not null default now(),
  -- Un compte ne peut pas gonfler la base : 20 Ko au maximum (un profil en fait ~2).
  constraint profiles_data_size check (pg_column_size(data) < 20000)
);

alter table public.profiles enable row level security;

drop policy if exists "lecture de son propre profil" on public.profiles;
create policy "lecture de son propre profil"
  on public.profiles for select
  using (auth.uid() = user_id);
-- Volontairement AUCUNE regle d'insertion, de mise a jour ou de suppression :
-- toute ecriture passe par les fonctions ci-dessous.

create or replace function public.load_profile()
returns table (data jsonb, revision integer)
language sql
stable
security invoker
as $$
  select p.data, p.revision from public.profiles p where p.user_id = auth.uid();
$$;

-- Renvoie la nouvelle revision, ou -1 si la revision attendue n'est plus la
-- bonne (un autre appareil a ecrit entre-temps : le client relit et fusionne).
create or replace function public.save_profile(p_data jsonb, p_expected_revision integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  current_rev integer;
begin
  if uid is null then
    raise exception 'non connecte';
  end if;

  select revision into current_rev from public.profiles where user_id = uid for update;

  if not found then
    if p_expected_revision <> 0 then
      return -1;
    end if;
    insert into public.profiles (user_id, data, revision) values (uid, p_data, 1);
    return 1;
  end if;

  if current_rev <> p_expected_revision then
    return -1;
  end if;

  update public.profiles
     set data = p_data, revision = current_rev + 1, updated_at = now()
   where user_id = uid;
  return current_rev + 1;
end;
$$;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'non connecte';
  end if;
  -- Supprime l'utilisateur ; sa ligne de `profiles` suit (on delete cascade).
  delete from auth.users where id = auth.uid();
end;
$$;

-- Seuls les joueurs CONNECTES appellent ces fonctions (jamais l'anonyme).
revoke all on function public.load_profile() from public, anon;
revoke all on function public.save_profile(jsonb, integer) from public, anon;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.load_profile() to authenticated;
grant execute on function public.save_profile(jsonb, integer) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
