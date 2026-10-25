// Fonctions pures du dessin (T-017) : retour à la ligne, niveaux de zoom, boutons « + » et « − »
// (ACC-06), fenêtre, mesures et contrat de la disposition.
import { describe, expect, it } from 'vitest';

import { referenceSpec } from '../test-support/scene-checks';
import { canZoom, clampScale, zoomLevelFor, zoomStep } from './levels';
import { buildSceneSpec, sceneSpecIssues } from './spec';
import { wrapText } from './text';
import {
  clampViewport,
  fitViewport,
  needsRedraw,
  placeAt,
  toScreen,
  toWorld,
  visibleRect,
  zoomAbout,
} from './viewport';

const measure = (text: string) => Array.from(text).length * 10;

describe('wrapText', () => {
  it('tient sur une ligne quand la largeur suffit', () => {
    expect(wrapText('Claire', 100, measure, 2)).toEqual({ lines: ['Claire'], truncated: false });
  });
  it('coupe aux espaces et aux traits d’union', () => {
    expect(wrapText('Marie-Antoinette', 100, measure, 2).lines).toEqual(['Marie-', 'Antoinette']);
    expect(wrapText('Ana Maria', 60, measure, 2).lines).toEqual(['Ana', 'Maria']);
  });
  it('coupe un mot trop long et termine par « … » au-delà du nombre de lignes', () => {
    const result = wrapText('Anastasiaaaaaaaaaaaaaaaa', 60, measure, 2);
    expect(result.truncated).toBe(true);
    expect(result.lines).toHaveLength(2);
    expect(result.lines[1]?.endsWith('…')).toBe(true);
    for (const line of result.lines) expect(measure(line)).toBeLessThanOrEqual(60);
  });
  it('un texte vide ne donne aucune ligne', () => {
    expect(wrapText('   ', 60, measure, 2)).toEqual({ lines: [], truncated: false });
  });
});

describe('contrat de la disposition (ADR 0016, règle 9)', () => {
  it('toute combinaison de texte et de zone touchable respecte le contrat', () => {
    for (const textScale of [1, 1.3, 2, 2.6]) {
      for (const touchTarget of [48, 56]) {
        const spec = referenceSpec({ textScale, touchTarget });
        expect(sceneSpecIssues(spec)).toEqual([]);
        expect(spec.cardHeight).toBeLessThan(spec.unitY / 2);
        expect(spec.nodeWidth).toBeLessThan(spec.unitX);
      }
    }
  });
  it('détecte une pastille que le dégagement ne loge pas', () => {
    const spec = buildSceneSpec({ ...referenceSpec().input, connectorGap: 10 });
    expect(sceneSpecIssues(spec)).toContain(
      'The connector gap cannot hold the folded-family counter',
    );
  });
  it('le texte agrandi agrandit la grille', () => {
    expect(referenceSpec({ textScale: 2 }).unitX).toBeGreaterThan(referenceSpec().unitX);
    expect(referenceSpec({ textScale: 2 }).unitY).toBeGreaterThan(referenceSpec().unitY);
  });
});

describe('niveaux de zoom et boutons (ARB-02, ACC-06)', () => {
  const { zoom } = referenceSpec();
  it('trois niveaux suivent les tailles d’avatar de la charte', () => {
    expect(zoomLevelFor(zoom.min, zoom)).toBe('overview');
    expect(zoomLevelFor(1, zoom)).toBe('standard');
    expect(zoomLevelFor(zoom.max, zoom)).toBe('detail');
    expect(58 * zoom.overviewBelow).toBeCloseTo(40, 6);
    expect(58 * zoom.detailFrom).toBeCloseTo(88, 6);
  });
  it('« + » monte de cran en cran jusqu’à la butée, « − » redescend', () => {
    let scale = zoom.min;
    const seen = [scale];
    while (canZoom(scale, 1, zoom)) {
      scale = zoomStep(scale, 1, zoom);
      seen.push(scale);
    }
    expect(seen).toEqual([...zoom.stops]);
    expect(zoomStep(zoom.max, 1, zoom)).toBe(zoom.max);
    expect(zoomStep(1, -1, zoom)).toBe(zoom.overviewBelow);
    expect(canZoom(zoom.min, -1, zoom)).toBe(false);
    expect(new Set(seen.map((s) => zoomLevelFor(s, zoom)))).toEqual(
      new Set(['overview', 'standard', 'detail']),
    );
  });
  it('l’échelle reste dans les butées', () => {
    expect(clampScale(100, zoom)).toBe(zoom.max);
    expect(clampScale(0, zoom)).toBe(zoom.min);
  });
});

describe('fenêtre sur le dessin', () => {
  const { zoom } = referenceSpec();
  const size = { width: 360, height: 800 };
  it('écran et monde sont réciproques', () => {
    const viewport = { scale: 0.8, x: 40, y: -120 };
    const world = toWorld(viewport, { x: 100, y: 200 });
    const back = toScreen(viewport, world);
    expect(back.x).toBeCloseTo(100, 9);
    expect(back.y).toBeCloseTo(200, 9);
  });
  it('le zoom garde le point sous le doigt', () => {
    const viewport = { scale: 1, x: 10, y: 20 };
    const focus = { x: 180, y: 400 };
    const before = toWorld(viewport, focus);
    const next = zoomAbout(viewport, 1.5, focus, zoom);
    const after = toWorld(next, focus);
    expect(after.x).toBeCloseTo(before.x, 9);
    expect(after.y).toBeCloseTo(before.y, 9);
    expect(next.scale).toBe(1.5);
  });
  it('la zone visible grandit avec la marge et rétrécit avec le zoom', () => {
    const viewport = { scale: 2, x: 0, y: 0 };
    const plain = visibleRect(viewport, size);
    const wide = visibleRect(viewport, size, 1);
    expect(plain.right - plain.left).toBe(180);
    expect(wide.right - wide.left).toBe(540);
  });
  it('ajuste tout le contenu à l’écran, dans les butées', () => {
    const content = { left: 0, top: 0, right: 3600, bottom: 800 };
    const fit = fitViewport(content, size, 16, zoom);
    expect(fit.scale).toBeGreaterThanOrEqual(zoom.min);
    const visible = visibleRect(fit, size);
    if (fit.scale > zoom.min) {
      expect(visible.left).toBeLessThanOrEqual(content.left);
      expect(visible.right).toBeGreaterThanOrEqual(content.right);
    }
  });
  it('le dessin n’est jamais perdu de vue', () => {
    const content = { left: 0, top: 0, right: 500, bottom: 500 };
    const lost = clampViewport(placeAt(1, { x: 9000, y: 9000 }, { x: 180, y: 400 }), size, content);
    const center = toWorld(lost, { x: 180, y: 400 });
    expect(center.x).toBeLessThanOrEqual(500 + 180);
    expect(center.y).toBeLessThanOrEqual(500 + 400);
    const fine = { scale: 1, x: 0, y: 0 };
    expect(clampViewport(fine, size, content)).toBe(fine);
  });
  it('ne redessine que lorsque l’écran sort de la zone préparée', () => {
    const viewport = { scale: 1, x: 0, y: 0 };
    const prepared = visibleRect(viewport, size, 1);
    expect(needsRedraw(prepared, visibleRect(viewport, size))).toBe(false);
    expect(needsRedraw(prepared, visibleRect({ scale: 1, x: -1000, y: 0 }, size))).toBe(true);
    expect(needsRedraw(prepared, visibleRect({ scale: 0.5, x: 0, y: 0 }, size, 1))).toBe(true);
  });
});
