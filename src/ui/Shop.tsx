import { useGameStore } from '../store/useGameStore';
import { SHOP_ITEMS, type ShopCategory, type ShopItem } from '../game/shop';
import { BATONS, type BatonId } from '../game/batons';
import { useT } from '../i18n/useT';

const CATEGORIES: ShopCategory[] = ['skin', 'trail', 'baton'];

/** "★★★☆☆" pour n etoiles sur 5. */
function stars(n: number): string {
  return '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n));
}

/** Cle i18n de l'article : skin.<id>/effect.<id>/baton.<id> selon la categorie. */
function labelKey(item: ShopItem): string {
  const ns = item.category === 'trail' ? 'effect' : item.category;
  return `${ns}.${item.refId}.label`;
}

function hintKey(item: ShopItem): string | null {
  return item.category === 'baton' ? null : `${item.category === 'trail' ? 'effect' : item.category}.${item.refId}.hint`;
}

/** Boutique : achat des articles cosmetiques/joueur avec les pieces gagnees en match. */
export function Shop() {
  const t = useT();
  const setScreen = useGameStore((s) => s.setScreen);
  const coins = useGameStore((s) => s.coins);
  const ownedItems = useGameStore((s) => s.ownedItems);
  const purchaseItem = useGameStore((s) => s.purchaseItem);

  return (
    <div className="overlay overlay--solid">
      <div className="panel panel--scroll">
        <h2 className="panel__title">{t('shop.title')}</h2>
        <p className="panel__text">{t('shop.intro')}</p>
        <p className="shop-balance">{t('shop.balance', { n: coins })}</p>

        {CATEGORIES.map((category) => {
          const items = SHOP_ITEMS.filter((item) => item.category === category);
          if (items.length === 0) return null;
          return (
            <div key={category} className="shop-section">
              <h3 className="shop-section__title">{t(`shop.category.${category}`)}</h3>
              <div className="shop-list">
                {items.map((item) => {
                  const owned = ownedItems.includes(item.id);
                  const affordable = coins >= item.price;
                  const hint = hintKey(item);
                  return (
                    <div key={item.id} className={`shop-item${owned ? ' shop-item--owned' : ''}`}>
                      <div className="shop-item__body">
                        <span className="shop-item__label">{t(labelKey(item))}</span>
                        {hint && <span className="shop-item__hint">{t(hint)}</span>}
                        {item.category === 'baton' && (
                          <span className="shop-item__hint">
                            {t('baton.statPower')} {stars(BATONS[item.refId as BatonId].power)} ·{' '}
                            {t('baton.statPrecision')} {stars(BATONS[item.refId as BatonId].precision)} ·{' '}
                            {t('baton.statControl')} {stars(BATONS[item.refId as BatonId].control)}
                          </span>
                        )}
                      </div>
                      {owned ? (
                        <span className="shop-item__owned">{t('shop.owned')}</span>
                      ) : (
                        <button
                          className="btn btn--primary shop-item__buy"
                          disabled={!affordable}
                          onClick={() => purchaseItem(item.id)}
                        >
                          {t('shop.buy', { price: item.price })}
                        </button>
                      )}
                      {!owned && !affordable && <span className="shop-item__locked">{t('shop.cantAfford')}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="button-column" style={{ marginTop: 20 }}>
          <button className="btn btn--ghost" onClick={() => setScreen('menu')}>
            {t('shop.back')}
          </button>
        </div>
      </div>
    </div>
  );
}
