// Valeurs de la charte qui ne sont pas (encore) dans docs/charte/tokens.json : le mouvement
// (07-mouvement.md), le facteur de texte du mode Aînés (04-typographie.md, 09-accessibilite.md)
// et l'échelle d'un bouton appuyé (README, « États »).
//
// Elles sont recopiées ici telles quelles. charte-complements.test.ts relit les fichiers Markdown
// de la charte et échoue si une valeur s'en écarte : une modification de la charte sans mise à
// jour de ce fichier ne passe pas la CI. Le jour où tokens.json les contient, ce fichier disparaît.

/** Courbe de Bézier cubique, dans l'ordre de cubic-bezier(x1, y1, x2, y2). */
export type Bezier = readonly [number, number, number, number];

export interface CharteComplements {
  readonly motion: {
    /** Durées en millisecondes. */
    readonly duration: Readonly<Record<string, number>>;
    readonly easing: Readonly<Record<string, Bezier>>;
    /** Échelle d'un bouton appuyé (« se réduit à 97 % »). */
    readonly echelleAppui: number;
  };
  readonly aines: {
    /** « Toutes les tailles de texte sont multipliées par 1,3 », interlignes compris. */
    readonly facteurTexte: number;
  };
}

export const charteComplements: CharteComplements = {
  motion: {
    duration: {
      // Retour au toucher (bouton qui se réduit à 97 %) : courbe de sortie.
      toucher: 120,
      // Transition d'écran, apparition d'une carte, d'une puce : courbe de sortie.
      transition: 240,
      // Changement d'état dans un même écran (onglet, interrupteur) : entrée-sortie.
      changementEtat: 240,
      // Feuille qui monte du bas, fenêtre : courbe de sortie.
      feuille: 360,
      // Arbre qui pousse, chemin de parenté qui se trace : entrée-sortie.
      arbre: 600,
      // Toast : apparition (sortie), présence, disparition (entrée).
      toastApparition: 300,
      toastPresence: 2500,
      toastDisparition: 300,
      // Décalage entre deux générations quand l'arbre pousse.
      decalageGeneration: 60,
      // Fondu qui remplace tout déplacement quand le téléphone demande de réduire les animations.
      fonduReduit: 150,
    },
    easing: {
      // Tout ce qui entre à l'écran.
      sortie: [0.33, 1, 0.68, 1],
      // Ce qui se déplace d'un point à un autre.
      entreeSortie: [0.65, 0, 0.35, 1],
      // Uniquement une personne qui apparaît dans l'arbre. Jamais en santé ni en confidentialité.
      rebondLeger: [0.34, 1.3, 0.64, 1],
    },
    echelleAppui: 0.97,
  },
  aines: {
    facteurTexte: 1.3,
  },
};
