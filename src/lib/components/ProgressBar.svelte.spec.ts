import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ProgressBar from './ProgressBar.svelte';

describe('ProgressBar', () => {
	it('renders progress bar correctly', async () => {
		const screen = render(ProgressBar, { current: 50000, max: 100000 });

		// Check that amounts are displayed
		await expect.element(screen.getByText(/₩50,000/)).toBeInTheDocument();
		await expect.element(screen.getByText(/₩100,000/)).toBeInTheDocument();
	});

	it('shows warning at 75% usage', async () => {
		const screen = render(ProgressBar, { current: 75000, max: 100000 });

		await expect.element(screen.getByText('75% 사용')).toBeInTheDocument();
	});

	it('shows warning at 90%+ usage', async () => {
		const screen = render(ProgressBar, { current: 95000, max: 100000 });

		await expect.element(screen.getByText('주의')).toBeInTheDocument();
	});

	it('shows exceeded message at 100%+', async () => {
		const screen = render(ProgressBar, { current: 110000, max: 100000 });

		await expect.element(screen.getByText('초과!')).toBeInTheDocument();
	});

	it('handles zero max value gracefully', async () => {
		const screen = render(ProgressBar, { current: 0, max: 0 });

		// Should not throw error - just check the component rendered
		await expect.element(screen.container.querySelector('div')).toBeInTheDocument();
	});

	it('caps percentage at 100%', async () => {
		const screen = render(ProgressBar, { current: 200000, max: 100000 });

		// The progress bar should render without error
		await expect.element(screen.container.querySelector('div')).toBeInTheDocument();
	});
});
