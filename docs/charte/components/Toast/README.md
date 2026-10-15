# Toast

Une confirmation brève, en pilule sombre, en bas de l’écran.

## Ce que vous fournissez

- `message` : ce qui vient de se passer, en une phrase courte.

## Règles

- Fond `notification`, texte `sur-notification`, coche dorée. Apparition 300 ms, présence 2,5 s, disparition 300 ms ; en mode Aînés, il reste jusqu’à ce qu’on le ferme.
- Le message dit le résultat, pas l’action : « Lucienne a rejoint l’arbre », pas « Ajout effectué ».
- Pas de toast pour une erreur : l’erreur s’affiche là où elle se corrige.
- Annoncé au lecteur d’écran (rôle « status »).
