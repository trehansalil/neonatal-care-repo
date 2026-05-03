import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { BabyProvider } from './contexts/BabyContext'
import './styles/global.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <BabyProvider>
          <App />
        </BabyProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
)
