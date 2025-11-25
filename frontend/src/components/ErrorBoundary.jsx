import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, stack: null, traceId: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    const traceId = 'ERR_' + Date.now();
    // eslint-disable-next-line no-console
    console.error('Unhandled error in UI:', traceId, error, errorInfo);
    try {
      const payload = {
        traceId,
        message: error?.message,
        stack: error?.stack,
        componentStack: errorInfo?.componentStack,
        time: new Date().toISOString(),
        path: window.location.pathname
      };
      // Persist last 20 errors in localStorage for quick diagnostics
      const existing = JSON.parse(localStorage.getItem('appErrorLog') || '[]');
      existing.push(payload);
      while (existing.length > 20) existing.shift();
      localStorage.setItem('appErrorLog', JSON.stringify(existing));
      this.setState({ stack: error?.stack, traceId });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Failed to persist error log', e);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 16, fontFamily: 'system-ui' }}>
          <h2 style={{ fontWeight: 600, marginBottom: 8 }}>Something went wrong.</h2>
          <p style={{ marginBottom: 12 }}>Please refresh the page. If the problem persists, contact support with Trace ID <code>{this.state.traceId}</code>.</p>
          {this.state.error?.message && (
            <details style={{ fontSize: 12, background: '#f9fafb', padding: 8, borderRadius: 6, border: '1px solid #e5e7eb' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 500 }}>Error Details</summary>
              <div style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>
                {this.state.error.message}
                {this.state.stack && '\n\n' + this.state.stack.split('\n').slice(0, 10).join('\n')}
              </div>
            </details>
          )}
          <div style={{ marginTop: 12 }}>
            <button onClick={() => window.location.reload()} style={{ background:'#2563eb', color:'#fff', padding:'8px 14px', borderRadius:6, border:'none', cursor:'pointer' }}>Reload Page</button>
            <button onClick={() => { localStorage.removeItem('appErrorLog'); this.setState({ hasError: false, error: null, stack: null }); }} style={{ marginLeft:8, background:'#64748b', color:'#fff', padding:'8px 14px', borderRadius:6, border:'none', cursor:'pointer' }}>Clear Error State</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
