import { useGameStore } from '../store/useGameStore';
import { BATON_IDS } from '../game/batons';
import { levelFromXp } from '../game/progression';
import { KUBB_SKINS, KING_SKINS } from '../game/theme';
import { THROW_EFFECT_IDS } from '../game/throwEffects';
import { isShopRefOwned, SHOP_ITEMS, type ShopCategory } from '../game/shop';
import { useT } from '../i18n/useT';

/** Apparence : skins des kubbs, du roi, du baton et effet de lancer (purement cosmetique). */
export function Appearance() {
  const t = useT();
  const setScreen = useGameStore((s) => s.setScreen);
  const kubbSkin = useGameStore((s) => s.kubbSkin);
  const setKubbSkin = useGameStore((s) => s.setKubbSkin);
  const kingSkin = useGameStore((s) => s.kingSkin);
  const setKingSkin = useGameStore((s) => s.setKingSkin);
  const batonId = useGameStore((s) => s.batonId);
  const setBatonId = useGameStore((s) => s.setBatonId);
  const trailEffect = useGameStore((s) => s.trailEffect);
  const setTrailEffect = useGameStore((s) => s.setTrailEffect);
  const ownedItems = useGameStore((s) => s.ownedItems);
  const progression = useGameStore((s) => s.progression);
  const level = levelFromXp(progression.totalXp).level;

  const availableSkins = KUBB_SKINS.filter((skin) => isShopRefOwned('skin', skin, ownedItems));
  const availableKingSkins = KING_SKINS.filter((skin) => isShopRefOwned('king', skin, ownedItems));
  const availableBatons = BATON_IDS.filter((id) => isShopRefOwned('baton', id, ownedItems));
  const availableEffects = THROW_EFFECT_IDS.filter((id) => isShopRefOwned('trail', id, ownedItems));

  // Prochain article de boutique a venir dans cette categorie, pour motiver la progression (le niveau
  // ouvre juste le DROIT d'acheter, cf. shop.ts) — undefined une fois tout debloque.
  const nextInCategory = (category: ShopCategory) =>
    SHOP_ITEMS.filter((it) => it.category === category && it.minLevel > level).sort((a, b) => a.minLevel - b.minLevel)[0];
  const nextBaton = nextInCategory('baton');

  return (
    <div className="overlay overlay--solid">
      <div className="panel">
        <h2 className="panel__title">{t('appearance.title')}</h2>
        <div className="button-column">
          <p className="segmented-label">{t('menu.skinAria')}</p>
          <div className="segmented" role="group" aria-label={t('menu.skinAria')}>
            {availableSkins.map((skin) => (
              <button
                key={skin}
                className={`segmented__item${skin === kubbSkin ? ' segmented__item--on' : ''}`}
                aria-pressed={skin === kubbSkin}
                onClick={() => setKubbSkin(skin)}
              >
                {t(`skin.${skin}.label`)}
              </button>
            ))}
          </div>
          <p className="footnote footnote--tight">{t(`skin.${kubbSkin}.hint`)}</p>

          <p className="segmented-label">{t('menu.kingSkinAria')}</p>
          <div className="segmented" role="group" aria-label={t('menu.kingSkinAria')}>
            {availableKingSkins.map((skin) => (
              <button
                key={skin}
                className={`segmented__item${skin === kingSkin ? ' segmented__item--on' : ''}`}
                aria-pressed={skin === kingSkin}
                onClick={() => setKingSkin(skin)}
              >
                {t(`king.${skin}.label`)}
              </button>
            ))}
          </div>
          <p className="footnote footnote--tight">{t(`king.${kingSkin}.hint`)}</p>

          <p className="segmented-label">{t('menu.batonAria')}</p>
          <div className="segmented" role="group" aria-label={t('menu.batonAria')}>
            {availableBatons.map((id) => (
              <button
                key={id}
                className={`segmented__item${id === batonId ? ' segmented__item--on' : ''}`}
                aria-pressed={id === batonId}
                onClick={() => setBatonId(id)}
              >
                {t(`baton.${id}.label`)}
              </button>
            ))}
          </div>
          <p className="footnote footnote--tight">{t(`baton.${batonId}.hint`)}</p>
          {nextBaton && (
            <p className="footnote footnote--tight footnote--locked">
              {t('menu.nextBatonUnlock', { name: t(`baton.${nextBaton.refId}.label`), level: nextBaton.minLevel })}
            </p>
          )}

          <p className="segmented-label">{t('menu.effectAria')}</p>
          <div className="segmented" role="group" aria-label={t('menu.effectAria')}>
            {availableEffects.map((id) => (
              <button
                key={id}
                className={`segmented__item${id === trailEffect ? ' segmented__item--on' : ''}`}
                aria-pressed={id === trailEffect}
                onClick={() => setTrailEffect(id)}
              >
                {t(`effect.${id}.label`)}
              </button>
            ))}
          </div>
          <p className="footnote footnote--tight">{t(`effect.${trailEffect}.hint`)}</p>

          <button className="btn" onClick={() => setScreen('shop')}>
            {t('menu.shop')}
          </button>
          <button className="btn btn--ghost" onClick={() => setScreen('menu')}>
            {t('hub.back')}
          </button>
        </div>
      </div>
    </div>
  );
}
