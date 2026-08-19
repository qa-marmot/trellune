import { type PropsWithChildren, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Icon } from './Icon';
import { useAppState } from '../state/AppState';
import { usePwaUpdate } from '../pwa/update';
import { isDemoMode } from '../demo';
import { resetDemoData } from '../storage/db';

const navItems = [
	{ to: '/today', label: '今日', icon: 'today' as const },
	{ to: '/curriculum', label: '学ぶ', icon: 'learn' as const },
	{ to: '/reviews', label: '復習', icon: 'review' as const },
	{ to: '/voice', label: '会話AI', icon: 'bridge' as const },
	{ to: '/settings', label: '設定', icon: 'settings' as const },
];

export function AppShell({ children }: PropsWithChildren) {
	const { data, editorDirty } = useAppState();
	const pwaUpdate = usePwaUpdate();
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
				本文へ移動
			</a>
			<header className="topbar">
				<NavLink className="wordmark" to="/today" aria-label="Trellune ホーム">
					<span className="wordmark__mark">TL</span>
					<span>Trellune</span>
				</NavLink>
				<nav className="desktop-nav" aria-label="メインナビゲーション">
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
				<div className="topbar__status" aria-label={`Core ${completed}/3 完了`}>
					<span className={online ? 'network-dot' : 'network-dot is-offline'}>
						{online ? 'オンライン' : 'オフライン'}
					</span>
					<span>{completed}/3</span>
					<span className="topbar__status-label">CORE</span>
				</div>
			</header>
			{isDemoMode ? (
				<div className="demo-banner" role="status">
					<span>公開デモ: 合成データのみ・同期なし。保存先は通常版と分離されています。</span>
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
						{demoResetting ? 'リセット中…' : '合成データをリセット'}
					</button>
					<button
						className="button"
						type="button"
						onClick={() => {
							window.location.assign('/curriculum/6');
						}}
					>
						Reading/Writing の例へ
					</button>
				</div>
			) : null}
			{pwaUpdate.available ? (
				<div className="update-banner" role="status">
					<span>新しいバージョンを利用できます。</span>
					<button
						className="button"
						type="button"
						onClick={() => {
							if (
								editorDirty &&
								!window.confirm(
									'取込画面に未保存の入力があります。更新すると入力が失われます。更新しますか？',
								)
							)
								return;
							void pwaUpdate.apply();
						}}
					>
						確認して更新
					</button>
				</div>
			) : null}
			<main id="main-content" className="main-content" tabIndex={-1}>
				{children}
			</main>
			<nav className="mobile-nav" aria-label="モバイルナビゲーション">
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
