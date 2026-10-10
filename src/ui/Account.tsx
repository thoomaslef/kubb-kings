import { useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import {
  accountAvailable,
  deleteAccount,
  signInAccount,
  signInWithGoogle,
  signOutAccount,
  signUpAccount,
  type AuthOutcome
} from '../game/account/sync';
import { GOOGLE_SIGN_IN_ENABLED } from '../game/account/config';
import { useT } from '../i18n/useT';

/** Longueur minimale d'un mot de passe, controlee ici AVANT l'envoi (le service impose son propre minimum, plus bas). */
export const MIN_PASSWORD_LENGTH = 8;

/** Logo « G » de Google (quatre couleurs), tel que Google le publie. */
function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

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

  const google = async () => {
    setMessage(null);
    setBusy(true);
    const outcome = await signInWithGoogle();
    // En cas de succes la page est quittee pour Google : on ne revient ici qu'en cas d'echec.
    setBusy(false);
    if (!outcome.ok) setMessage(t(`account.error.${outcome.error}`, { n: MIN_PASSWORD_LENGTH }));
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

        {GOOGLE_SIGN_IN_ENABLED && (
          <div className="button-column">
            <button type="button" className="btn btn--google" onClick={google} disabled={busy || account.status === 'checking'}>
              <GoogleLogo />
              {t('account.google')}
            </button>
            <p className="footnote footnote--tight account-or">{t('account.or')}</p>
          </div>
        )}
        {account.notice === 'oauth-error' && (
          <p className="footnote" role="alert" data-testid="account-notice">
            {t('account.error.oauth')}
          </p>
        )}

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
