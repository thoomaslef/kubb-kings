/**
 * Pont d'evenements React -> Phaser.
 * Le sens inverse (Phaser -> React) passe directement par le store Zustand.
 *
 * Emetteur maison plutot que Phaser.Events.EventEmitter : ce module est
 * importe par tous les ecrans React (toujours charges), et Phaser lui-meme
 * ne doit se telecharger qu'une fois le shell affiche (cf. GameCanvas.tsx,
 * bootGame.ts) — heriter de sa classe d'evenements ferait echouer ce
 * decoupage en ramenant tout Phaser dans le chunk principal.
 */
export type BridgeEvent =
  | 'start-match'
  | 'restart-match'
  | 'leave-match'
  | 'pause-match'
  | 'resume-match';

interface Listener {
  fn: () => void;
  context?: unknown;
}

class GameBridge {
  private listeners = new Map<BridgeEvent, Listener[]>();

  on(event: BridgeEvent, fn: () => void, context?: unknown) {
    const list = this.listeners.get(event) ?? [];
    list.push({ fn, context });
    this.listeners.set(event, list);
  }

  off(event: BridgeEvent, fn: () => void, context?: unknown) {
    const list = this.listeners.get(event);
    if (!list) return;
    this.listeners.set(
      event,
      list.filter((l) => l.fn !== fn || l.context !== context)
    );
  }

  send(event: BridgeEvent) {
    // Copie : un handler peut se desabonner (off) pendant l'iteration.
    for (const { fn, context } of [...(this.listeners.get(event) ?? [])]) fn.call(context);
  }
}

export const bridge = new GameBridge();
