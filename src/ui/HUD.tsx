import { useGameStore } from '../store/useGameStore';
import { bridge } from '../game/GameBridge';
import { TEAMS, OPPONENT } from '../game/entities/Team';

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

  const active = TEAMS[hud.activeTeam];
  const targets = hud.kubbsStanding[OPPONENT[hud.activeTeam]];

  const leaveMatch = () => {
    setPaused(false);
    bridge.send('leave-match');
    setScreen('menu');
  };

  return (
    <>
      <div className="hud">
        <div className="hud__bar">
          <div className="hud__team" style={{ borderColor: active.cssColor }}>
            <span className="hud__dot" style={{ background: active.cssColor }} />
            <span>
              Equipe <strong>{active.label}</strong>
            </span>
          </div>

          <div className="hud__stats">
            <div className="hud__stat">
              <span className="hud__stat-value">{targets}</span>
              <span className="hud__stat-label">kubbs</span>
            </div>
            <div className="hud__stat">
              <span className="hud__stat-value">{hud.throwsLeft[hud.activeTeam]}</span>
              <span className="hud__stat-label">lancers</span>
            </div>
            <div className="hud__stat">
              <span className="hud__stat-value">{formatTime(hud.timeLeftMs)}</span>
              <span className="hud__stat-label">temps</span>
            </div>
          </div>

          <button className="hud__pause" onClick={() => setPaused(true)} aria-label="Pause">
            II
          </button>
        </div>

        {hud.canTargetKing && hud.phase === 'aiming' && (
          <div className="hud__banner">Le roi est a portee &mdash; visez-le pour gagner</div>
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
