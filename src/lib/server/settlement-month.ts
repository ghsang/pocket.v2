const SETTLEMENT_TIME_ZONE = 'Asia/Seoul';

export interface SettlementMonth {
	start: string;
	end: string;
	label: string;
}

function getYearAndMonth(now: Date): { year: number; month: number } {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: SETTLEMENT_TIME_ZONE,
		year: 'numeric',
		month: 'numeric'
	}).formatToParts(now);
	const year = Number(parts.find((part) => part.type === 'year')?.value);
	const month = Number(parts.find((part) => part.type === 'month')?.value);

	if (!Number.isInteger(year) || !Number.isInteger(month)) {
		throw new Error('Failed to determine the settlement month');
	}

	return { year, month };
}

// 월간 정산은 서울 기준 현재 월의 바로 이전 달을 대상으로 한다.
export function getSettlementMonth(now = new Date()): SettlementMonth {
	const current = getYearAndMonth(now);
	const year = current.month === 1 ? current.year - 1 : current.year;
	const month = current.month === 1 ? 12 : current.month - 1;
	const paddedMonth = String(month).padStart(2, '0');
	const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

	return {
		start: `${year}-${paddedMonth}-01`,
		end: `${year}-${paddedMonth}-${String(lastDay).padStart(2, '0')}`,
		label: `${year}년 ${month}월`
	};
}
