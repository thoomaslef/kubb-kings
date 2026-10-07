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
--   * `delete_my_account` : suppression du compte et de ses donnees (RGPD) ;
--   * le CLASSEMENT des parties classees : pseudo genere, rang extrait du profil,
--     `get_leaderboard` (lisible sans compte), `my_standing`, `reroll_pseudo`,
--     `set_leaderboard_visible`. Relancer ce fichier met a jour une base deja installee.

create table if not exists public.profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  revision   integer not null default 0,
  updated_at timestamptz not null default now(),
  -- Un compte ne peut pas gonfler la base : 20 Ko au maximum (un profil en fait ~2).
  constraint profiles_data_size check (pg_column_size(data) < 20000)
);

-- Classement des parties classees (ajoute apres coup : sans danger sur une table deja creee).
-- Le pseudo est GENERE par le serveur (jamais un texte saisi par le joueur : pas de moderation a faire,
-- pas de nom injurieux). Les colonnes rank_* sont tirees du profil par save_profile.
alter table public.profiles add column if not exists pseudo text;
alter table public.profiles add column if not exists show_in_leaderboard boolean not null default true;
alter table public.profiles add column if not exists rank_index  integer not null default 0;
alter table public.profiles add column if not exists rank_peak   integer not null default 0;
alter table public.profiles add column if not exists rank_wins   integer not null default 0;
alter table public.profiles add column if not exists rank_losses integer not null default 0;
create unique index if not exists profiles_pseudo_key on public.profiles (lower(pseudo));

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

-- Pseudo aleatoire du type « RapideViking42 », unique (insensible a la casse).
create or replace function public.generate_pseudo()
returns text
language plpgsql
volatile
as $$
declare
  adjectifs text[] := array['Rapide','Malin','Fougueux','Ruse','Costaud','Agile','Brave','Zen','Vif','Solide','Habile','Fute'];
  noms      text[] := array['Kubb','Baton','Roi','Viking','Renard','Loup','Ours','Aigle','Cerf','Corbeau'];
  candidat  text;
  essais    integer := 0;
begin
  loop
    candidat := adjectifs[1 + floor(random() * array_length(adjectifs, 1))::int]
             || noms[1 + floor(random() * array_length(noms, 1))::int]
             || (10 + floor(random() * (case when essais < 20 then 90 else 9990 end))::int)::text;
    exit when not exists (select 1 from public.profiles where lower(pseudo) = lower(candidat));
    essais := essais + 1;
    exit when essais > 200;
  end loop;
  return candidat;
end;
$$;

-- Renvoie la nouvelle revision, ou -1 si la revision attendue n'est plus la
-- bonne (un autre appareil a ecrit entre-temps : le client relit et fusionne).
--
-- Extrait aussi le rang du profil pour le classement, avec une COHERENCE MINIMALE :
-- on ne peut pas etre a la marche N sans avoir au moins N victoires, ni avoir un
-- meilleur rang inferieur au rang actuel. Ce n'est PAS une preuve — un joueur qui
-- falsifie ses victoires passe ce controle — mais un rang absurde (Master 3 avec 0
-- victoire, ou ecrit d'un coup depuis un compte neuf) est refuse du classement.
create or replace function public.save_profile(p_data jsonb, p_expected_revision integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  current_rev integer;
  r_index integer := 0;
  r_peak integer := 0;
  r_wins integer := 0;
  r_losses integer := 0;
  r_ok boolean := false;
begin
  if uid is null then
    raise exception 'non connecte';
  end if;

  begin
    r_index  := least(17, greatest(0, coalesce((p_data->'rank'->>'index')::integer, 0)));
    r_peak   := least(17, greatest(0, coalesce((p_data->'rank'->>'peak')::integer, 0)));
    r_wins   := least(1000000, greatest(0, coalesce((p_data->'rank'->>'wins')::integer, 0)));
    r_losses := least(1000000, greatest(0, coalesce((p_data->'rank'->>'losses')::integer, 0)));
    r_ok := r_index <= r_wins and r_peak <= r_wins and r_peak >= r_index;
  exception when others then
    r_ok := false;
  end;

  select revision into current_rev from public.profiles where user_id = uid for update;

  if not found then
    if p_expected_revision <> 0 then
      return -1;
    end if;
    insert into public.profiles (user_id, data, revision, pseudo, rank_index, rank_peak, rank_wins, rank_losses)
    values (uid, p_data, 1, public.generate_pseudo(),
            case when r_ok then r_index else 0 end, case when r_ok then r_peak else 0 end,
            case when r_ok then r_wins else 0 end, case when r_ok then r_losses else 0 end);
    return 1;
  end if;

  if current_rev <> p_expected_revision then
    return -1;
  end if;

  update public.profiles
     set data = p_data, revision = current_rev + 1, updated_at = now(),
         pseudo = coalesce(pseudo, public.generate_pseudo()),
         rank_index  = case when r_ok then r_index  else rank_index  end,
         rank_peak   = case when r_ok then r_peak   else rank_peak   end,
         rank_wins   = case when r_ok then r_wins   else rank_wins   end,
         rank_losses = case when r_ok then r_losses else rank_losses end
   where user_id = uid;
  return current_rev + 1;
end;
$$;

-- Le classement : les meilleurs rangs, du plus haut au plus bas (puis meilleur rang atteint, puis
-- victoires). Lisible SANS compte. N'expose que le pseudo genere, le rang et le bilan — jamais l'e-mail.
create or replace function public.get_leaderboard(p_limit integer default 20)
returns table (place bigint, pseudo text, rank_index integer, rank_peak integer, wins integer, losses integer, is_me boolean)
language sql
stable
security definer
set search_path = public
as $$
  select row_number() over (order by p.rank_index desc, p.rank_peak desc, p.rank_wins desc, p.user_id) as place,
         p.pseudo, p.rank_index, p.rank_peak, p.rank_wins, p.rank_losses, (p.user_id = auth.uid()) as is_me
    from public.profiles p
   where p.show_in_leaderboard and p.pseudo is not null and (p.rank_wins + p.rank_losses) > 0
   order by place
   limit least(greatest(p_limit, 1), 100);
$$;

-- Ma place : mon pseudo, si j'apparais, ma place et le nombre de joueurs classes.
create or replace function public.my_standing()
returns table (pseudo text, visible boolean, place bigint, total bigint)
language sql
stable
security definer
set search_path = public
as $$
  with classes as (
    select p.user_id,
           row_number() over (order by p.rank_index desc, p.rank_peak desc, p.rank_wins desc, p.user_id) as place
      from public.profiles p
     where p.show_in_leaderboard and p.pseudo is not null and (p.rank_wins + p.rank_losses) > 0
  )
  select me.pseudo, me.show_in_leaderboard,
         (select c.place from classes c where c.user_id = me.user_id),
         (select count(*) from classes)
    from public.profiles me
   where me.user_id = auth.uid();
$$;

-- Nouveau pseudo genere (le joueur ne saisit rien).
create or replace function public.reroll_pseudo()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare nouveau text;
begin
  if auth.uid() is null then
    raise exception 'non connecte';
  end if;
  nouveau := public.generate_pseudo();
  update public.profiles set pseudo = nouveau where user_id = auth.uid();
  return nouveau;
end;
$$;

create or replace function public.set_leaderboard_visible(p_visible boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'non connecte';
  end if;
  update public.profiles set show_in_leaderboard = p_visible where user_id = auth.uid();
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
revoke all on function public.generate_pseudo() from public, anon, authenticated;
revoke all on function public.get_leaderboard(integer) from public;
revoke all on function public.my_standing() from public, anon;
revoke all on function public.reroll_pseudo() from public, anon;
revoke all on function public.set_leaderboard_visible(boolean) from public, anon;
grant execute on function public.load_profile() to authenticated;
grant execute on function public.save_profile(jsonb, integer) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
-- Le classement se lit sans compte ; le reste demande d'etre connecte.
grant execute on function public.get_leaderboard(integer) to anon, authenticated;
grant execute on function public.my_standing() to authenticated;
grant execute on function public.reroll_pseudo() to authenticated;
grant execute on function public.set_leaderboard_visible(boolean) to authenticated;
