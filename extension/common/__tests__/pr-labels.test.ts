import { describe, expect, it } from 'vitest';
import {
  labelForeground,
  normalizeLabelColor,
  normalizePrLabels,
  visiblePrLabels,
} from '../pr-labels';

describe('normalizeLabelColor / labelForeground', () => {
  it('normalizes hex and picks readable text', () => {
    expect(normalizeLabelColor('b60205')).toBe('#b60205');
    expect(normalizeLabelColor('#B60205')).toBe('#b60205');
    expect(normalizeLabelColor('nope')).toBeNull();
    expect(labelForeground('#b60205')).toBe('#ffffff');
    expect(labelForeground('#ededed')).toBe('#000000');
  });
});

describe('normalizePrLabels / visiblePrLabels', () => {
  it('dedupes and caps visible labels', () => {
    expect(
      normalizePrLabels([
        { name: 'do-not-merge/hold', color: 'b60205' },
        'do-not-merge/hold',
        { name: '  ', color: 'fff' },
      ])
    ).toEqual([{ name: 'do-not-merge/hold', color: 'b60205' }]);

    const many = normalizePrLabels(['a', 'b', 'c', 'd']);
    expect(visiblePrLabels(many)).toEqual({
      shown: [{ name: 'a' }, { name: 'b' }, { name: 'c' }],
      overflow: 1,
    });
  });
});
