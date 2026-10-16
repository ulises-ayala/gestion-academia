import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../app/tokens.css', import.meta.url), 'utf8');
const [lightCss = '', darkCss = ''] = css.split(":root[data-theme='dark']");
const colors = (source: string) =>
  Object.fromEntries(
    [...source.matchAll(/--([\w-]+):\s*(#[\da-f]{3,6});/gi)].map(([, name, value]) => [
      name,
      value,
    ]),
  );
const light = colors(lightCss);
const themes = { light, dark: { ...light, ...colors(darkCss) } };

function luminance(hex: string) {
  const full =
    hex.length === 4 ? [...hex.slice(1)].map((char) => char + char).join('') : hex.slice(1);
  const channelAt = (index: number) => {
    const channel = parseInt(full.slice(index, index + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  return channelAt(0) * 0.2126 + channelAt(2) * 0.7152 + channelAt(4) * 0.0722;
}

function contrast(a: string, b: string) {
  const first = luminance(a);
  const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

describe.each(Object.entries(themes))('%s base token contrast', (_, theme) => {
  it('meets AA for normal-sized text and links on neutral surfaces', () => {
    for (const background of [
      'background',
      'surface',
      'surface-secondary',
      'surface-elevated',
      'surface-hover',
    ]) {
      for (const foreground of ['text', 'text-secondary', 'text-muted', 'accent', 'accent-hover']) {
        expect(
          contrast(theme[foreground], theme[background]),
          `${foreground} / ${background}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('meets AA for primary/destructive buttons and semantic state labels', () => {
    for (const fill of [
      'accent-fill',
      'accent-fill-hover',
      'destructive-fill',
      'destructive-fill-hover',
    ]) {
      expect(contrast(theme['brand-on-fill'], theme[fill]), fill).toBeGreaterThanOrEqual(4.5);
    }
    for (const tone of ['success', 'warning', 'destructive', 'info']) {
      expect(contrast(theme[tone], theme[`${tone}-soft`]), tone).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(theme.accent, theme['accent-muted'])).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps control boundaries and focus visible against neutral surfaces', () => {
    for (const surface of ['background', 'surface', 'surface-secondary', 'surface-elevated']) {
      for (const token of ['border-strong', 'accent']) {
        expect(
          contrast(theme[token], theme[surface]),
          `${token} / ${surface}`,
        ).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
