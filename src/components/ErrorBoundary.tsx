import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#0f172a' }}>
          <div className="max-w-md w-full text-center space-y-4">
            <div
              className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(59,130,246,0.15)' }}
            >
              <svg className="h-7 w-7 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.84-2.75L13.74 4a2 2 0 00-3.48 0L3.16 16.25A2 2 0 005 19z" />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-white">Saytda kichik nosozlik</h1>
            <p className="text-sm text-white/60">
              Sahifani yangilab ko'ring. Agar muammo davom etsa, hisoblagichni tozalang.
            </p>
            <div className="flex flex-col gap-2 items-center">
              <button
                onClick={() => window.location.reload()}
                className="px-5 py-2.5 rounded-xl font-bold text-sm text-white transition active:scale-95"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}
              >
                Sahifani yangilash
              </button>
              <button
                onClick={() => {
                  try { sessionStorage.clear(); localStorage.clear(); } catch {}
                  window.location.href = '/';
                }}
                className="text-xs text-white/40 hover:text-white/60 transition"
              >
                Keshni tozalash
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
