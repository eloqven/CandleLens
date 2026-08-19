import { describe, it, expect } from 'vitest';
import { sma } from '../../src/indicators/ma';
import { ema } from '../../src/indicators/ema';
import { wma } from '../../src/indicators/wma';

describe('sma', () => {
  it('computes correct means', () => {
    const r = sma([1, 2, 3, 4, 5], 3);
    expect(Array.from(r)).toEqual([NaN, NaN, 2, 3, 4]);
  });
  it('returns NaN when series too short', () => {
    expect(Array.from(sma([1, 2], 3).filter((v) => Number.isNaN(v)))).toHaveLength(2);
  });
  it('rejects non-positive period', () => {
    expect(() => sma([1, 2, 3], 0)).toThrow();
  });
});

describe('ema', () => {
  it('equals constant price', () => {
    const r = ema([5, 5, 5, 5, 5], 3);
    expect(r[2]).toBeCloseTo(5);
    expect(r[4]).toBeCloseTo(5);
  });
  it('matches hand calculation', () => {
    const r = ema([1, 2, 3, 4, 5], 3); // k = 0.5
    expect(r[2]).toBeCloseTo(2);
    expect(r[3]).toBeCloseTo(3);
    expect(r[4]).toBeCloseTo(4);
  });
});

describe('wma', () => {
  it('weights recent prices more', () => {
    const r = wma([1, 2, 3, 4, 5], 3); // weights 1,2,3
    expect(r[2]).toBeCloseTo(14 / 6);
    expect(r[3]).toBeCloseTo(20 / 6);
    expect(r[4]).toBeCloseTo(26 / 6);
  });
  it('rejects non-positive period', () => {
    expect(() => wma([1, 2, 3], -1)).toThrow();
  });
});
