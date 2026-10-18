// Emplacements des fichiers du paquet, quel que soit le dossier courant.
import { join } from 'node:path';

export const packageRoot = join(import.meta.dirname, '..', '..');
export const messagesDir = join(packageRoot, 'messages');
export const reviewDir = join(packageRoot, 'review');
export const generatedParamsFile = join(packageRoot, 'src', 'generated', 'message-params.ts');

export function reviewFileOf(language: string): string {
  return join(reviewDir, `${language}.json`);
}
