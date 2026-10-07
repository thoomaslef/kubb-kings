import { useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import {
  accountAvailable,
  deleteAccount,
  signInAccount,
  signOutAccount,
  signUpAccount,
  type AuthOutcome
} from '../game/account/sync';
import { useT } from '../i18n/useT';

/** Longueur minimale d'un mot de passe, controlee ici AVANT l'envoi (le service impose son propre minimum, plus bas). */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Compte joueur : se connecter, creer un compte, retrouver sa progression
 * sur un autre appareil. Facultatif — le jeu reste entierement jouable sans.
 */
export function Account() {
  const t = useT();
  const setScreen = useGameStore((s) => s.setScreen);
  const account = useGameStore((s) => s.account);

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const back = () => setScreen('menu');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setMessage(t('account.error.invalid-email'));
      return;
    }
    if (mode === 'signup') {
      if (password.length < MIN_PASSWORD_LENGTH) {
        setMessage(t('account.error.weak-password', { n: MIN_PASSWORD_LENGTH }));
        return;
      }
      if (password !== confirm) {
        setMessage(t('account.error.mismatch'));
        return;
      }
    }
    setBusy(true);
    const outcome: AuthOutcome =
      mode === 'signup' ? await signUpAccount(address, password) : await signInAccount(address, password);
    setBusy(false);
    if (!outcome.ok) {
      setMessage(t(`account.error.${outcome.error}`, { n: MIN_PASSWORD_LENGTH }));
      return;
    }
    setPassword('');
    setConfirm('');
    if (outcome.needsEmailConfirmation) setMessage(t('account.checkEmail'));
  };

  const logout = async () => {
    setBusy(true);
    await signOutAccount();
    setBusy(false);
  };

  const remove = async () => {
    setBusy(true);
    const ok = await deleteAccount();
    setBusy(false);
    setConfirmingDelete(false);
    setMessage(ok ? t('account.deleted') : t('account.error.delete'));
  };

  // Service non configure : pas de compte possible ici, et on le dit.
  if (!accountAvailable()) {
    return (
      <div className="overlay overlay--solid">
        <div className="panel">
          <h2 className="panel__title">{t('account.title')}</h2>
          <p className="panel__text">{t('account.unavailable')}</p>
          <div className="button-column">
            <button className="btn btn--ghost" onClick={back}>
              {t('online.back')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (account.status === 'signedIn') {
    const syncKey = account.sync === 'error' ? 'account.sync.error' : account.sync === 'syncing' ? 'account.sync.syncing' : 'account.sync.ok';
    return (
      <div className="overlay overlay--solid">
        <div className="panel">
          <h2 className="panel__title">{t('account.title')}</h2>
          <p className="panel__text">
            {t('account.signedInAs')} <strong data-testid="account-email">{account.email}</strong>
          </p>
          <p className="footnote" data-testid="account-sync">
            {t(syncKey)}
          </p>
          <p className="footnote">{t('account.whatSyncs')}</p>
          {message && <p className="footnote">{message}</p>}
          <div className="button-column">
            <button className="btn" onClick={logout} disabled={busy}>
              {t('account.logout')}
            </button>
            {confirmingDelete ? (
              <>
                <p className="footnote">{t('account.deleteWarning')}</p>
                <button className="btn btn--ghost" onClick={remove} disabled={busy}>
                  {t('account.deleteConfirm')}
                </button>
                <button className="btn btn--ghost" onClick={() => setConfirmingDelete(false)} disabled={busy}>
                  {t('online.cancel')}
                </button>
              </>
            ) : (
              <button className="btn btn--ghost" onClick={() => setConfirmingDelete(true)} disabled={busy}>
                {t('account.delete')}
              </button>
            )}
            <button className="btn btn--ghost" onClick={back}>
              {t('online.back')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overlay overlay--solid">
      <div className="panel">
        <h2 className="panel__title">{t('account.title')}</h2>
        <p className="panel__text">{t('account.intro')}</p>

        <div className="segmented" role="group" aria-label={t('account.title')}>
          <button
            type="button"
            className={`segmented__item${mode === 'login' ? ' segmented__item--on' : ''}`}
            aria-pressed={mode === 'login'}
            onClick={() => setMode('login')}
          >
            {t('account.login')}
          </button>
          <button
            type="button"
            className={`segmented__item${mode === 'signup' ? ' segmented__item--on' : ''}`}
            aria-pressed={mode === 'signup'}
            onClick={() => setMode('signup')}
          >
            {t('account.signup')}
          </button>
        </div>

        <form className="button-column" onSubmit={submit} noValidate>
          <input
            className="input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('account.email')}
            aria-label={t('account.email')}
          />
          <input
            className="input"
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('account.password')}
            aria-label={t('account.password')}
          />
          {mode === 'signup' && (
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={t('account.confirmPassword')}
              aria-label={t('account.confirmPassword')}
            />
          )}
          {message && (
            <p className="footnote" role="alert" data-testid="account-message">
              {message}
            </p>
          )}
          <button className="btn btn--primary" type="submit" disabled={busy || account.status === 'checking'}>
            {t(mode === 'signup' ? 'account.createAccount' : 'account.loginAction')}
          </button>
          <button type="button" className="btn btn--ghost" onClick={back}>
            {t('online.back')}
          </button>
        </form>
        {mode === 'signup' && <p className="footnote">{t('account.dataNote')}</p>}
      </div>
    </div>
  );
}
