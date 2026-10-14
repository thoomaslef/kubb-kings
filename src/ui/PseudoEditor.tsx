import { useEffect, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { changeMyPseudo, fetchStanding, rerollMyPseudo } from '../game/account/sync';
import { PSEUDO_MAX, PSEUDO_MIN } from '../game/account/pseudo';
import { useT } from '../i18n/useT';

/**
 * Mon pseudo : voir, choisir, ou tirer au hasard. Les regles sont celles de
 * `game/account/pseudo.ts` (reponse immediate) ; le serveur applique les memes et fait foi.
 * Sans compte, il n'y a pas de pseudo : on invite a se connecter.
 */
export function PseudoEditor({ onChanged, showRandom = true }: { onChanged?: () => void; showRandom?: boolean }) {
  const t = useT();
  const account = useGameStore((s) => s.account);
  const setScreen = useGameStore((s) => s.setScreen);
  const [current, setCurrent] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const signedIn = account.status === 'signedIn';

  useEffect(() => {
    if (!signedIn) {
      setCurrent(null);
      return;
    }
    let cancelled = false;
    void fetchStanding().then((s) => {
      if (!cancelled) setCurrent(s?.pseudo ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  if (!signedIn) {
    return (
      <div className="pseudo-editor" data-testid="pseudo-editor">
        <p className="footnote">{t('pseudo.signIn')}</p>
        <button type="button" className="btn btn--ghost" onClick={() => setScreen('account')}>
          {t('menu.account.signedOut')}
        </button>
      </div>
    );
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setBusy(true);
    const outcome = await changeMyPseudo(draft);
    setBusy(false);
    if (outcome.ok) {
      setCurrent(outcome.pseudo);
      setDraft('');
      setMessage({ ok: true, text: t('pseudo.saved', { pseudo: outcome.pseudo }) });
      onChanged?.();
    } else {
      setMessage({ ok: false, text: t(`pseudo.error.${outcome.error}`, { min: PSEUDO_MIN, max: PSEUDO_MAX }) });
    }
  };

  const random = async () => {
    setMessage(null);
    setBusy(true);
    const pseudo = await rerollMyPseudo();
    setBusy(false);
    if (pseudo) {
      setCurrent(pseudo);
      setMessage({ ok: true, text: t('pseudo.saved', { pseudo }) });
      onChanged?.();
    } else {
      setMessage({ ok: false, text: t('pseudo.error.network') });
    }
  };

  return (
    <form className="pseudo-editor" data-testid="pseudo-editor" onSubmit={save}>
      <p className="panel__text">
        {t('pseudo.current')} <strong data-testid="pseudo-current">{current ?? '—'}</strong>
      </p>
      <input
        className="input"
        value={draft}
        maxLength={PSEUDO_MAX}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={t('pseudo.placeholder', { min: PSEUDO_MIN, max: PSEUDO_MAX })}
        aria-label={t('pseudo.placeholder', { min: PSEUDO_MIN, max: PSEUDO_MAX })}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        data-testid="pseudo-input"
      />
      <div className="button-column">
        <button type="submit" className="btn" disabled={busy || draft.trim().length === 0}>
          {t('pseudo.save')}
        </button>
        {showRandom && (
          <button type="button" className="btn btn--ghost" onClick={random} disabled={busy}>
            {t('pseudo.random')}
          </button>
        )}
      </div>
      {message && (
        <p className="footnote" role={message.ok ? 'status' : 'alert'} data-testid="pseudo-message">
          {message.text}
        </p>
      )}
      <p className="footnote">{t('pseudo.rules', { min: PSEUDO_MIN, max: PSEUDO_MAX })}</p>
    </form>
  );
}
