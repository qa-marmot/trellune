import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AppStateProvider } from './state/AppState';
import '../tokens.css';
import './styles.css';
import { configurePwaUpdates } from './pwa/update';

configurePwaUpdates();
document.documentElement.dataset.buildMarker = import.meta.env.VITE_BUILD_MARKER || 'release';

ReactDOM.createRoot(document.getElementById('root')!).render(
	<React.StrictMode>
		<BrowserRouter>
			<AppStateProvider>
				<App />
			</AppStateProvider>
		</BrowserRouter>
	</React.StrictMode>,
);
