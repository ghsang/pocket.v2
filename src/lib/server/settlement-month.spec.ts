import { describe, expect, it } from 'vitest';
import { getSettlementMonth } from './settlement-month';

describe('getSettlementMonth', () => {
	it('switches the target month at midnight in Seoul', () => {
		const beforeMidnight = getSettlementMonth(new Date('2026-08-31T14:59:59.000Z'));
		const afterMidnight = getSettlementMonth(new Date('2026-08-31T15:00:00.000Z'));

		expect(beforeMidnight).toEqual({
			start: '2026-07-01',
			end: '2026-07-31',
			label: '2026년 7월'
		});
		expect(afterMidnight).toEqual({
			start: '2026-08-01',
			end: '2026-08-31',
			label: '2026년 8월'
		});
	});

	it('crosses the year boundary correctly', () => {
		const result = getSettlementMonth(new Date('2026-01-15T03:00:00.000Z'));

		expect(result).toEqual({
			start: '2025-12-01',
			end: '2025-12-31',
			label: '2025년 12월'
		});
	});

	it('calculates leap-year month endings', () => {
		const result = getSettlementMonth(new Date('2024-03-15T03:00:00.000Z'));

		expect(result.end).toBe('2024-02-29');
	});
});
