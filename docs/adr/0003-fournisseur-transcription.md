# 0003 — Fournisseur de transcription

Date : 15 octobre 2026 · Statut : proposée

## Contexte

Le TRD retient Voxtral Mini Transcribe 2 (Mistral) et prévoit de « mesurer sur le jeu de test avant d'en dépendre ». La présentation garde la question ouverte : « Quel fournisseur de transcription, après un banc d'essai sur des voix camerounaises ? ».

Critères, par ordre d'importance pour Lignée :

1. **Justesse des noms propres camerounais** dits avec un accent camerounais, en français, en anglais et en mélange. Un nom mal transcrit donne une fiche fausse ou un doublon.
2. **Données** : traitement dans l'UE, aucune réutilisation pour l'entraînement, conservation nulle ou minimale (VOX-21, ADR 0002).
3. **Coût** pour une dictée de 15 s, avec le budget du TRD (0,003 $ par dictée en tout).
4. **Indices de vocabulaire** : pouvoir envoyer jusqu'à 100 noms de l'arbre.
5. **Sortie de secours** : pouvoir changer de fournisseur ou héberger soi-même le modèle.

## Ce que disent les sources (octobre 2026)

Aucun banc d'essai public ne mesure le français parlé au Cameroun. Les chiffres publiés sont presque tous donnés par les fournisseurs eux-mêmes. Un corpus de « français à accent africain » existe, et une étude montre qu'un modèle non entraîné sur ces accents peut faire plus du double d'erreurs. Le seul moyen de trancher est donc notre propre banc d'essai.

| Fournisseur | Prix (lot) | Données | Indices de vocabulaire | Remarques |
| --- | --- | --- | --- | --- |
| **Voxtral Mini Transcribe 2** (Mistral, France) | 0,003 $/min | UE par défaut ; API payante non utilisée pour l'entraînement ; conservation nulle sur demande écrite | Jusqu'à 100 termes, mais annoncés « expérimentaux » hors de l'anglais | Moins cher du lot ; variante temps réel publiée en poids ouverts (Apache 2) |
| **ElevenLabs Scribe v2** | ≈ 0,004 à 0,007 $/min selon les sources | Résidence UE et conservation nulle en offre Entreprise seulement | Jusqu'à 100 termes | Meilleurs chiffres publiés en français, mais mesurés par un concurrent |
| **Gladia Solaria** (France) | ≈ 0,61 $/h, soit ≈ 0,010 $/min | UE ; conservation nulle en offre Entreprise | Oui | Basé sur Whisper ; plus cher |
| AssemblyAI, Deepgram, OpenAI | 0,003 à 0,006 $/min | Américains : transfert supplémentaire à faire autoriser | Selon le modèle | Écartés d'office (voir ci-dessous) |

## Décision proposée

1. **Voxtral Mini Transcribe 2 reste le fournisseur par défaut**, comme dans le TRD. Il coche le plus de critères à la fois : UE, entreprise européenne, moins cher, poids ouverts pour un repli auto-hébergé.
2. **ElevenLabs Scribe v2 est le challenger**, mesuré dans le même banc d'essai.
3. **Le choix se fige seulement après le banc d'essai** (T-109) :
   - 100 dictées tirées du jeu de 300 phrases, enregistrées avec l'accord des locuteurs, hors du dépôt (voir la remarque sur les données réelles du plan V1) ;
   - des locuteurs camerounais de tous âges, au moins 30 % d'aînés, en français, en anglais et en mélange ;
   - on mesure **la justesse des noms propres**, puis **le taux de liens corrects de bout en bout** (VOX-02), le délai en 3G et le coût ;
   - chaque fournisseur reçoit les mêmes 100 noms en indices.
4. **Règle de décision** : on garde Voxtral, sauf si Scribe v2 donne au moins 5 points de plus de liens corrects de bout en bout. Dans ce cas, une nouvelle ADR justifie le surcoût et le contrat Entreprise.
5. **Condition au contrat** : demande écrite de conservation nulle à Mistral, point de terminaison UE seulement, DPA signé, avant toute donnée réelle (VOX-21).
6. **L'adaptateur reste derrière l'interface interne** prévue par le TRD (`packages/voice`) : changer de fournisseur ne touche que l'adaptateur.

## Écarté

- **OpenAI, AssemblyAI, Deepgram** : sociétés américaines, donc un transfert de plus à faire autoriser par l'Autorité camerounaise (ADR 0002), sans avantage démontré sur le français. Un banc d'essai d'AssemblyAI montre même gpt-4o-transcribe très faible sur des phrases qui mélangent les langues.
- **Gladia** : européen, mais environ trois fois plus cher que Voxtral, et la conservation nulle est réservée à l'offre Entreprise. On le reprendra si les deux premiers échouent.
- **Reconnaissance du téléphone** (Android, iOS) : gratuite et disponible hors-ligne, mais elle ne prend pas d'indices de noms, se comporte différemment selon l'appareil et ne gère pas bien le mélange des langues. Le TRD prévoit d'ailleurs l'attente du réseau pour la voix (VOX-18).
- **Whisper auto-hébergé dès maintenant** : un serveur GPU coûte plus cher que l'API en dessous de 100 000 dictées par mois (TRD). On le réévalue à ce seuil, avec les poids ouverts de Voxtral.

## Sources

- [Mistral, Voxtral Transcribe 2](https://mistral.ai/news/voxtral-transcribe-2/)
- [Revue de Voxtral Transcribe 2 (ChatForest)](https://chatforest.com/reviews/mistral-voxtral-transcribe-2-realtime-asr-review/)
- [Politique de conservation des données de Mistral (Char)](https://char.com/blog/mistral-data-retention-policy)
- [ElevenLabs, Scribe v2](https://elevenlabs.io/blog/introducing-scribe-v2)
- [AssemblyAI, transcription multilingue](https://www.assemblyai.com/blog/multilingual-speech-to-text-api)
- [Comparatif des API de transcription (VexaScribe)](https://vexascribe.com/compare/best-transcription-api-for-developers)
- [Tarifs de Gladia](https://gladia.io/blog/deepgram-pricing)
- [Whisper large-v3 French, avec un corpus de français à accent africain](https://huggingface.co/bofenghuang/whisper-large-v3-french)
- [Accents africains et entraînement multi-domaines (ResearchGate)](https://www.researchgate.net/publication/369233396_Improving_Accented_Speech_Recognition_with_Multi-Domain_Training)
