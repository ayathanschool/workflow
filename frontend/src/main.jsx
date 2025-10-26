import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './theme.css'
import { ThemeProvider } from './contexts/ThemeContext'
import GoogleAuthProvider from './contexts/GoogleAuthProvider'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <GoogleAuthProvider>
        <App />
      </GoogleAuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
