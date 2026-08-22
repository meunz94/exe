import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Old hash addresses (#/main/log) still arrive from bookmarks and shared
// links; rewrite them to the path form (/main/log) before anything renders.
if (window.location.hash.startsWith('#/')) {
  window.history.replaceState(null, '', window.location.hash.slice(1) || '/')
}

// No StrictMode: its dev-only double-mount tears down and recreates the R3F
// Canvas fast enough to lose the WebGL context (blank scene, "THREE.WebGL-
// Renderer: Context Lost"). Scene-mutation idempotency is handled manually.
createRoot(document.getElementById('root')!).render(
  <App />,
)
