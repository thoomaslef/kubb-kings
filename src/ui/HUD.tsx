import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { bridge } from '../game/GameBridge';
import { TEAMS, OPPONENT } from '../game/entities/teamData';
import { isMuted, setMuted } from '../game/audio';
import { AI_TEAM } from '../game/ai';
import { isKingTipSeen, markKingTipSeen } from '../game/tutorial';
import { LADDER } from '../game/roguelite';

function formatTime(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function HUD() {
  const hud = useGameStore((s) => s.hud);
  const paused = useGameStore((s) => s.paused);
  const setPaused = useGameStore((s) => s.setPaused);
  const setScreen = useGameStore((s) => s.setScreen);

  const mode = useGameStore((s) => s.mode);
  const run = useGameStore((s) => s.run);
  const tournamentPending = useGameStore((s) => s.tournamentPending);
  const resetTournament = useGameStore((s) => s.resetTournament);
  const [muted, setMutedState] = useState(isMuted);

  // La toute premiere fois que le roi devient visable, le bandeau se fait
  // plus bavard : c'est le seul reste du tutoriel qui vit dans le HUD plutot
  // que dans <Tutorial />, pour rester le meme bandeau qu'en temps normal.
  const [kingTipExpanded] = useState(() => !isKingTipSeen());
  const kingTipMarked = useRef(false);
  useEffect(() => {
    if (hud.canTargetKing && hud.phase === 'aiming' && !kingTipMarked.current) {
      kingTipMarked.current = true;
      markKingTipSeen();
    }
  }, [hud.canTargetKing, hud.phase]);

  const active = TEAMS[hud.activeTeam];
  // En solo comme en Defi, l'adversaire n'est pas "l'equipe Rouge" mais
  // l'IA : le HUD doit dire a qui on a affaire, et surtout quand elle joue.
  const activeIsAi = (mode === 'solo' || mode === 'defi') && hud.activeTeam === AI_TEAM;
  // En Defi, rappeler ou on en est dans l'echelle de manches.
  const stageTag = mode === 'defi' && run ? ` · Manche ${run.stageIndex + 1}/${LADDER.length}` : '';
  // En 2v2, deux joueurs se partagent chaque camp : preciser lequel est au lancer.
  // En tournoi, le nom du participant remplace la couleur d'equipe (sans objet
  // pour lui : il ne sait pas qu'il joue "Bleue" ou "Rouge").
  const activeLabel = activeIsAi
    ? `IA${stageTag}`
    : tournamentPending
      ? hud.activeTeam === 'blue'
        ? tournamentPending.blueName
        : tournamentPending.redName
      : mode === '2v2'
        ? `${active.label} J${hud.activePlayer}`
        : `${active.label}${stageTag}`;
  const targets = hud.kubbsStanding[OPPONENT[hud.activeTeam]];
  // Derniere ligne droite : le chrono se met a battre en rouge.
  const urgent = hud.timeLeftMs <= 10_000;

  const toggleSound = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  };

  const leaveMatch = () => {
    setPaused(false);
    if (tournamentPending) resetTournament();
    bridge.send('leave-match');
    setScreen('menu');
  };

  return (
    <>
      <div className="hud">
        <div className="hud__bar">
          <div className="hud__team" style={{ borderColor: active.cssColor }}>
            <span className="hud__dot" style={{ background: active.cssColor }} />
            <strong className="hud__team-label">{activeLabel}</strong>
          </div>

          {hud.wind && (
            <span className="hud__wind" aria-label={`Vent vers ${hud.wind > 0 ? 'la droite' : 'la gauche'}`}>
              {hud.wind > 0 ? '→' : '←'}
            </span>
          )}

          <div className="hud__stats">
            <div className="hud__stat">
              <span className="hud__stat-value">{targets}</span>
              <span className="hud__stat-label">kubbs</span>
            </div>
            <div className="hud__stat">
              <span className="hud__stat-value">{hud.throwsLeft[hud.activeTeam]}</span>
              <span className="hud__stat-label">lancers</span>
            </div>
            <div className={`hud__stat${urgent ? ' hud__stat--urgent' : ''}`}>
              <span className="hud__stat-value">{formatTime(hud.timeLeftMs)}</span>
              <span className="hud__stat-label">temps</span>
            </div>
          </div>

          <button
            className="hud__icon-btn"
            onClick={toggleSound}
            aria-label={muted ? 'Activer le son' : 'Couper le son'}
          >
            {muted ? '\u2715' : '\u266A'}
          </button>

          <button className="hud__icon-btn" onClick={() => setPaused(true)} aria-label="Pause">
            II
          </button>
        </div>

        {hud.phase === 'ai-aiming' && <div className="hud__banner hud__banner--ai">L&apos;IA vise&hellip;</div>}

        {hud.canTargetKing && hud.phase === 'aiming' && (
          <div className="hud__banner">
            {kingTipExpanded
              ? 'Le roi est a portee : le viser maintenant fait gagner la partie'
              : 'Le roi est a portee — visez-le pour gagner'}
          </div>
        )}
      </div>

      {paused && (
        <div className="overlay">
          <div className="panel">
            <h2 className="panel__title">Pause</h2>
            <div className="button-column">
              <button className="btn btn--primary" onClick={() => setPaused(false)}>
                Reprendre
              </button>
              <button className="btn btn--ghost" onClick={leaveMatch}>
                Quitter la partie
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
