# Mouvement

Le mouvement explique ce qui se passe, il ne décore pas. Il est court, doux, et il ne fait jamais attendre.

## Durées et courbes

| Usage | Durée | Courbe |
| --- | --- | --- |
| Retour au toucher (bouton qui se réduit à 97 %) | 120 ms | sortie |
| Transition d’écran, apparition d’une carte, d’une puce | 240 ms | sortie |
| Changement d’état dans un même écran (onglet, interrupteur) | 240 ms | entrée-sortie |
| Feuille qui monte du bas, fenêtre | 360 ms | sortie |
| Arbre qui pousse, chemin de parenté qui se trace | 600 ms | entrée-sortie |
| Toast : apparition / présence / disparition | 300 ms / 2,5 s / 300 ms | sortie / – / entrée |

| Courbe | cubic-bezier | Quand |
| --- | --- | --- |
| Sortie | (0.33, 1, 0.68, 1) | Tout ce qui entre à l’écran |
| Entrée-sortie | (0.65, 0, 0.35, 1) | Ce qui se déplace d’un point à un autre |
| Rebond léger | (0.34, 1.3, 0.64, 1) | Uniquement une personne qui apparaît dans l’arbre |

## Principes

- **L’arbre pousse.** À l’ouverture, les traits partent de « Vous » vers le haut, puis les avatars apparaissent génération par génération (décalage de 60 ms). Un nouvel ajout apparaît avec le rebond léger.
- **Une chose à la fois.** Un seul élément principal bouge à un instant donné ; le reste attend ou suit avec un décalage.
- **Rien ne rebondit dans les moments sérieux.** Santé, confidentialité, suppression, deuil : fondu et courbe de sortie seulement.
- **Le mouvement suit le doigt.** Une feuille que l’on tire suit le geste ; relâchée, elle se pose avec la courbe de sortie.
- **Le retour tactile accompagne la confirmation.** Une vibration légère (impact « light ») quand une personne est ajoutée, une invitation envoyée, un antécédent enregistré. Aucune vibration pour une erreur de saisie.

## Réduire les animations

Quand le téléphone demande de réduire les animations, remplacez tout déplacement par un fondu de 150 ms, supprimez le rebond, la respiration de l’anneau d’anniversaire et la pousse de l’arbre : l’arbre s’affiche directement.

## Les visuels de marque

Le film et les visuels animés gardent leur grammaire propre : fond Nuit, poussière lumineuse discrète, lueur dorée autour du symbole, titres qui apparaissent mot à mot. Ces effets restent hors de l’app.
