# Feuille

Un panneau qui monte du bas pour une tâche courte, sans quitter l’écran.

## Ce que vous fournissez

- `titre`, `sousTitre`, le contenu (champs, choix), une action principale.
- `onClose` : la feuille se ferme en la tirant vers le bas ou en touchant le voile.

## Règles

- Coins hauts `rayon-feuille`, poignée de 48 × 5 px, `ombre-feuille`, voile `voile` derrière.
- Une feuille fait une seule chose : ajouter un antécédent, donner un accord, inviter. Au-delà, ouvrez un écran.
- Elle monte en 360 ms, courbe de sortie, et suit le doigt.
