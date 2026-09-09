import { useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { bridge } from '../game/GameBridge';
import { AI_PROFILES, type Difficulty } from '../game/ai';
import { FIELD_PRESETS, type FieldPresetId } from '../game/rules';
import { KUBB_SKINS, KUBB_SKIN_LABELS, KUBB_SKIN_HINTS } from '../game/theme';
import { LADDER, getBestStage } from '../game/roguelite';

const LEVELS = Object.keys(AI_PROFILES) as Difficulty[];
const PRESETS = Object.keys(FIELD_PRESETS) as FieldPresetId[];

export function Menu() {
  const setScreen = useGameStore((s) => s.setScreen);
  const difficulty = useGameStore((s) => s.difficulty);
  const setDifficulty = useGameStore((s) => s.setDifficulty);
  const fieldPreset = useGameStore((s) => s.fieldPreset);
  const setFieldPreset = useGameStore((s) => s.setFieldPreset);
  const kubbSkin = useGameStore((s) => s.kubbSkin);
  const setKubbSkin = useGameStore((s) => s.setKubbSkin);
  const windEnabled = useGameStore((s) => s.windEnabled);
  const setWindEnabled = useGameStore((s) => s.setWindEnabled);
  const setMode = useGameStore((s) => s.setMode);
  const startRun = useGameStore((s) => s.startRun);

  // Lue une seule fois au montage : elle ne peut changer que pendant une run,
  // ecran que ce composant n'affiche jamais.
  const [bestStage] = useState(getBestStage);

  const play = (mode: 'solo' | 'local' | '2v2') => {
    setMode(mode);
    bridge.send('start-match');
  };

  const playDefi = () => {
    setMode('defi');
    startRun();
    bridge.send('start-match');
  };

  return (
    <div className="overlay overlay--solid">
      <div className="panel panel--menu">
        <h1 className="title">
          KUBB<span className="title__accent">: Kings</span>
        </h1>
        <p className="subtitle">Le duel de lancer, sur un seul telephone.</p>

        <div className="button-column">
          <button className="btn btn--primary" onClick={() => play('solo')}>
            Solo &mdash; contre l&apos;IA
          </button>

          <div className="segmented" role="group" aria-label="Niveau de l&apos;IA">
            {LEVELS.map((level) => (
              <button
                key={level}
                className={`segmented__item${level === difficulty ? ' segmented__item--on' : ''}`}
                aria-pressed={level === difficulty}
                onClick={() => setDifficulty(level)}
              >
                {AI_PROFILES[level].label}
              </button>
            ))}
          </div>
          <p className="footnote footnote--tight">{AI_PROFILES[difficulty].hint}</p>

          <button className="btn" onClick={() => play('local')}>
            1v1 local &mdash; a deux
          </button>
          <button className="btn" onClick={() => play('2v2')}>
            2v2 local &mdash; a quatre
          </button>
          <button className="btn" onClick={playDefi}>
            Defi &mdash; {LADDER.length} manches, de plus en plus dures
          </button>
          <button className="btn" onClick={() => setScreen('tournament-setup')}>
            Tournoi local &mdash; 4 ou 8 joueurs
          </button>
          {bestStage > 0 && (
            <p className="footnote footnote--tight">
              Meilleure serie : {bestStage}/{LADDER.length} manche{bestStage > 1 ? 's' : ''} franchie
              {bestStage > 1 ? 's' : ''}
            </p>
          )}

          <div className="segmented" role="group" aria-label="Terrain">
            {PRESETS.map((id) => (
              <button
                key={id}
                className={`segmented__item${id === fieldPreset ? ' segmented__item--on' : ''}`}
                aria-pressed={id === fieldPreset}
                onClick={() => setFieldPreset(id)}
              >
                {FIELD_PRESETS[id].label}
              </button>
            ))}
          </div>
          <p className="footnote footnote--tight">{FIELD_PRESETS[fieldPreset].hint}</p>

          <div className="segmented" role="group" aria-label="Meteo">
            <button
              className={`segmented__item${!windEnabled ? ' segmented__item--on' : ''}`}
              aria-pressed={!windEnabled}
              onClick={() => setWindEnabled(false)}
            >
              Sans vent
            </button>
            <button
              className={`segmented__item${windEnabled ? ' segmented__item--on' : ''}`}
              aria-pressed={windEnabled}
              onClick={() => setWindEnabled(true)}
            >
              Avec vent
            </button>
          </div>
          <p className="footnote footnote--tight">
            {windEnabled
              ? 'Une brise constante devie les lancers — sens tire au debut de chaque partie'
              : 'Terrain calme'}
          </p>

          <div className="segmented" role="group" aria-label="Skin des kubbs">
            {KUBB_SKINS.map((skin) => (
              <button
                key={skin}
                className={`segmented__item${skin === kubbSkin ? ' segmented__item--on' : ''}`}
                aria-pressed={skin === kubbSkin}
                onClick={() => setKubbSkin(skin)}
              >
                {KUBB_SKIN_LABELS[skin]}
              </button>
            ))}
          </div>
          <p className="footnote footnote--tight">{KUBB_SKIN_HINTS[kubbSkin]}</p>

          <button className="btn" onClick={() => setScreen('rules')}>
            Regles
          </button>
          <button className="btn btn--ghost" onClick={() => setScreen('quit')}>
            Quitter
          </button>
        </div>

        <p className="footnote">Pass-and-play &middot; 4 minutes max</p>
        <button className="link-btn" onClick={() => setScreen('about')}>
          A propos
        </button>
        <button className="link-btn" onClick={() => setScreen('legal')}>
          Confidentialite &amp; mentions legales
        </button>
      </div>
    </div>
  );
}
