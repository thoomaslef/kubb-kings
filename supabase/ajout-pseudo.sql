-- AJOUT DU PSEUDO CHOISI — a coller dans Supabase : SQL Editor -> New query -> Run.
-- Sans danger a relancer. Ne touche a rien d'existant : il ajoute une colonne et deux fonctions.
-- (Equivalent a relancer tout supabase/comptes.sql, en plus court.)

alter table public.profiles add column if not exists pseudo_changed_at timestamptz;

-- ---------------------------------------------------------------------------------------------
-- Pseudo choisi par le joueur. Memes regles que src/game/account/pseudo.ts (le serveur fait foi, le
-- client ne fait que repondre plus vite) : si l'un change, l'autre doit changer.
-- C'est du texte LIBRE affiche publiquement au classement : le filtre est une premiere barriere,
-- pas une moderation complete (cf. mentions legales : un pseudo peut etre reinitialise sur demande).
-- ---------------------------------------------------------------------------------------------
create or replace function public.pseudo_is_allowed(p text)
returns boolean
language plpgsql
immutable
as $$
declare
  brut      text := translate(lower(p), 'àâäáãåçéèêëíìîïñóòôöõúùûüýÿ', 'aaaaaaceeeeiiiinooooouuuuyy');
  lettres   text := regexp_replace(translate(brut, '01!345$@7', 'oiieassat'), '[^a-z]', '', 'g');
  mots      text[] := array_append(array_remove(regexp_split_to_array(brut, '[^a-z]+'), ''), lettres);
  dedans    text[] := array['connard','connasse','salope','salaud','putain','encule','enculer','merde','niquer','pedophile',
                            'pedocriminel','violeur','hitler','negre','nigger','nigga','bougnoule','youpin','faggot','bitch',
                            'whore','bastard','asshole','dickhead','fuck','shit','terroriste','porn','couille','branleur',
                            'tagueule','suicide'];
  entiers   text[] := array['pute','pd','fdp','ntm','tg','cul','sex','sexe','nique','con','ass','dick','cock','cunt','slut',
                            'pedo','nazi','kkk','bite',
                            'admin','administrateur','moderateur','moderator','support','kubbkings','kubbking'];
  w text;
begin
  foreach w in array dedans loop
    if position(w in lettres) > 0 then return false; end if;
  end loop;
  return not (mots && entiers);
end;
$$;

-- Renvoie {"ok": true, "pseudo": "..."} ou {"ok": false, "error": "too-short|too-long|chars|forbidden|taken|too-soon|not-ready"}.
create or replace function public.set_pseudo(p_pseudo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v text := btrim(coalesce(p_pseudo, ''));
  dernier timestamptz;
  existe boolean;
begin
  if uid is null then
    raise exception 'non connecte';
  end if;
  if char_length(v) < 3 then return jsonb_build_object('ok', false, 'error', 'too-short'); end if;
  if char_length(v) > 16 then return jsonb_build_object('ok', false, 'error', 'too-long'); end if;
  if v !~ '^[A-Za-z0-9_À-ÖØ-öø-ÿ-]+$' then return jsonb_build_object('ok', false, 'error', 'chars'); end if;
  if not public.pseudo_is_allowed(v) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;

  select pseudo_changed_at, true into dernier, existe from public.profiles where user_id = uid for update;
  -- Pas encore de profil en ligne (la premiere synchronisation n'a pas eu lieu) : le client reessaiera.
  if existe is null then return jsonb_build_object('ok', false, 'error', 'not-ready'); end if;

  -- Meme pseudo (casse pres) : on accepte sans delai, ni conflit avec soi-meme.
  if exists (select 1 from public.profiles where user_id = uid and lower(pseudo) = lower(v)) then
    update public.profiles set pseudo = v where user_id = uid;
    return jsonb_build_object('ok', true, 'pseudo', v);
  end if;

  -- Un changement toutes les 5 minutes au plus : la premiere fois (pseudo_changed_at vide) est libre.
  if dernier is not null and now() - dernier < interval '5 minutes' then
    return jsonb_build_object('ok', false, 'error', 'too-soon');
  end if;

  begin
    update public.profiles set pseudo = v, pseudo_changed_at = now() where user_id = uid;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'taken');
  end;
  return jsonb_build_object('ok', true, 'pseudo', v);
end;
$$;

revoke all on function public.pseudo_is_allowed(text) from public, anon, authenticated;
revoke all on function public.set_pseudo(text) from public, anon;
grant execute on function public.set_pseudo(text) to authenticated;
