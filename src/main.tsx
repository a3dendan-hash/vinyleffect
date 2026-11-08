import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class RootErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('RootErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '24px',
          background: '#0a0a0a',
          color: '#f5f5f5',
          minHeight: '100vh',
          fontFamily: 'monospace',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center'
        }}>
          <div style={{
            maxWidth: '500px',
            background: '#111111',
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid #262626'
          }}>
            <h2 style={{ color: '#8b5cf6', fontSize: '18px', marginBottom: '12px' }}>
              ВИНИЛПИТЕР.РФ
            </h2>
            <p style={{ color: '#888888', fontSize: '12px', marginBottom: '16px' }}>
              Произошла ошибка при инициализации интерфейса:
            </p>
            <pre style={{
              background: '#0c0c0c',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '11px',
              color: '#ffb4ab',
              overflowX: 'auto',
              textAlign: 'left',
              border: '1px solid #201f1f'
            }}>
              {this.state.error?.message || 'Неизвестная ошибка'}
            </pre>
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: '16px',
                padding: '10px 20px',
                background: '#8b5cf6',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '12px'
              }}
            >
              Перезагрузить страницу
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>
);
