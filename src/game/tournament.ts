/**
 * Tournoi local a elimination directe : 4 ou 8 joueurs, pass-and-play, sur des
 * matchs 1v1 ordinaires (aucune regle de match ne change — voir rules.ts).
 * Module pur (comme roguelite.ts) : pas d'IA, pas de physique, juste l'arbre.
 */

export type TournamentSize = 4 | 8;

export interface TournamentMatch {
  round: number;
  slot: number;
  a: string | null;
  b: string | null;
  winner: string | null;
}

export interface TournamentState {
  size: TournamentSize;
  /** rounds[0] = premier tour, rounds[dernier] = finale. */
  rounds: TournamentMatch[][];
}

/** Construit l'arbre a partir de la liste ordonnee des participants (4 ou 8). */
export function buildBracket(names: string[]): TournamentState {
  const size = names.length as TournamentSize;
  const roundCount = Math.log2(size);

  const firstRound: TournamentMatch[] = [];
  for (let i = 0; i < size / 2; i += 1) {
    firstRound.push({ round: 0, slot: i, a: names[i * 2], b: names[i * 2 + 1], winner: null });
  }

  const rounds: TournamentMatch[][] = [firstRound];
  for (let r = 1; r < roundCount; r += 1) {
    const count = size / 2 ** (r + 1);
    rounds.push(Array.from({ length: count }, (_, i) => ({ round: r, slot: i, a: null, b: null, winner: null })));
  }
  return { size, rounds };
}

/** Premier match dont les deux participants sont connus mais pas encore joue. */
export function nextMatch(state: TournamentState): TournamentMatch | null {
  for (const round of state.rounds) {
    for (const match of round) {
      if (!match.winner && match.a && match.b) return match;
    }
  }
  return null;
}

/** Enregistre le vainqueur d'un match et le propage au tour suivant. */
export function recordWinner(state: TournamentState, round: number, slot: number, winner: string): TournamentState {
  const rounds = state.rounds.map((r) => r.map((m) => ({ ...m })));
  rounds[round][slot].winner = winner;

  const next = rounds[round + 1];
  if (next) {
    const nextSlot = Math.floor(slot / 2);
    if (slot % 2 === 0) next[nextSlot].a = winner;
    else next[nextSlot].b = winner;
  }
  return { ...state, rounds };
}

/** Vainqueur de la finale, une fois jouee — null tant que le tournoi continue. */
export function champion(state: TournamentState): string | null {
  const final = state.rounds[state.rounds.length - 1][0];
  return final.winner;
}

/**
 * Cle i18n du nom de tour (tournament.round.*, src/i18n/dictionaries.ts), du
 * plus lointain (quarts) au plus proche (finale) — pas le texte final, pour
 * rester traduisible par l'appelant (TournamentBracket.tsx) via t().
 */
export function roundLabelKey(round: number, totalRounds: number): { key: string; params?: { n: number } } {
  const remaining = totalRounds - round;
  if (remaining === 1) return { key: 'tournament.round.final' };
  if (remaining === 2) return { key: 'tournament.round.semifinals' };
  if (remaining === 3) return { key: 'tournament.round.quarterfinals' };
  return { key: 'tournament.round.n', params: { n: round + 1 } };
}
