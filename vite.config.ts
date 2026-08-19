import { cloudflare } from '@cloudflare/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const isDemoMode = process.env.VITE_DEMO_MODE === 'true';

export default defineConfig({
	build: {
		rolldownOptions: {
			output: {
				codeSplitting: {
					groups: [
						{
							name: 'vendor',
							test: /node_modules[\\/]/,
							maxSize: 300 * 1024,
						},
					],
				},
			},
		},
	},
	plugins: [
		react(),
		cloudflare(),
		VitePWA({
			registerType: 'prompt',
			injectRegister: false,
			includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'],
			manifest: {
				name: isDemoMode ? 'Trellune Demo' : 'Trellune',
				short_name: isDemoMode ? 'Trellune Demo' : 'Trellune',
				description: 'A local-first English learning PWA / ローカル優先の英語学習PWA',
				theme_color: '#f6f2e7',
				background_color: '#f6f2e7',
				display: 'standalone',
				start_url: '/',
				lang: 'en',
				icons: [
					{ src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
					{ src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
					{
						src: '/icon-maskable-512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable',
					},
				],
			},
			workbox: {
				navigateFallback: '/index.html',
				globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
				skipWaiting: false,
				clientsClaim: false,
			},
		}),
	],
});
