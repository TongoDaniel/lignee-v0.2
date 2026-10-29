// Ce que Skia peint de la scène (T-017) : traits, fiches, pastilles, mentions. Aucune logique de
// parenté ni de disposition : tout vient de `TreeScene` et du thème. Les couleurs, tailles et
// épaisseurs viennent des tokens de la charte (packages/ui) ; les textes, de packages/i18n.
// Pendant la pousse (T-018), les traits se tracent et les personnes apparaissent selon un plan
// calculé hors de Skia (treeMotion.ts) ; hors pousse, rien ne bouge ici.
// Trois niveaux de détail suivent le zoom (TRD) : vue d'ensemble (points colorés), standard
// (avatar et prénom), détail (nom entier et années). Rien ne rebondit.
import {
  Circle,
  DashPathEffect,
  LinearGradient,
  Group,
  Path,
  RoundedRect,
  Text as SkiaText,
  vec,
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
import { memo, useMemo, type ReactNode } from 'react';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { cardLines, nameForLevel, pathData, plusPath } from './drawing';
import { lifespan, missingParentText } from './labels';
import type { PersonCard } from './personCards';
import { appearance, type Bezier, type EdgeGrowth, type GrowthPlan } from './treeMotion';

/** Polices de la charte chargées dans Skia (11-react-native.md) : prénom, ligne secondaire, initiale. */
export interface TreeFonts {
  readonly name: SkFont;
  readonly secondary: SkFont;
  readonly initial: SkFont;
}

/** Traits d'une fiche à l'autre : 2,5 px en `lien-arbre`, pointillés de 6 et 7 pour un lien supposé. */
const { drawing: measures } = componentMetrics.treeNode;
const SUPPOSED_DASH = [...measures.supposedDash];
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
        // Sous l'avatar doré, « Vous » ; les années ne concernent que les personnes décédées.
        name: you
          ? nameForLevel(undefined, level, { placeholder: t('common:treeScreen.you'), noName: '' })
          : nameForLevel(card, level, {
              placeholder: t('common:treeScreen.unknownPerson'),
              noName: t('common:treeScreen.noName'),
            }),
        secondary: you ? undefined : lifespan(card, t),
        width: spec.nodeWidth - spec.input.nodeGap / 2,
        maxLines: spec.input.nameLines,
        measure: (text) => textWidth(fonts.name, text),
        level,
      }),
    [card, level, spec, fonts.name, you, t],
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
            path={plusPath(x, y, spec.radius * measures.plusRadiusRatio)}
            style="stroke"
            color={colors.texteSecondaire}
            strokeWidth={stroke.icone}
            strokeCap="round"
          />
        </>
      ) : you ? (
        <>
          <Circle cx={x} cy={y} r={spec.radius}>
            <LinearGradient
              start={vec(x - spec.radius, y - spec.radius)}
              end={vec(x + spec.radius, y + spec.radius)}
              colors={[palette.or500, palette.or700]}
            />
          </Circle>
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
              y={y + fonts.initial.getSize() * measures.baseline.centered}
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
          y={
            nameTop +
            (index + 1) * spec.nameLineHeight -
            spec.nameLineHeight * measures.baseline.name
          }
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
            spec.secondaryLineHeight * measures.baseline.secondary
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
        path={plusPath(x, y, spec.radius * measures.plusRadiusRatio)}
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
          y={
            y +
            spec.nameTop +
            (index + 1) * spec.nameLineHeight -
            spec.nameLineHeight * measures.baseline.name
          }
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
          y={counter.y + fonts.name.getSize() * measures.baseline.centered}
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
      y={mark.y + spec.markLineHeight * measures.baseline.mark}
    />
  );
}

/** Pousse en cours : le temps écoulé (en millisecondes) et le plan qui dit quand chaque chose paraît. */
export interface TreeGrowth {
  readonly elapsed: SharedValue<number>;
  readonly plan: GrowthPlan;
}

/** Un trait qui se trace depuis l'origine, à son retard, selon la courbe des jetons. */
function GrowingEdge({
  edge,
  color,
  growth,
  elapsed,
  duration,
  easing,
}: {
  readonly edge: SceneEdge;
  readonly color: string;
  readonly growth: EdgeGrowth;
  readonly elapsed: SharedValue<number>;
  readonly duration: number;
  readonly easing: Bezier;
}) {
  const path = useMemo(
    () => pathData(growth.reversed ? [...edge.points].reverse() : edge.points),
    [edge, growth.reversed],
  );
  const [x1, y1, x2, y2] = easing;
  const end = useDerivedValue(() =>
    appearance(elapsed.value, growth.delay, duration, x1, y1, x2, y2),
  );
  return (
    <Path
      path={path}
      style="stroke"
      color={color}
      strokeWidth={stroke.lien}
      strokeJoin="round"
      strokeCap="round"
      start={0}
      end={end}
    >
      {edge.supposed ? <DashPathEffect intervals={SUPPOSED_DASH} /> : null}
    </Path>
  );
}

/** Fondu d'apparition (courbe de sortie, sans rebond) d'une personne ou d'un groupe. */
function Appear({
  delay,
  growth,
  children,
}: {
  readonly delay: number;
  readonly growth: TreeGrowth;
  readonly children: ReactNode;
}) {
  const { timing } = growth.plan;
  const [x1, y1, x2, y2] = timing.personEasing;
  const { elapsed } = growth;
  const opacity = useDerivedValue(() =>
    appearance(elapsed.value, delay, timing.person, x1, y1, x2, y2),
  );
  return <Group opacity={opacity}>{children}</Group>;
}

export interface SkiaTreeProps extends DrawProps {
  readonly culled: CulledScene;
  readonly cards: ReadonlyMap<Id, PersonCard>;
  /** « Vous » : l'avatar doré, même quand l'arbre est recentré sur une autre personne. */
  readonly youId: Id;
  readonly selectedId: Id | undefined;
  readonly missingOf: ReadonlyMap<string, 'mother' | 'father' | 'parent'>;
  /** Pousse en cours (T-018) ; absente : tout est dessiné d'un coup. */
  readonly growth?: TreeGrowth | undefined;
}

export function SkiaTree({
  culled,
  cards,
  youId,
  selectedId,
  missingOf,
  growth,
  ...draw
}: SkiaTreeProps) {
  const { theme, level } = draw;
  const people = culled.people.map((person) => {
    const shape = (
      <PersonShape
        key={person.id}
        person={person}
        card={cards.get(person.id)}
        you={person.id === youId}
        selected={person.id === selectedId}
        {...draw}
      />
    );
    const delay = growth?.plan.persons.get(person.id);
    return growth === undefined || delay === undefined ? (
      shape
    ) : (
      <Appear key={person.id} delay={delay} growth={growth}>
        {shape}
      </Appear>
    );
  });
  const others = (
    <>
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
  return (
    <>
      {culled.edges.map((edge, index) => {
        const grows = growth?.plan.edges.get(edge);
        return growth === undefined || grows === undefined ? (
          <EdgeShape key={`e${String(index)}`} edge={edge} color={theme.colors.lienArbre} />
        ) : (
          <GrowingEdge
            key={`e${String(index)}`}
            edge={edge}
            color={theme.colors.lienArbre}
            growth={grows}
            elapsed={growth.elapsed}
            duration={growth.plan.timing.edge}
            easing={growth.plan.timing.edgeEasing}
          />
        );
      })}
      {people}
      {growth?.plan.rest === undefined ? (
        others
      ) : (
        <Appear delay={growth.plan.rest} growth={growth}>
          {others}
        </Appear>
      )}
    </>
  );
}
