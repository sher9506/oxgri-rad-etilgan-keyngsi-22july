import { lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import '@fontsource-variable/source-serif-4/wght.css'
import '@fontsource-variable/inter/wght.css'
import './index.css'

// Deploydan keyin keshdagi eski sahifa o'chirilgan fayllarni so'rasa (Telegram ayniqsa) — oppoq ekran o'rniga bir marta yangilanadi.
// 30 s ichida takror yangilanmaydi (cheksiz aylanish bo'lmasin).
function reloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem('chunk_reload_at') || 0)
    if (Date.now() - last < 30_000) return false
    sessionStorage.setItem('chunk_reload_at', String(Date.now()))
  } catch { return false }
  window.location.reload()
  return true
}
window.addEventListener('vite:preloadError', (e) => { if (reloadOnce()) e.preventDefault() })

// Telegram Mini App (?nasher_app=1): faqat NaSher AI, saytning qolgan qismi yuklanmaydi
const NasherMiniApp = lazy(() => import('./NasherMiniApp').catch((err) => {
  console.error('[main] Mini App yuklanmadi:', err)
  if (reloadOnce()) return new Promise<never>(() => {})
  return { default: () => (
    <p style={{ padding: 24, textAlign: 'center', fontFamily: 'Inter, system-ui, sans-serif', color: '#444' }}>
      Yangi versiya chiqdi. Iltimos, Mini App'ni yopib, qayta oching.
    </p>
  ) }
}))
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
