# 0002 — Société au Cameroun, hébergement dans l'Union européenne

Date : 15 octobre 2026 · Statut : acceptée (décision de Daniel)

## Contexte

La présentation du cahier laissait ouvertes deux questions : « Où créer la société, en France ou au Cameroun ? » et « Où héberger les données (Union européenne ou Afrique), au vu des règles de transfert ? ». Le TRD prévoyait déjà un VPS dans l'Union européenne et appliquait d'office la règle la plus stricte des deux textes.

## Décision

- La société qui édite Lignée et répond des données est créée au **Cameroun**.
- Les serveurs et les données sont hébergés dans l'**Union européenne**, comme le prévoit le TRD (VPS, sauvegardes, Cloudflare R2 en région UE).

## Conséquences

Ce qui suit résume des analyses publiées de la loi n° 2024/017. Les numéros d'articles et les décrets d'application restent à vérifier sur le texte officiel, avec un juriste.

1. **La loi camerounaise s'applique en entier.** Elle vise tout traitement d'un responsable établi au Cameroun. Le délai de mise en conformité de 18 mois a expiré le 23 juin 2026 : la loi est applicable aujourd'hui.
2. **L'hébergement dans l'UE est un transfert hors du Cameroun.** Tout transfert vers un État étranger demande une **autorisation préalable de l'Autorité** (article 32 selon plusieurs sources). L'Autorité vérifie le niveau de protection du pays et le contrat avec le destinataire. Un transfert sans autorisation est puni d'une amende. Conséquence : **aucune donnée réelle sur le serveur avant cette autorisation**, donc pas de bêta avec des familles réelles (T-068, T-109, T-111). Le développement continue avec des arbres générés.
3. **Le RGPD s'applique aussi, par la diaspora.** Une société hors de l'UE tombe sous le RGPD quand elle offre un service à des personnes qui se trouvent dans l'UE (article 3, paragraphe 2). C'est le cas de la diaspora en France. Il faut donc :
   - désigner un **représentant dans l'UE** (article 27) ;
   - tenir le registre et faire l'analyse d'impact (déjà prévus dans `docs/conformite/`) ;
   - notifier la CNIL sous 72 heures en cas de violation (ADM-06 le prévoit déjà).
4. **L'hébergeur européen est un sous-traitant.** Il est lui-même soumis au RGPD. Un contrat de sous-traitance (DPA) est signé avec chaque fournisseur : VPS, R2, transcription, compréhension, e-mails.
5. **Les fournisseurs hors UE ajoutent des transferts.** Claude (Anthropic), Expo Push, Apple et Google sont américains. La demande d'autorisation à l'Autorité doit les lister. Côté RGPD, il faut des clauses contractuelles types ou une décision d'adéquation. À vérifier avant T-075 et T-076 : la région de traitement proposée par chaque fournisseur.
6. **Comptes au nom de la société camerounaise** : stores (T-078), Apple (T-053), WhatsApp Business (T-044), registre de noms de domaine. Le nom d'expéditeur SMS se fait auprès d'un agrégateur local.
7. **Paiement (V3)** : un agrégateur camerounais (CinetPay, Notch Pay) va avec une société au Cameroun.

## Écarté

- **Société en France** : le RGPD seul aurait suffi pour l'hébergement dans l'UE, mais la loi camerounaise se serait appliquée quand même aux utilisateurs au Cameroun. Daniel a choisi le Cameroun.
- **Hébergement au Cameroun ou en Afrique** : il éviterait le transfert, mais coûterait plus cher pour moins de garanties de disponibilité et de sauvegarde. Tout reste en conteneurs Docker (TRD) : un déménagement reste possible si l'Autorité l'impose.

## Suites

- Rendez-vous avec un juriste : texte officiel, articles exacts, dossier d'autorisation de transfert, représentant dans l'UE.
- Déposer la demande d'autorisation dès que l'Autorité instruit les dossiers.
- Ajouter au registre des traitements la liste des sous-traitants et de leurs pays.
