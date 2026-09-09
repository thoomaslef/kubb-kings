import { Component, type ErrorInfo, type ReactNode } from 'react';
import { recordCrash } from '../game/diagnostics';
import { useGameStore } from '../store/useGameStore';
import { translate } from '../i18n/translate';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Filet de securite React : sans lui, une erreur de rendu laisse un ecran
 * blanc/noir figé, sans aucune explication. Ne couvre que les erreurs de
 * rendu React — celles de la boucle Phaser (hors React) sont capturees a
 * part par diagnostics.ts::installGlobalCrashHandlers.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    recordCrash(error, info.componentStack ?? undefined);
  }

  private reload = () => window.location.reload();

  render() {
    if (!this.state.hasError) return this.props.children;

    // Classe, pas de hook : lecture directe du store (pas reactive, mais un
    // rechargement est le seul bouton propose ici de toute facon).
    const lang = useGameStore.getState().lang;

    return (
      <div className="overlay overlay--solid">
        <div className="panel">
          <h2 className="panel__title">{translate(lang, 'error.title')}</h2>
          <p className="panel__text">{translate(lang, 'error.text')}</p>
          <div className="button-column">
            <button className="btn btn--primary" onClick={this.reload}>
              {translate(lang, 'error.reload')}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
