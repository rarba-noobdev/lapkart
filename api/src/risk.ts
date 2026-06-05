export function scoreFraud(input: {
	failedPayments?: number;
	orderValue?: number;
	accountAgeDays?: number;
}) {
	let score = 5;
	if ((input.failedPayments ?? 0) >= 3) score += 35;
	if ((input.orderValue ?? 0) > 75_000) score += 20;
	if ((input.accountAgeDays ?? 0) < 7) score += 15;
	return {
		score,
		risk: score > 60 ? 'high' : score > 30 ? 'medium' : 'low'
	};
}
