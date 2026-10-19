import { lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import '@fontsource-variable/source-serif-4/wght.css'
import '@fontsource-variable/inter/wght.css'
import './index.css'

// Telegram Mini App (?nasher_app=1): faqat NaSher AI, saytning qolgan qismi yuklanmaydi
const NasherMiniApp = lazy(() => import('./NasherMiniApp'))
const isNasherApp = new URLSearchParams(window.location.search).has('nasher_app')

createRoot(document.getElementById("root")!).render(
  isNasherApp
    ? <Suspense fallback={null}><NasherMiniApp /></Suspense>
    : (
      <BrowserRouter>
        <App />
      </BrowserRouter>
    )
);
