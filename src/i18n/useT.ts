import { useGameStore } from '../store/useGameStore';
import { translate } from './translate';

/** Traduction reactive : re-rendu automatique si la langue change. */
export function useT() {
  const lang = useGameStore((s) => s.lang);
  return (key: string, params?: Record<string, string | number>) => translate(lang, key, params);
}
