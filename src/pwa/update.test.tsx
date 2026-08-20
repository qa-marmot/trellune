import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const register = vi.hoisted(() => ({
	options: undefined as
		| {
				immediate?: boolean;
				onNeedRefresh?: () => void;
				onRegisteredSW?: (
					swScriptUrl: string,
					registration: ServiceWorkerRegistration | undefined,
				) => void;
				onRegisterError?: (error: unknown) => void;
		  }
		| undefined,
	apply: vi.fn(async () => undefined),
}));

vi.mock('virtual:pwa-register', () => ({
	registerSW: (options: NonNullable<typeof register.options>) => {
		register.options = options;
		return register.apply;
	},
}));

import { configurePwaUpdates, usePwaUpdate } from './update';

function Harness() {
	const update = usePwaUpdate();
	return (
		<>
			<output>{update.status}</output>
			<button type="button" disabled={!update.available} onClick={() => void update.apply()}>
				更新
			</button>
			<button type="button" onClick={() => void update.check()}>
				確認
			</button>
		</>
	);
}

describe('consent-based PWA updates', () => {
	beforeEach(() => {
		register.options = undefined;
		register.apply.mockClear();
	});

	afterEach(() => {
		cleanup();
	});

	it('announces a waiting build and applies it only after an explicit click', async () => {
		configurePwaUpdates();
		render(<Harness />);
		expect(screen.getByRole('button', { name: '更新' })).toBeDisabled();
		expect(register.apply).not.toHaveBeenCalled();

		act(() => register.options?.onNeedRefresh?.());
		expect(screen.getByRole('button', { name: '更新' })).toBeEnabled();
		expect(screen.getByText('available')).toBeInTheDocument();
		expect(register.apply).not.toHaveBeenCalled();

		await act(async () => screen.getByRole('button', { name: '更新' }).click());
		expect(register.apply).toHaveBeenCalledWith(true);
	});

	it('checks for an updated worker without relying on a manual registration.update call', async () => {
		const update = vi.fn(async () => undefined);
		configurePwaUpdates();
		render(<Harness />);

		expect(register.options?.immediate).toBe(true);
		register.options?.onRegisteredSW?.('sw.js', {
			update,
		} as unknown as ServiceWorkerRegistration);
		await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(1));
		await act(async () => Promise.resolve());

		window.dispatchEvent(new Event('online'));
		await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(2));
		await vi.waitFor(() => expect(screen.getByText('ready')).toBeInTheDocument());

		await act(async () => screen.getByRole('button', { name: '確認' }).click());
		await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(3));
	});

	it('keeps an update-check failure visible without exposing request details', async () => {
		const update = vi.fn(async () => {
			throw new Error('Access token or deployment detail must not reach the UI');
		});
		configurePwaUpdates();
		render(<Harness />);
		register.options?.onRegisteredSW?.('sw.js', {
			update,
		} as unknown as ServiceWorkerRegistration);

		await vi.waitFor(() => expect(screen.getByText('error')).toBeInTheDocument());
		expect(screen.queryByText(/Access token/u)).not.toBeInTheDocument();
	});
});
