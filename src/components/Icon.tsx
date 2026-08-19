import type { SVGProps } from 'react';

type IconName =
	| 'today'
	| 'learn'
	| 'review'
	| 'bridge'
	| 'settings'
	| 'check'
	| 'arrow'
	| 'voice'
	| 'clock'
	| 'chart'
	| 'copy';

const paths: Record<IconName, React.ReactNode> = {
	today: (
		<>
			<path d="M4 5.5h16v14H4z" />
			<path d="M8 3v5M16 3v5M4 10h16" />
		</>
	),
	learn: (
		<>
			<path d="M4 5.5c3.5-1.3 6.2-.8 8 1.2v13c-1.8-2-4.5-2.5-8-1.2z" />
			<path d="M20 5.5c-3.5-1.3-6.2-.8-8 1.2v13c1.8-2 4.5-2.5 8-1.2z" />
		</>
	),
	review: (
		<>
			<path d="M20 8a8 8 0 1 0 1 7" />
			<path d="M20 3v5h-5" />
			<path d="m9 12 2 2 4-5" />
		</>
	),
	bridge: (
		<>
			<path d="M5 17h14M7 17v-4a5 5 0 0 1 10 0v4M9 9V6M15 9V6" />
		</>
	),
	settings: (
		<>
			<circle cx="12" cy="12" r="3" />
			<path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 0 0-1.8-1L14.4 3h-4.8l-.4 3.1a7 7 0 0 0-1.8 1l-2.4-1-2 3.4L5.1 11a7 7 0 0 0 0 2L3 14.5l2 3.4 2.4-1a7 7 0 0 0 1.8 1l.4 3.1h4.8l.4-3.1a7 7 0 0 0 1.8-1l2.4 1 2-3.4-2.1-1.5a7 7 0 0 0 .1-1Z" />
		</>
	),
	check: <path d="m5 12 4 4L19 6" />,
	arrow: (
		<>
			<path d="M5 12h14" />
			<path d="m14 7 5 5-5 5" />
		</>
	),
	voice: (
		<>
			<rect x="9" y="3" width="6" height="12" rx="3" />
			<path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
		</>
	),
	clock: (
		<>
			<circle cx="12" cy="12" r="9" />
			<path d="M12 7v5l3 2" />
		</>
	),
	chart: (
		<>
			<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
		</>
	),
	copy: (
		<>
			<rect x="8" y="8" width="11" height="11" rx="2" />
			<path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
		</>
	),
};

export function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			{...props}
		>
			{paths[name]}
		</svg>
	);
}
