import { useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import {
  accountAvailable,
  cancelRecovery,
  deleteAccount,
  requestPasswordReset,
  setNewPassword,
  signInAccount,
  signOutAccount,
  signUpAccount,
  type AuthOutcome
} from '../game/account/sync';
import { PSEUDO_MAX, PSEUDO_MIN, validatePseudo } from '../game/account/pseudo';
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
  const [pseudo, setPseudo] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  /** « Mot de passe oublie » : on ne demande plus que l'adresse. */
  const [forgot, setForgot] = useState(false);
  const [sent, setSent] = useState(false);

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
      // Pseudo facultatif : vide = un pseudo sera attribue. Rempli, il doit respecter les regles.
      if (pseudo.trim() !== '') {
        const check = validatePseudo(pseudo);
        if (!check.ok) {
          setMessage(t(`pseudo.error.${check.reason}`, { min: PSEUDO_MIN, max: PSEUDO_MAX }));
          return;
        }
      }
    }
    setBusy(true);
    const outcome: AuthOutcome =
      mode === 'signup' ? await signUpAccount(address, password, pseudo.trim() || undefined) : await signInAccount(address, password);
    setBusy(false);
    if (!outcome.ok) {
      setMessage(t(`account.error.${outcome.error}`, { n: MIN_PASSWORD_LENGTH }));
      return;
    }
    setPassword('');
    setConfirm('');
    setPseudo('');
    if (outcome.needsEmailConfirmation) setMessage(t('account.checkEmail'));
  };

  const sendReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setMessage(t('account.error.invalid-email'));
      return;
    }
    setBusy(true);
    const outcome = await requestPasswordReset(address);
    setBusy(false);
    if (!outcome.ok) {
      setMessage(t(`account.error.${outcome.error}`, { n: MIN_PASSWORD_LENGTH }));
      return;
    }
    // Meme message que l'adresse ait un compte ou non : on ne le dit jamais.
    setSent(true);
  };

  const saveNewPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setMessage(t('account.error.weak-password', { n: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (password !== confirm) {
      setMessage(t('account.error.mismatch'));
      return;
    }
    setBusy(true);
    const outcome = await setNewPassword(password);
    setBusy(false);
    if (!outcome.ok) {
      setMessage(t(`account.error.${outcome.error}`, { n: MIN_PASSWORD_LENGTH }));
      return;
    }
    setPassword('');
    setConfirm('');
    setMessage(t('account.reset.done'));
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

  // Arrive par le lien de reinitialisation : un seul geste a faire, choisir le nouveau mot de passe.
  if (account.status === 'signedIn' && account.recovering) {
    return (
      <div className="overlay overlay--solid">
        <div className="panel">
          <h2 className="panel__title">{t('account.reset.newTitle')}</h2>
          <p className="panel__text">{t('account.reset.newIntro')}</p>
          <form className="button-column" onSubmit={saveNewPassword} noValidate>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('account.reset.newPassword')}
              aria-label={t('account.reset.newPassword')}
              data-testid="new-password"
            />
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={t('account.confirmPassword')}
              aria-label={t('account.confirmPassword')}
            />
            {message && (
              <p className="footnote" role="alert" data-testid="account-message">
                {message}
              </p>
            )}
            <button className="btn btn--primary" type="submit" disabled={busy}>
              {t('account.reset.save')}
            </button>
            <button type="button" className="btn btn--ghost" onClick={cancelRecovery} disabled={busy}>
              {t('account.reset.skip')}
            </button>
          </form>
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
          {(account.notice === 'pseudo-taken' || account.notice === 'pseudo-refused') && (
            <p className="footnote" role="alert" data-testid="account-notice">
              {t(`account.notice.${account.notice}`)}
            </p>
          )}
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

  if (forgot) {
    return (
      <div className="overlay overlay--solid">
        <div className="panel">
          <h2 className="panel__title">{t('account.reset.title')}</h2>
          {sent ? (
            <p className="panel__text" data-testid="reset-sent">
              {t('account.reset.sent')}
            </p>
          ) : (
            <>
              <p className="panel__text">{t('account.reset.intro')}</p>
              <form className="button-column" onSubmit={sendReset} noValidate>
                <input
                  className="input"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('account.email')}
                  aria-label={t('account.email')}
                />
                {message && (
                  <p className="footnote" role="alert" data-testid="account-message">
                    {message}
                  </p>
                )}
                <button className="btn btn--primary" type="submit" disabled={busy}>
                  {t('account.reset.send')}
                </button>
              </form>
            </>
          )}
          <div className="button-column">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setForgot(false);
                setSent(false);
                setMessage(null);
              }}
            >
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
          {mode === 'signup' && (
            <>
              <input
                className="input"
                value={pseudo}
                maxLength={PSEUDO_MAX}
                onChange={(e) => setPseudo(e.target.value)}
                placeholder={t('account.pseudo.placeholder')}
                aria-label={t('account.pseudo.placeholder')}
                autoComplete="nickname"
                autoCapitalize="off"
                spellCheck={false}
                data-testid="signup-pseudo"
              />
              <p className="footnote footnote--tight">{t('account.pseudo.hint')}</p>
            </>
          )}
          {message && (
            <p className="footnote" role="alert" data-testid="account-message">
              {message}
            </p>
          )}
          <button className="btn btn--primary" type="submit" disabled={busy || account.status === 'checking'}>
            {t(mode === 'signup' ? 'account.createAccount' : 'account.loginAction')}
          </button>
          {mode === 'login' && (
            <button type="button" className="link-btn" onClick={() => setForgot(true)}>
              {t('account.reset.link')}
            </button>
          )}
          <button type="button" className="btn btn--ghost" onClick={back}>
            {t('online.back')}
          </button>
        </form>
        {mode === 'signup' && <p className="footnote">{t('account.dataNote')}</p>}
      </div>
    </div>
  );
}
