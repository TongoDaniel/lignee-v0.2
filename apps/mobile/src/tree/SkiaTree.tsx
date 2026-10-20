// Ce que Skia peint de la scène (T-017) : traits, fiches, pastilles, mentions. Aucune logique de
// parenté ni de disposition : tout vient de `TreeScene` et du thème. Les couleurs, tailles et
// épaisseurs viennent des tokens de la charte (packages/ui) ; les textes, de packages/i18n.
// Trois niveaux de détail suivent le zoom (TRD) : vue d'ensemble (points colorés), standard
// (avatar et prénom), détail (nom entier et années). Rien ne rebondit : pas d'animation ici.
import {
  Circle,
  DashPathEffect,
  Group,
  Path,
  RoundedRect,
  Text as SkiaText,
  type SkFont,
} from '@shopify/react-native-skia';
import type { Id } from '@lignee/domain';
import type {
  CulledScene,
  SceneCounter,
  SceneEdge,
  SceneMark,
  SceneMissing,
  ScenePerson,
  SceneSpec,
  ZoomLevel,
} from '@lignee/layout';
import {
  avatarTintColors,
  componentMetrics,
  defaultAvatarTintRule,
  palette,
  radius,
  stroke,
  type UiTheme,
} from '@lignee/ui';
import type { Translator } from '@lignee/i18n';
import { memo, useMemo } from 'react';

import { cardLines, nameForLevel, pathData, plusPath } from './drawing';
import { lifespan, missingParentText } from './labels';
import type { PersonCard } from './personCards';

/** Polices de la charte chargées dans Skia (11-react-native.md) : prénom, ligne secondaire, initiale. */
export interface TreeFonts {
  readonly name: SkFont;
  readonly secondary: SkFont;
  readonly initial: SkFont;
}

/** Traits d'une fiche à l'autre : 2,5 px en `lien-arbre`, pointillés de 6 et 7 pour un lien supposé. */
const SUPPOSED_DASH = [6, 7];
const DASH_PLUS = [stroke.icone * 2, stroke.icone * 2];

interface DrawProps {
  readonly spec: SceneSpec;
  readonly theme: UiTheme;
  readonly fonts: TreeFonts;
  readonly level: ZoomLevel;
  readonly t: Translator['t'];
}

function textWidth(font: SkFont, text: string): number {
  return font.measureText(text).width;
}

const EdgeShape = memo(function EdgeShape({
  edge,
  color,
}: {
  readonly edge: SceneEdge;
  readonly color: string;
}) {
  const path = useMemo(() => pathData(edge.points), [edge]);
  return (
    <Path
      path={path}
      style="stroke"
      color={color}
      strokeWidth={stroke.lien}
      strokeJoin="round"
      strokeCap="round"
    >
      {edge.supposed ? <DashPathEffect intervals={SUPPOSED_DASH} /> : null}
    </Path>
  );
});

function PersonShape({
  person,
  card,
  you,
  selected,
  spec,
  theme,
  fonts,
  level,
  t,
}: DrawProps & {
  readonly person: ScenePerson;
  readonly card: PersonCard | undefined;
  readonly you: boolean;
  readonly selected: boolean;
}) {
  const { colors } = theme;
  const { silhouette } = componentMetrics.avatar;
  const placeholder = card === undefined || card.placeholder;
  const tint = useMemo(
    () => avatarTintColors(defaultAvatarTintRule({ birthName: card?.birthName ?? '' }), colors),
    [card?.birthName, colors],
  );
  const lines = useMemo(
    () =>
      cardLines({
        name: nameForLevel(card, level, t('common:treeScreen.unknownPerson')),
        secondary: lifespan(card, t),
        width: spec.nodeWidth - spec.input.nodeGap / 2,
        maxLines: spec.input.nameLines,
        measure: (text) => textWidth(fonts.name, text),
        level,
      }),
    [card, level, spec, fonts.name, t],
  );
  const { x, y } = person;
  const diameter = spec.radius * 2;
  const initial = Array.from((card?.firstName ?? '').trim())[0]?.toLocaleUpperCase() ?? '';
  const nameTop = y + spec.nameTop;
  return (
    <Group>
      {selected ? (
        <Circle
          cx={x}
          cy={y}
          r={spec.radius + stroke.focus * 2}
          style="stroke"
          strokeWidth={stroke.focus}
          color={colors.focus}
        />
      ) : null}
      {placeholder ? (
        <>
          <Circle
            cx={x}
            cy={y}
            r={spec.radius}
            style="stroke"
            strokeWidth={componentMetrics.treeNode.unknownBorderWidth}
            color={colors.bordureChamp}
          >
            <DashPathEffect intervals={DASH_PLUS} />
          </Circle>
          <Path
            path={plusPath(x, y, spec.radius / 3)}
            style="stroke"
            color={colors.texteSecondaire}
            strokeWidth={stroke.icone}
            strokeCap="round"
          />
        </>
      ) : you ? (
        <>
          <Circle cx={x} cy={y} r={spec.radius} color={palette.or500} />
          <Group opacity={silhouette.opacity}>
            <Circle
              cx={x - spec.radius + diameter * (silhouette.headLeft + silhouette.headSize / 2)}
              cy={y - spec.radius + diameter * (silhouette.headTop + silhouette.headSize / 2)}
              r={(diameter * silhouette.headSize) / 2}
              color={palette.blanc}
            />
            <Circle
              cx={x - spec.radius + diameter * (silhouette.bodyLeft + silhouette.bodySize / 2)}
              cy={y - spec.radius + diameter * (silhouette.bodyTop + silhouette.bodySize / 2)}
              r={(diameter * silhouette.bodySize) / 2}
              color={palette.blanc}
            />
          </Group>
        </>
      ) : (
        <>
          <Circle cx={x} cy={y} r={spec.radius} color={tint.background} />
          {level !== 'overview' && initial !== '' ? (
            <SkiaText
              text={initial}
              font={fonts.initial}
              color={tint.text}
              x={x - textWidth(fonts.initial, initial) / 2}
              y={y + fonts.initial.getSize() * 0.35}
            />
          ) : null}
        </>
      )}
      {lines.name.map((line, index) => (
        <SkiaText
          key={`${String(index)}:${line}`}
          text={line}
          font={fonts.name}
          color={colors.texte}
          x={x - textWidth(fonts.name, line) / 2}
          y={nameTop + (index + 1) * spec.nameLineHeight - spec.nameLineHeight * 0.25}
        />
      ))}
      {lines.secondary === undefined ? null : (
        <SkiaText
          text={lines.secondary}
          font={fonts.secondary}
          color={colors.texteSecondaire}
          x={x - textWidth(fonts.secondary, lines.secondary) / 2}
          y={
            nameTop +
            lines.name.length * spec.nameLineHeight -
            spec.input.secondaryOverlap +
            spec.secondaryLineHeight * 0.8
          }
        />
      )}
    </Group>
  );
}

function MissingShape({
  place,
  missing,
  spec,
  theme,
  fonts,
  level,
  t,
}: DrawProps & {
  readonly place: SceneMissing;
  readonly missing: 'mother' | 'father' | 'parent';
}) {
  const { colors } = theme;
  const label = missingParentText(missing, t);
  const lines = cardLines({
    name: label,
    secondary: undefined,
    width: spec.nodeWidth - spec.input.nodeGap / 2,
    maxLines: spec.input.nameLines,
    measure: (text) => textWidth(fonts.name, text),
    level,
  });
  const { x, y } = place;
  return (
    <Group>
      <Circle
        cx={x}
        cy={y}
        r={spec.radius}
        style="stroke"
        strokeWidth={componentMetrics.treeNode.unknownBorderWidth}
        color={colors.bordureChamp}
      >
        <DashPathEffect intervals={DASH_PLUS} />
      </Circle>
      <Path
        path={plusPath(x, y, spec.radius / 3)}
        style="stroke"
        color={colors.texteSecondaire}
        strokeWidth={stroke.icone}
        strokeCap="round"
      />
      {lines.name.map((line, index) => (
        <SkiaText
          key={`${String(index)}:${line}`}
          text={line}
          font={fonts.name}
          color={colors.texteSecondaire}
          x={x - textWidth(fonts.name, line) / 2}
          y={y + spec.nameTop + (index + 1) * spec.nameLineHeight - spec.nameLineHeight * 0.25}
        />
      ))}
    </Group>
  );
}

function CounterShape({
  counter,
  spec,
  theme,
  fonts,
  level,
  t,
}: DrawProps & { readonly counter: SceneCounter }) {
  const { colors } = theme;
  const text = t('common:treeScreen.counterText', { count: String(counter.count) });
  const width = Math.max(spec.counterMinWidth, textWidth(fonts.name, text) + spec.counterHeight);
  return (
    <Group>
      <RoundedRect
        x={counter.x - width / 2}
        y={counter.y - spec.counterHeight / 2}
        width={width}
        height={spec.counterHeight}
        r={radius.pilule}
        color={colors.parenteDouce}
      />
      {level === 'overview' ? null : (
        <SkiaText
          text={text}
          font={fonts.name}
          color={colors.texte}
          x={counter.x - textWidth(fonts.name, text) / 2}
          y={counter.y + fonts.name.getSize() * 0.35}
        />
      )}
    </Group>
  );
}

function MarkShape({ mark, spec, theme, fonts, t }: DrawProps & { readonly mark: SceneMark }) {
  const text =
    mark.kind === 'seeAlso' ? t('common:treeScreen.seeAlso') : t('common:treeScreen.parentsMark');
  return (
    <SkiaText
      text={text}
      font={fonts.secondary}
      color={theme.colors.parente}
      x={mark.x - textWidth(fonts.secondary, text) / 2}
      y={mark.y + spec.markLineHeight * 0.3}
    />
  );
}

export interface SkiaTreeProps extends DrawProps {
  readonly culled: CulledScene;
  readonly cards: ReadonlyMap<Id, PersonCard>;
  readonly centerId: Id;
  readonly selectedId: Id | undefined;
  readonly missingOf: ReadonlyMap<string, 'mother' | 'father' | 'parent'>;
}

export function SkiaTree({
  culled,
  cards,
  centerId,
  selectedId,
  missingOf,
  ...draw
}: SkiaTreeProps) {
  const { theme, level } = draw;
  return (
    <>
      {culled.edges.map((edge, index) => (
        <EdgeShape key={`e${String(index)}`} edge={edge} color={theme.colors.lienArbre} />
      ))}
      {culled.people.map((person) => (
        <PersonShape
          key={person.id}
          person={person}
          card={cards.get(person.id)}
          you={person.id === centerId}
          selected={person.id === selectedId}
          {...draw}
        />
      ))}
      {culled.missing.map((place) => (
        <MissingShape
          key={place.familyKey}
          place={place}
          missing={missingOf.get(place.familyKey) ?? 'parent'}
          {...draw}
        />
      ))}
      {culled.counters.map((counter) => (
        <CounterShape key={counter.familyKey} counter={counter} {...draw} />
      ))}
      {level === 'overview'
        ? null
        : culled.marks.map((mark) => (
            <MarkShape key={`${mark.kind}:${mark.personId}`} mark={mark} {...draw} />
          ))}
    </>
  );
}
