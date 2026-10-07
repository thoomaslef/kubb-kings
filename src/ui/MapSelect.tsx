import { useGameStore } from '../store/useGameStore';
import { bridge } from '../game/GameBridge';
import { FIELD_PRESETS, type FieldPresetId } from '../game/rules';
import { levelFromXp } from '../game/progression';
import { isShopRefOwned, SHOP_ITEMS } from '../game/shop';
import { useT } from '../i18n/useT';
import { FieldPreview } from './FieldPreview';

/**
 * Choix du terrain, intercale entre le menu et le depart de la partie.
 *
 * Avant, le terrain se reglait dans une liste du menu, noyee parmi huit
 * autres reglages, et sans rien montrer de ce qu'on choisissait. C'est
 * pourtant la decision qui change le plus une partie — obstacles, friction,
 * rebond. Elle a donc son ecran, avec un plan de chaque terrain.
 *
 * Le mode Defi n'y passe pas : il impose ses terrains manche par manche
 * (roguelite.ts::LADDER).
 */
export function MapSelect() {
  const t = useT();
  const setScreen = useGameStore((s) => s.setScreen);
  const intent = useGameStore((s) => s.mapIntent);
  const fieldPreset = useGameStore((s) => s.fieldPreset);
  const setFieldPreset = useGameStore((s) => s.setFieldPreset);
  const setMode = useGameStore((s) => s.setMode);
  const ownedItems = useGameStore((s) => s.ownedItems);
  const progression = useGameStore((s) => s.progression);
  const level = levelFromXp(progression.totalXp).level;

  const presets = Object.keys(FIELD_PRESETS) as FieldPresetId[];
  const estPossede = (id: FieldPresetId) => isShopRefOwned('terrain', id, ownedItems);

  /** Niveau requis pour un terrain encore verrouille, pour l'afficher. */
  const niveauRequis = (id: FieldPresetId) =>
    SHOP_ITEMS.find((it) => it.category === 'terrain' && it.refId === id)?.minLevel;

  // Un retour au menu alors qu'un terrain verrouille serait selectionne
  // lancerait une partie sur un terrain non possede : la selection est donc
  // toujours ramenee sur un terrain valide au moment de jouer.
  const valide = estPossede(fieldPreset) ? fieldPreset : presets.find(estPossede) ?? 'classique';

  const lancer = () => {
    setFieldPreset(valide);
    if (intent === 'online') {
      // Le salon prive : jamais la recherche classee (qui passe par l'ecran des rangs).
      useGameStore.getState().setRankedLobby(false);
      setScreen('online');
      return;
    }
    if (intent === 'tournament') {
      setScreen('tournament-setup');
      return;
    }
    setMode(intent ?? 'solo');
    bridge.send('start-match');
  };

  /** Le libelle du bouton dit ce qui va REELLEMENT se passer ensuite. */
  const libelleAction =
    intent === 'online' ? t('map.continueOnline') : intent === 'tournament' ? t('map.continueTournament') : t('map.play');

  return (
    <div className="overlay overlay--solid">
      <div className="panel panel--scroll panel--sticky-actions">
        <h2 className="panel__title">{t('map.title')}</h2>
        <p className="panel__text">{t('map.intro')}</p>

        <div className="map-grid" role="radiogroup" aria-label={t('map.title')}>
          {presets.map((id) => {
            const possede = estPossede(id);
            const requis = niveauRequis(id);
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={id === valide}
                disabled={!possede}
                className={`map-card${id === valide ? ' map-card--on' : ''}${possede ? '' : ' map-card--locked'}`}
                onClick={() => setFieldPreset(id)}
              >
                <FieldPreview id={id} />
                <span className="map-card__name">{t(`terrain.${id}.label`)}</span>
                {!possede && requis !== undefined && (
                  <span className="map-card__lock">{t('map.lockedAtLevel', { level: requis })}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* L'indice et l'action restent sous les yeux pendant qu'on fait
            defiler la grille : place en bas de flux, l'indice du terrain
            choisi n'etait visible qu'apres avoir scrolle jusqu'en bas,
            c'est-a-dire jamais au moment ou il sert. */}
        <div className="map-actions">
          <p className="panel__text map-hint">{t(`terrain.${valide}.hint`)}</p>
          {/* Toujours affiche : c'est la lecture des "Niveau N" sur les cartes
              verrouillees qui en depend. `levelFromXp` commence a 1, une garde
              `level > 0` n'aurait jamais rien filtre. */}
          <p className="footnote footnote--tight map-hint">{t('map.yourLevel', { level })}</p>
          <div className="button-column">
            <button className="btn btn--primary" onClick={lancer}>
              {libelleAction}
            </button>
            <button className="btn" onClick={() => setScreen('menu')}>
              {t('map.back')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
