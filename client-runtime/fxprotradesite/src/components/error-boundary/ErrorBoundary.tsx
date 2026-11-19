import React, { ReactNode } from 'react';
import './error-boundary.scss';

interface ErrorBoundaryProps {
    children: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        // Log to monitoring service if needed
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
        window.location.href = '/';
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className='error-boundary-container'>
                    <div className='error-boundary-content'>
                        <h1>⚠️ Oops! Something went wrong</h1>
                        <p>We encountered an unexpected error loading the application.</p>
                        <details className='error-details'>
                            <summary>Error Details</summary>
                            <pre>{this.state.error?.message || 'Unknown error'}</pre>
                        </details>
                        <div className='error-actions'>
                            <button className='error-button primary' onClick={this.handleReset}>
                                Reload Application
                            </button>
                            <button
                                className='error-button secondary'
                                onClick={() => window.location.reload()}
                            >
                                Hard Refresh
                            </button>
                        </div>
                        <p className='error-help'>
                            If the problem persists, try clearing your browser cache and refreshing the page.
                        </p>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
