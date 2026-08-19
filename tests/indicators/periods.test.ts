import { describe, it, expect } from 'vitest';
import { generatePeriods, countPeriods } from '../../src/indicators/periods';

describe('generatePeriods', () => {
  it('sequential respects range and step', () => {
    const p = generatePeriods({ range: { min: 10, max: 20 }, mode: 'sequential', step: 2 });
    expect(p).toEqual([10, 12, 14, 16, 18, 20]);
  });

  it('sequential treats 0 as a boundary, not a period', () => {
    const p = generatePeriods({ range: { min: 0, max: 5 }, mode: 'sequential', step: 1 });
    expect(p).toEqual([1, 2, 3, 4, 5]);
  });

  it('fibonacci returns canonical subset in range', () => {
    const p = generatePeriods({ range: { min: 0, max: 100 }, mode: 'fibonacci', step: 1 });
    expect(p).toEqual([1, 2, 3, 5, 8, 13, 21, 34, 55, 89]);
  });

  it('divisible returns multiples of the divisor', () => {
    const p = generatePeriods({ range: { min: 0, max: 100 }, mode: 'divisible', step: 1, divisor: 25 });
    expect(p).toEqual([25, 50, 75, 100]);
  });

  it('count matches generated length', () => {
    const opts = { range: { min: 0, max: 1000 }, mode: 'divisible' as const, step: 1, divisor: 25 };
    expect(countPeriods(opts)).toBe(generatePeriods(opts).length);
  });

  it('rejects invalid step / divisor', () => {
    expect(() => generatePeriods({ range: { min: 0, max: 10 }, mode: 'sequential', step: 0 })).toThrow();
    expect(() => generatePeriods({ range: { min: 0, max: 10 }, mode: 'divisible', step: 1 })).toThrow();
  });
});
