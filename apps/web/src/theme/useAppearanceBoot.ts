import { useEffect } from 'react';
import { api } from '../api/client';
import { applyAppearance } from './theme';

/** Applies the saved theme once on load. The CSS defaults (Straw) cover the time before it arrives. */
export function useAppearanceBoot(): void {
  useEffect(() => {
    api
      .getConfig()
      .then((result) => applyAppearance(result.config.appearance))
      .catch(() => {
        // Keep the Straw defaults from shell.css when the config cannot be read.
      });
  }, []);
}
