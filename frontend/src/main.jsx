import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './theme.css'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import GoogleAuthProvider from './contexts/GoogleAuthProvider'
import { ThemeProvider } from './contexts/ThemeContext'

// Mute info/debug logs in production unless DEBUG_LOGS is set
if (import.meta.env.PROD) {
  try {
    const enabled = typeof window !== 'undefined' && window.sessionStorage && window.sessionStorage.getItem('DEBUG_LOGS');
    if (!enabled) {
      // eslint-disable-next-line no-console
      console.log = () => {};
      // eslint-disable-next-line no-console
      console.debug = () => {};
      // Keep warn/error visible in prod
    }
  } catch (e) {
    // ignore
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <GoogleAuthProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </GoogleAuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
