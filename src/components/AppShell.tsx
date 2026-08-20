import { type PropsWithChildren, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Icon } from './Icon';
import { useAppState } from '../state/AppState';
import { usePwaUpdate } from '../pwa/update';
import { isDemoMode } from '../demo';
import { resetDemoData } from '../storage/db';
import { useLocale } from '../i18n';

export function AppShell({ children }: PropsWithChildren) {
	const { data, editorDirty } = useAppState();
	const { locale, setLocale, t } = useLocale();
	const pwaUpdate = usePwaUpdate();
	const navItems = [
		{ to: '/today', label: t('nav.today'), icon: 'today' as const },
		{ to: '/curriculum', label: t('nav.learn'), icon: 'learn' as const },
		{ to: '/reviews', label: t('nav.reviews'), icon: 'review' as const },
		{ to: '/voice', label: t('nav.conversation'), icon: 'bridge' as const },
		{ to: '/settings', label: t('nav.settings'), icon: 'settings' as const },
	];
	const [online, setOnline] = useState(() => navigator.onLine);
	const [demoResetting, setDemoResetting] = useState(false);
	useEffect(() => {
		if (isDemoMode) {
			setOnline(true);
			return;
		}
		let active = true;
		const refresh = async () => {
			if (!navigator.onLine) {
				if (active) setOnline(false);
				return;
			}
			try {
				const response = await fetch('/api/v1/health', {
					cache: 'no-store',
					headers: { accept: 'application/json' },
				});
				if (active) setOnline(response.ok);
			} catch {
				if (active) setOnline(false);
			}
		};
		void refresh();
		const timer = window.setInterval(() => void refresh(), 15_000);
		window.addEventListener('online', refresh);
		window.addEventListener('offline', refresh);
		return () => {
			active = false;
			window.clearInterval(timer);
			window.removeEventListener('online', refresh);
			window.removeEventListener('offline', refresh);
		};
	}, []);
	const completed = Object.values(data.core).filter(Boolean).length;
	return (
		<div className="app-shell">
			<a className="skip-link" href="#main-content">
				{t('skip.main')}
			</a>
			<header className="topbar">
				<NavLink className="wordmark" to="/today" aria-label={t('home.aria')}>
					<span className="wordmark__mark">TL</span>
					<span>Trellune</span>
				</NavLink>
				<nav className="desktop-nav" aria-label={t('nav.main')}>
					{navItems.map((item) => (
						<NavLink
							key={item.to}
							to={item.to}
							className={({ isActive }) => `nav-link${isActive ? ' is-active' : ''}`}
						>
							{item.label}
						</NavLink>
					))}
				</nav>
				<div className="topbar__status" aria-label={`Core ${completed}/3 ${t('core.complete')} `}>
					<span className={online ? 'network-dot' : 'network-dot is-offline'}>
						{online ? t('online') : t('offline')}
					</span>
					<span>{completed}/3</span>
					<span className="topbar__status-label">CORE</span>
				</div>
				<label className="locale-select">
					<span className="sr-only">{t('language.label')}</span>
					<select
						value={locale}
						onChange={(event) => setLocale(event.target.value as typeof locale)}
						aria-label={t('language.label')}
					>
						<option value="ja">{t('language.ja')}</option>
						<option value="en">{t('language.en')}</option>
					</select>
				</label>
			</header>
			{isDemoMode ? (
				<div className="demo-banner" role="status">
					<span>{t('demo.banner')}</span>
					<button
						className="button"
						type="button"
						disabled={demoResetting}
						onClick={() => {
							setDemoResetting(true);
							void resetDemoData().finally(() => {
								window.location.assign('/today');
							});
						}}
					>
						{demoResetting ? t('demo.resetting') : t('demo.reset')}
					</button>
					<button
						className="button"
						type="button"
						onClick={() => {
							window.location.assign('/curriculum/6');
						}}
					>
						{t('demo.readingExample')}
					</button>
					<a
						className="button"
						href="https://github.com/qa-marmot/trellune"
						target="_blank"
						rel="noreferrer"
					>
						{t('demo.github')}
					</a>
					<small>{t('demo.curriculumNotice')}</small>
				</div>
			) : null}
			{pwaUpdate.available ? (
				<div className="update-banner" role="status">
					<span>{t('update.available')}</span>
					<button
						className="button"
						type="button"
						onClick={() => {
							if (editorDirty && !window.confirm(t('update.unsavedConfirm'))) return;
							void pwaUpdate.apply();
						}}
					>
						{t('update.apply')}
					</button>
				</div>
			) : null}
			<main id="main-content" className="main-content" tabIndex={-1}>
				{children}
			</main>
			<nav className="mobile-nav" aria-label={t('nav.mobile')}>
				{navItems.map((item) => (
					<NavLink
						key={item.to}
						to={item.to}
						className={({ isActive }) => `mobile-nav__link${isActive ? ' is-active' : ''}`}
					>
						<Icon name={item.icon} />
						<span>{item.label}</span>
					</NavLink>
				))}
			</nav>
		</div>
	);
}

export function PageHeader({
	title,
	description,
	action,
}: {
	title: string;
	description?: string;
	action?: React.ReactNode;
}) {
	return (
		<header className="page-header reveal">
			<div>
				<h1 tabIndex={-1}>{title}</h1>
				{description ? <p>{description}</p> : null}
			</div>
			{action}
		</header>
	);
}

export function ProgressRing({ value, label }: { value: number; label: string }) {
	const clamped = Math.max(0, Math.min(100, value));
	return (
		<div
			className="progress-ring"
			style={{ '--progress': `${clamped * 3.6}deg` } as React.CSSProperties}
			role="img"
			aria-label={`${label} ${clamped}%`}
		>
			<span>{clamped}%</span>
			<small>{label}</small>
		</div>
	);
}
