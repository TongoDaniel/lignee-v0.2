// Lignée — API des composants de l'app (React Native). Documentation : ces types décrivent ce que chaque composant reçoit.
import type * as React from 'react';
import type { GestureResponderEvent } from 'react-native';

export type Teinte = 'vert' | 'or' | 'lagon' | 'lilas' | 'ciel' | 'terre';
export interface Personne { prenom: string; nomNaissance: string; nomUsage?: string; photo?: string; naissance?: string; deces?: string }

export interface BoutonProps { libelle: string; variante?: 'principal' | 'secondaire' | 'discret' | 'fete' | 'danger'; icone?: string; compact?: boolean; large?: boolean; desactive?: boolean; onPress: (e: GestureResponderEvent) => void }
export declare function Bouton(props: BoutonProps): React.ReactElement;

export interface PuceProps { libelle: string; teinte?: 'vert' | 'parente' | 'fete' | 'sante' | 'memoire' | 'documents' | 'neutre'; icone?: string }
export declare function Puce(props: PuceProps): React.ReactElement;

export interface CarteProps { titre?: string; texte?: string; vignette?: { icone: string; teinte: 'fete' | 'memoire' | 'documents' | 'parente' }; onPress?: () => void; children?: React.ReactNode }
export declare function Carte(props: CarteProps): React.ReactElement;

export interface ChampProps { libelle: string; valeur: string; onChangeText: (v: string) => void; exemple?: string; erreur?: string; micro?: boolean; clavier?: 'texte' | 'nombre' | 'date' | 'email' }
export declare function Champ(props: ChampProps): React.ReactElement;

export interface InterrupteurProps { libelle: string; explication?: string; valeur: boolean; onValueChange: (v: boolean) => void; sante?: boolean }
export declare function Interrupteur(props: InterrupteurProps): React.ReactElement;

export interface OngletsFicheProps { actif: 'souvenirs' | 'documents' | 'sante'; onChange: (o: OngletsFicheProps['actif']) => void }
export declare function OngletsFiche(props: OngletsFicheProps): React.ReactElement;

export interface BarreOngletsProps { actif: 'arbre' | 'famille' | 'sante' | 'memoire' }
export declare function BarreOnglets(props: BarreOngletsProps): React.ReactElement;

export interface EnTeteProps { titre: string; sousTitre?: string; retour?: boolean; action?: React.ReactNode }
export declare function EnTete(props: EnTeteProps): React.ReactElement;

export interface AvatarProps { personne?: Personne; vous?: boolean; taille?: 's' | 'm' | 'l' | 'xl'; neutre?: boolean }
export declare function Avatar(props: AvatarProps): React.ReactElement;
/** Teinte d'un avatar : somme des codes de caractères du nom de naissance, modulo 6. */
export declare function teintePour(nomNaissance: string): Teinte;

export interface NoeudArbreProps { personne?: Personne; vous?: boolean; lien?: string; etat?: 'normal' | 'chemin' | 'attenue' | 'anniversaire' | 'inconnu'; place?: string; sante?: boolean; onPress?: () => void; onLongPress?: () => void }
export declare function NoeudArbre(props: NoeudArbreProps): React.ReactElement;

export interface LigneReglageProps { icone: string; couleurIcone?: 'texte' | 'action' | 'fete' | 'sante-texte' | 'memoire' | 'parente' | 'documents'; libelle: string; valeur?: string; onPress: () => void }
export declare function LigneReglage(props: LigneReglageProps): React.ReactElement;

export interface ToastProps { message: string; persistant?: boolean }
export declare function Toast(props: ToastProps): React.ReactElement;

export interface FeuilleProps { titre: string; sousTitre?: string; ouverte: boolean; onClose: () => void; children: React.ReactNode }
export declare function Feuille(props: FeuilleProps): React.ReactElement;

export interface NotificationProps { titre: string; texte?: string; moment?: string }
export declare function Notification(props: NotificationProps): React.ReactElement;

export interface MentionPriveeProps { cercle: 'vous' | 'famille' | 'responsables' | string[]; nomArbre?: string; sante?: boolean }
export declare function MentionPrivee(props: MentionPriveeProps): React.ReactElement;
