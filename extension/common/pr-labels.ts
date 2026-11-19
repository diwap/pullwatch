import type { PrLabel } from './types';

const MAX_VISIBLE_LABELS = 3;

/** Parse GitHub's 6-char hex (optional `#`) into `#rrggbb`, or null if invalid. */
export function normalizeLabelColor(color: string | undefined): string | null {
  if (!color) return null;
  const hex = color.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  return `#${hex.toLowerCase()}`;
}

/**
 * GitHub-style readable text on a label background (YIQ).
 * Returns `#000000` or `#ffffff`.
 */
export function labelForeground(bgHexWithHash: string): '#000000' | '#ffffff' {
  const hex = bgHexWithHash.replace(/^#/, '');
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? '#000000' : '#ffffff';
}

export function normalizePrLabels(
  input: Array<PrLabel | string> | null | undefined
): PrLabel[] {
  if (!input?.length) return [];
  const out: PrLabel[] = [];
  const seen = new Set<string>();
  for (const item of input) {
    const name = (typeof item === 'string' ? item : item?.name)?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const color =
      typeof item === 'string' ? undefined : normalizeLabelColor(item.color)?.slice(1);
    out.push(color ? { name, color } : { name });
  }
  return out;
}

export function visiblePrLabels(labels: PrLabel[], max = MAX_VISIBLE_LABELS): {
  shown: PrLabel[];
  overflow: number;
} {
  if (labels.length <= max) return { shown: labels, overflow: 0 };
  return { shown: labels.slice(0, max), overflow: labels.length - max };
}
