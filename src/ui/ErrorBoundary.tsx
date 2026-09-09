import { Component, type ErrorInfo, type ReactNode } from 'react';
import { recordCrash } from '../game/diagnostics';

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

    return (
      <div className="overlay overlay--solid">
        <div className="panel">
          <h2 className="panel__title">Oups&hellip;</h2>
          <p className="panel__text">
            Une erreur inattendue est survenue. Votre progression (meilleure serie,
            preferences) n&apos;est pas affectee : elle reste enregistree sur cet appareil.
          </p>
          <div className="button-column">
            <button className="btn btn--primary" onClick={this.reload}>
              Recharger le jeu
            </button>
          </div>
        </div>
      </div>
    );
  }
}
