// Parcours de l'arbre en liste (T-017 ; TRD, « Accessibilité » ; ACC-06). Équivalent du dessin
// pour TalkBack et VoiceOver, et pour qui ne pince ni ne glisse : personne par personne, avec ses
// parents, ses conjoints dans l'ordre des rangs et leurs enfants foyer par foyer. Chaque nom est
// un bouton qui amène à cette personne. Les noms viennent du graphe déjà filtré pour le lecteur.
import type { Id } from '@lignee/domain';
import type { OutlineEntry, OutlineUnion } from '@lignee/layout';
import { Button, space, useTheme } from '@lignee/ui';
import { ScrollView, Text, View } from 'react-native';

import { useTranslator } from '../i18n/I18nProvider';
import { fullName, lifespan, missingParentText, personLabel } from './labels';
import type { PersonCard } from './personCards';

export interface TreeOutlineListProps {
  readonly outline: ReadonlyMap<Id, OutlineEntry>;
  readonly cards: ReadonlyMap<Id, PersonCard>;
  readonly focusId: Id;
  /** « Vous » : sa fiche est annoncée comme telle. */
  readonly centerId: Id;
  readonly onFocus: (id: Id) => void;
  /** Replie ou déplie un foyer (ou les parents d'une branche repliée) sur le dessin. */
  readonly onToggleFamily: (familyKey: string) => void;
  readonly testID?: string;
}

export function TreeOutlineList({
  outline,
  cards,
  focusId,
  centerId,
  onFocus,
  onToggleFamily,
  testID,
}: TreeOutlineListProps) {
  const { colors, typography } = useTheme();
  const { t } = useTranslator();
  const entry = outline.get(focusId);
  const name = (id: Id) => fullName(cards.get(id), t);
  const heading = [typography.titreCarte, { color: colors.texte }];
  const body = [typography.corps, { color: colors.texte }];
  const note = [typography.secondaire, { color: colors.texteSecondaire }];

  const person = (id: Id) => (
    <Button
      key={id}
      testID={`outline-go-${id}`}
      label={name(id)}
      accessibilityLabel={t('common:treeScreen.list.goTo', {
        name: personLabel(cards.get(id), { you: id === centerId }, t),
      })}
      accessibilityHint={t('common:treeScreen.list.goToHint')}
      variant="quiet"
      compact
      onPress={() => {
        onFocus(id);
      }}
    />
  );

  const union = (item: OutlineUnion) => {
    const partner = item.partnerId === undefined ? undefined : name(item.partnerId);
    const title =
      item.kind === 'unspecified'
        ? t('common:treeScreen.list.householdUnspecified', {
            place: missingParentText(item.missing ?? 'parent', t),
          })
        : t(
            item.ended
              ? 'common:treeScreen.list.householdEnded'
              : 'common:treeScreen.list.household',
            { name: partner ?? '' },
          );
    return (
      <View
        key={item.familyKey}
        style={{ gap: space[1] }}
        testID={`outline-union-${item.familyKey}`}
      >
        <Text accessibilityRole="header" style={heading}>
          {title}
        </Text>
        {item.partnerId === undefined ? null : person(item.partnerId)}
        {item.childIds.length === 0 ? (
          <Text style={note}>{t('common:treeScreen.list.noChildren')}</Text>
        ) : (
          <>
            <Text style={note}>{t('common:treeScreen.list.children')}</Text>
            {item.childIds.map((childId) => person(childId))}
          </>
        )}
        {item.childIds.length === 0 ? null : (
          <Button
            testID={`outline-toggle-${item.familyKey}`}
            label={
              item.folded ? t('common:treeScreen.list.unfold') : t('common:treeScreen.list.fold')
            }
            variant="secondary"
            compact
            onPress={() => {
              onToggleFamily(item.familyKey);
            }}
          />
        )}
      </View>
    );
  };

  if (entry === undefined) {
    return (
      <View testID={testID} style={{ padding: space.margeEcran }}>
        <Text style={body}>{t('common:treeScreen.list.empty')}</Text>
      </View>
    );
  }
  const years = lifespan(cards.get(focusId), t);
  return (
    <ScrollView
      testID={testID}
      contentContainerStyle={{ padding: space.margeEcran, gap: space[5] }}
    >
      <View style={{ gap: space[1] }}>
        <Text style={[typography.secondaire, { color: colors.texteSecondaire }]}>
          {t('common:treeScreen.list.focus')}
        </Text>
        <Text
          accessibilityRole="header"
          accessibilityLabel={personLabel(cards.get(focusId), { you: focusId === centerId }, t)}
          accessibilityHint={t('common:treeScreen.list.focusHint')}
          style={[typography.titreSection, { color: colors.texte }]}
        >
          {name(focusId)}
        </Text>
        {years === undefined ? null : <Text style={body}>{years}</Text>}
        {entry.drawn ? null : (
          <Text style={note}>{t('common:treeScreen.list.hiddenFromDrawing')}</Text>
        )}
      </View>

      {entry.parents.map((parents) => (
        <View key={parents.familyKey} style={{ gap: space[1] }}>
          <Text accessibilityRole="header" style={heading}>
            {t('common:treeScreen.list.parentsOf', { name: name(focusId) })}
          </Text>
          {parents.parentIds.map((id) => person(id))}
          {parents.missing === undefined ? null : (
            <Text style={body}>{missingParentText(parents.missing, t)}</Text>
          )}
        </View>
      ))}
      {entry.foldedParentsKey === undefined ? null : (
        <Button
          testID="outline-unfold-parents"
          label={t('common:treeScreen.list.unfoldParents')}
          variant="secondary"
          compact
          onPress={() => {
            if (entry.foldedParentsKey !== undefined) onToggleFamily(entry.foldedParentsKey);
          }}
        />
      )}

      {entry.unions.length === 0 ? null : (
        <View style={{ gap: space[4] }}>
          <Text
            accessibilityRole="header"
            style={[typography.titreSection, { color: colors.texte }]}
          >
            {t('common:treeScreen.list.spouses')}
          </Text>
          {entry.unions.map(union)}
        </View>
      )}

      {entry.links.length === 0 ? null : (
        <View style={{ gap: space[1] }}>
          <Text accessibilityRole="header" style={heading}>
            {t('common:treeScreen.list.otherLinks')}
          </Text>
          {entry.links.map((link) => (
            <Button
              key={`${link.nature}-${link.otherId}`}
              testID={`outline-link-${link.otherId}`}
              label={
                link.seeAlso
                  ? t('common:treeScreen.list.seeAlsoEntry', { name: name(link.otherId) })
                  : t('common:treeScreen.list.secondaryEntry', { name: name(link.otherId) })
              }
              variant="quiet"
              compact
              onPress={() => {
                onFocus(link.otherId);
              }}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}
