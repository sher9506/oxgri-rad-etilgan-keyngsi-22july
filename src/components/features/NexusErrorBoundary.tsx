import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class NexusErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[NexusAI ErrorBoundary]', error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-6 text-center" style={{ background: '#FAF9F5' }}>
          <div className="max-w-sm w-full space-y-4">
            <div
              className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(201, 100, 66, 0.10)' }}
            >
              <svg className="h-6 w-6" style={{ color: '#C96442' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.84-2.75L13.74 4a2 2 0 00-3.48 0L3.16 16.25A2 2 0 005 19z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold" style={{ color: '#1F1E1D' }}>Nexus AI'da xatolik</h2>
            <p className="text-sm" style={{ color: '#5E5D59' }}>
              Sahifani qayta yuklab urinib ko'ring.
            </p>
            <div className="flex flex-col gap-2 items-center">
              <button
                onClick={() => this.setState({ hasError: false, error: undefined })}
                className="px-5 py-2.5 rounded-xl font-semibold text-sm text-white transition active:scale-95"
                style={{ background: '#C96442' }}
              >
                Qayta urinib ko'ring
              </button>
              <button
                onClick={() => {
                  try {
                    Object.keys(localStorage)
                      .filter(k => k.startsWith('nexus_chat_v1') || k.startsWith('nexus_chat_id_v1'))
                      .forEach(k => localStorage.removeItem(k));
                  } catch { /* e'tiborsiz */ }
                  window.location.reload();
                }}
                className="text-xs transition"
                style={{ color: '#6B6A64' }}
              >
                Suhbat tarixini tozalash
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
