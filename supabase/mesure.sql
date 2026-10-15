-- Mesure d'usage ANONYME de KUBB: Kings — a executer UNE FOIS dans Supabase (SQL Editor -> New query -> Run).
-- Sans danger a relancer. Declaree dans les pages legales (politique de confidentialite).
--
-- Ce qui est mesure (rien d'autre) : un identifiant ALEATOIRE par appareil (genere par le jeu, sans lien avec un compte,
-- un e-mail ou un pseudo), et des evenements : session_start, match_start, match_end, match_abandon, search, avec le
-- mode de jeu (solo, local, 2v2, defi, ami, classee, bot), l'issue (victoire / defaite / nul) et une duree en secondes.
-- Aucune adresse IP n'est enregistree, aucun texte libre. Le joueur peut couper la mesure dans Options.
--
-- Qui lit quoi : la table est FERMEE a l'API (RLS sans regle) ; seule la fonction `track_usage` peut y ecrire. Les
-- chiffres se lisent dans ce tableau de bord, via les vues du schema `stats` (ci-dessous), jamais exposees a l'API.

create table if not exists public.usage_events (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  anon_id     uuid not null,
  name        text not null check (name in ('session_start', 'match_start', 'match_end', 'match_abandon', 'search')),
  mode        text check (mode in ('solo', 'local', '2v2', 'defi', 'friend', 'ranked', 'bot')),
  result      text check (result in ('win', 'loss', 'draw', 'matched', 'bot', 'cancelled')),
  seconds     integer check (seconds >= 0 and seconds <= 86400),
  app_version text check (char_length(app_version) <= 20)
);
create index if not exists usage_events_day_idx on public.usage_events (created_at);
create index if not exists usage_events_anon_idx on public.usage_events (anon_id, created_at);
alter table public.usage_events enable row level security;
-- Volontairement AUCUNE regle : ni lecture ni ecriture directes.

-- Au plus 20 evenements par appel et 400 par appareil et par jour ; tout ce qui sort de la liste est ignore.
-- Renvoie le nombre d'evenements enregistres.
create or replace function public.track_usage(p_anon uuid, p_events jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  e jsonb;
  n integer := 0;
  deja integer;
begin
  if p_anon is null or p_events is null or jsonb_typeof(p_events) <> 'array' then
    return 0;
  end if;
  select count(*) into deja from public.usage_events where anon_id = p_anon and created_at > now() - interval '24 hours';
  if deja >= 400 then
    return 0;
  end if;
  for e in select * from jsonb_array_elements(p_events) limit 20 loop
    continue when jsonb_typeof(e) <> 'object';
    continue when coalesce(e->>'name', '') not in ('session_start', 'match_start', 'match_end', 'match_abandon', 'search');
    insert into public.usage_events (anon_id, name, mode, result, seconds, app_version)
    values (
      p_anon,
      e->>'name',
      case when (e->>'mode') in ('solo', 'local', '2v2', 'defi', 'friend', 'ranked', 'bot') then e->>'mode' end,
      case when (e->>'result') in ('win', 'loss', 'draw', 'matched', 'bot', 'cancelled') then e->>'result' end,
      case when (e->>'seconds') ~ '^[0-9]{1,5}$' and (e->>'seconds')::integer <= 86400 then (e->>'seconds')::integer end,
      left(e->>'version', 20)
    );
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function public.track_usage(uuid, jsonb) from public;
grant execute on function public.track_usage(uuid, jsonb) to anon, authenticated;

-- Conservation limitee : 13 mois (l'identifiant aleatoire n'a aucune utilite au-dela). A lancer de temps en temps
-- (ou a planifier si l'extension pg_cron est activee) : select public.purge_usage_events();
create or replace function public.purge_usage_events()
returns integer
language sql
security definer
set search_path = public
as $$
  with supprimes as (delete from public.usage_events where created_at < now() - interval '13 months' returning 1)
  select count(*)::integer from supprimes;
$$;
revoke all on function public.purge_usage_events() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Les chiffres. Schema `stats` : absent de l'API, a lire dans le tableau de bord (Table Editor / SQL Editor).
-- ---------------------------------------------------------------------------------------------
create schema if not exists stats;

-- Par jour : appareils actifs, nouveaux appareils, parties, abandons.
create or replace view stats.par_jour as
with premier as (select anon_id, min(created_at)::date as jour from public.usage_events group by anon_id)
select d.jour,
       d.appareils_actifs,
       coalesce(n.nouveaux, 0) as nouveaux_appareils,
       d.parties_terminees,
       d.parties_abandonnees,
       d.parties_lancees
  from (select created_at::date as jour,
               count(distinct anon_id) as appareils_actifs,
               count(*) filter (where name = 'match_end') as parties_terminees,
               count(*) filter (where name = 'match_abandon') as parties_abandonnees,
               count(*) filter (where name = 'match_start') as parties_lancees
          from public.usage_events group by 1) d
  left join (select jour, count(*) as nouveaux from premier group by jour) n using (jour)
 order by d.jour desc;

-- Parties par mode (terminees / abandonnees), et part d'abandon.
create or replace view stats.par_mode as
select mode,
       count(*) filter (where name = 'match_start') as lancees,
       count(*) filter (where name = 'match_end') as terminees,
       count(*) filter (where name = 'match_abandon') as abandonnees,
       round(100.0 * count(*) filter (where name = 'match_abandon') / nullif(count(*) filter (where name = 'match_start'), 0), 1) as pct_abandon
  from public.usage_events
 where mode is not null
 group by mode
 order by lancees desc;

-- Retention : parmi les appareils vus pour la premiere fois un jour J, part revue J+1 et J+7.
create or replace view stats.retention as
with premier as (select anon_id, min(created_at)::date as jour from public.usage_events group by anon_id),
     vus as (select distinct anon_id, created_at::date as jour from public.usage_events)
select p.jour as cohorte,
       count(*) as appareils,
       count(*) filter (where exists (select 1 from vus v where v.anon_id = p.anon_id and v.jour = p.jour + 1)) as revus_j1,
       count(*) filter (where exists (select 1 from vus v where v.anon_id = p.anon_id and v.jour = p.jour + 7)) as revus_j7,
       round(100.0 * count(*) filter (where exists (select 1 from vus v where v.anon_id = p.anon_id and v.jour = p.jour + 1)) / count(*), 1) as pct_j1,
       round(100.0 * count(*) filter (where exists (select 1 from vus v where v.anon_id = p.anon_id and v.jour = p.jour + 7)) / count(*), 1) as pct_j7
  from premier p
 group by p.jour
 order by p.jour desc;

-- Recherche d'adversaire classee : combien trouvent un joueur, combien finissent contre un bot, combien annulent.
create or replace view stats.recherche as
select result as issue, count(*) as nombre, round(avg(seconds)) as attente_moyenne_s
  from public.usage_events
 where name = 'search'
 group by result;

revoke all on schema stats from public, anon, authenticated;
