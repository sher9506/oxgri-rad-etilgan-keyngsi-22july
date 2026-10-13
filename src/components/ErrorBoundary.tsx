import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Agar berilsa, xato bo'lganda shu tugma qayta urinishni amalga oshiradi (local boundary uchun) */
  onReset?: () => void;
  /** Local boundary uchun kichikroq dizayn (fullscreen emas) */
  variant?: 'full' | 'local';
}

interface State {
  hasError: boolean;
  error?: Error;
  info?: React.ErrorInfo;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
    this.setState({ info });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, info: undefined });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      const isDebug = typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).has('debug');
      const isLocal = this.props.variant === 'local';

      if (isLocal) {
        return (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-amber-50 border border-amber-100">
              <svg className="h-6 w-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.84-2.75L13.74 4a2 2 0 00-3.48 0L3.16 16.25A2 2 0 005 19z" />
              </svg>
            </div>
            <h2 className="text-base font-bold text-gray-800">Bu bo'limda xato yuz berdi</h2>
            <p className="text-sm text-gray-500 max-w-xs">
              Sahifani yangilash yoki qayta urinish bilan tuzatishingiz mumkin.
            </p>
            {isDebug && this.state.error && (
              <pre className="text-left text-[10px] text-red-600 bg-red-50 border border-red-100 rounded-lg p-3 max-w-md overflow-auto max-h-40 whitespace-pre-wrap">
                {this.state.error.message}
                {this.state.info?.componentStack}
              </pre>
            )}
            <div className="flex gap-2">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 rounded-xl font-bold text-sm text-white transition active:scale-95"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}
              >
                Qayta urinish
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-xl font-bold text-sm text-gray-600 bg-gray-100 transition active:scale-95"
              >
                Yangilash
              </button>
            </div>
          </div>
        );
      }

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
            {isDebug && this.state.error && (
              <pre className="text-left text-[10px] text-red-400 bg-black/30 rounded-lg p-3 max-h-40 overflow-auto whitespace-pre-wrap text-left">
                {this.state.error.message}
                {this.state.info?.componentStack}
              </pre>
            )}
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
