import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { getCurrentSession } from '../game/online/currentSession';
import { appendChat, CHAT_MAX_LENGTH, sanitizeChatText, type ChatMessage } from '../game/online/chat';
import { useT } from '../i18n/useT';

/**
 * Tchat de la partie en ligne.
 *
 * Replie par defaut, et c'est voulu : la partie se joue sur un telephone
 * tenu a une main, l'ecran est petit, et un panneau ouvert en permanence
 * mangerait le terrain. Une pastille signale les messages non lus.
 *
 * Rien n'est conserve : les messages vivent dans l'etat de ce composant,
 * disparaissent avec la partie, et ne sont ecrits ni sur l'appareil ni sur
 * le relais (cf. online/chat.ts).
 */
export function Chat() {
  const t = useT();
  const mode = useGameStore((s) => s.mode);
  const online = useGameStore((s) => s.online);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [brouillon, setBrouillon] = useState('');
  const [ouvert, setOuvert] = useState(false);
  const [nonLus, setNonLus] = useState(0);
  const prochainId = useRef(0);
  const finDeListe = useRef<HTMLDivElement>(null);

  const session = getCurrentSession();

  // Reception. `ouvert` est volontairement HORS des dependances : le
  // reabonnement a chaque ouverture ferait manquer les messages arrives
  // pendant le changement. On lit donc l'etat courant via la forme
  // fonctionnelle de `setNonLus`.
  useEffect(() => {
    if (!session) return;
    return session.onChat((texte) => {
      setMessages((anciens) => appendChat(anciens, { id: (prochainId.current += 1), mine: false, text: texte }));
      setNonLus((n) => n + 1);
    });
  }, [session]);

  // Le dernier message doit etre visible sans avoir a faire defiler.
  useEffect(() => {
    if (ouvert) finDeListe.current?.scrollIntoView({ block: 'end' });
  }, [messages, ouvert]);

  useEffect(() => {
    if (ouvert) setNonLus(0);
  }, [ouvert, messages]);

  if (mode !== 'online' || !online || !session) return null;

  const envoyer = () => {
    // `sendChat` applique les memes regles que l'affichage (nettoyage,
    // cadence) et rend le texte REELLEMENT transmis : on n'affiche donc que
    // ce que l'adversaire a recu, jamais une bulle qui n'est jamais partie.
    const envoye = session.sendChat(brouillon);
    if (!envoye) return;
    setMessages((anciens) => appendChat(anciens, { id: (prochainId.current += 1), mine: true, text: envoye }));
    setBrouillon('');
  };

  if (!ouvert) {
    return (
      <button className="chat-bulle" onClick={() => setOuvert(true)} aria-label={t('chat.open')}>
        💬
        {nonLus > 0 && <span className="chat-bulle__pastille">{nonLus > 9 ? '9+' : nonLus}</span>}
      </button>
    );
  }

  return (
    <div className="chat">
      <div className="chat__entete">
        <span className="chat__titre">{t('chat.title')}</span>
        <button className="chat__fermer" onClick={() => setOuvert(false)} aria-label={t('chat.close')}>
          ✕
        </button>
      </div>

      <div className="chat__messages" role="log" aria-live="polite">
        {messages.length === 0 && <p className="chat__vide">{t('chat.empty')}</p>}
        {messages.map((m) => (
          <p key={m.id} className={`chat__message${m.mine ? ' chat__message--moi' : ''}`}>
            {m.text}
          </p>
        ))}
        <div ref={finDeListe} />
      </div>

      <form
        className="chat__saisie"
        onSubmit={(e) => {
          e.preventDefault();
          envoyer();
        }}
      >
        <input
          value={brouillon}
          onChange={(e) => setBrouillon(e.target.value)}
          maxLength={CHAT_MAX_LENGTH}
          placeholder={t('chat.placeholder')}
          aria-label={t('chat.placeholder')}
          autoComplete="off"
        />
        <button type="submit" className="btn btn--primary" disabled={!sanitizeChatText(brouillon)}>
          {t('chat.send')}
        </button>
      </form>
    </div>
  );
}
