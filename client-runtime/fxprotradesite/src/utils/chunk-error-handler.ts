/**
 * Handles dynamic chunk loading errors
 * Particularly useful for CSS chunk loading failures
 */

/**
 * Initialize chunk error handlers
 * This should be called before the app renders
 */
export const initChunkErrorHandler = () => {

    // Listen for chunk loading errors
    window.addEventListener('error', (event: ErrorEvent) => {
        const errorMessage = event.message || '';

        // Check if this is a CSS chunk loading error
        if (
            errorMessage.includes('Loading CSS chunk') ||
            errorMessage.includes('Failed to fetch') ||
            (event.filename && event.filename.includes('.css'))
        ) {
            console.error('🚨 Chunk loading error detected:', {
                message: errorMessage,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
            });

            // Show a user-friendly message instead of crashing
            handleChunkLoadingError(errorMessage);

            // Prevent default error handling
            event.preventDefault();
        }
    });

    // Listen for unhandled promise rejections (async chunk loading failures)
    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
        const error = event.reason;

        if (
            error?.message?.includes('Loading CSS chunk') ||
            error?.message?.includes('Failed to fetch') ||
            (typeof error === 'string' && error.includes('CSS chunk'))
        ) {
            console.error('🚨 Unhandled chunk loading promise rejection:', error);
            handleChunkLoadingError(error?.message || 'Failed to load application resources');

            // Don't mark as handled to let the error boundary catch it if needed
        }
    });
};

/**
 * Handles chunk loading errors gracefully
 */
export const handleChunkLoadingError = (errorMessage: string) => {
    // Check if user is online
    if (!navigator.onLine) {
        showChunkErrorNotification(
            'Connection Lost',
            'Please check your internet connection and reload the page.',
            'offline'
        );
        return;
    }

    // For CSS chunks, suggest clearing cache
    if (errorMessage.includes('CSS')) {
        showChunkErrorNotification(
            'Resource Loading Failed',
            'Failed to load CSS resources. Try clearing your browser cache.',
            'css-error'
        );
        return;
    }

    // Generic chunk error
    showChunkErrorNotification(
        'Loading Failed',
        'Failed to load application resources. Please refresh the page.',
        'generic-error'
    );
};

/**
 * Display a user-friendly notification for chunk errors
 */
const showChunkErrorNotification = (title: string, message: string, type: string) => {
    // Remove any existing notifications
    const existingNotification = document.querySelector('[data-chunk-error-notification]');
    if (existingNotification) {
        existingNotification.remove();
    }

    // Create notification element
    const notification = document.createElement('div');
    notification.setAttribute('data-chunk-error-notification', 'true');
    notification.className = `chunk-error-notification chunk-error-${type}`;
    notification.innerHTML = `
        <div class="chunk-error-content">
            <div class="chunk-error-header">
                <strong>${title}</strong>
                <button class="chunk-error-close" aria-label="Close notification">×</button>
            </div>
            <p>${message}</p>
            <div class="chunk-error-actions">
                <button class="chunk-error-reload">Reload Page</button>
                <button class="chunk-error-clear-cache">Clear Cache & Reload</button>
            </div>
        </div>
    `;

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        .chunk-error-notification {
            position: fixed;
            top: 20px;
            right: 20px;
            max-width: 400px;
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
        }

        @keyframes slideIn {
            from {
                transform: translateX(450px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }

        .chunk-error-notification.chunk-error-offline {
            background: #ff6b6b;
            color: white;
        }

        .chunk-error-notification.chunk-error-css-error {
            background: #ffa500;
            color: white;
        }

        .chunk-error-notification.chunk-error-generic-error {
            background: #e74c3c;
            color: white;
        }

        .chunk-error-content {
            padding: 20px;
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .chunk-error-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            font-weight: 600;
            font-size: 16px;
        }

        .chunk-error-close {
            background: none;
            border: none;
            color: inherit;
            font-size: 24px;
            cursor: pointer;
            padding: 0;
            margin: -5px;
            opacity: 0.8;
            transition: opacity 0.2s;
        }

        .chunk-error-close:hover {
            opacity: 1;
        }

        .chunk-error-notification p {
            margin: 10px 0;
            font-size: 14px;
            line-height: 1.4;
        }

        .chunk-error-actions {
            display: flex;
            gap: 10px;
            margin-top: 15px;
        }

        .chunk-error-reload,
        .chunk-error-clear-cache {
            padding: 8px 12px;
            border: none;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            flex: 1;
        }

        .chunk-error-reload {
            background: rgba(255, 255, 255, 0.2);
            color: white;
        }

        .chunk-error-reload:hover {
            background: rgba(255, 255, 255, 0.3);
        }

        .chunk-error-clear-cache {
            background: rgba(255, 255, 255, 0.8);
            color: #333;
        }

        .chunk-error-clear-cache:hover {
            background: white;
        }

        @media (max-width: 480px) {
            .chunk-error-notification {
                left: 10px;
                right: 10px;
                max-width: none;
            }

            .chunk-error-actions {
                flex-direction: column;
            }
        }
    `;

    // Append to body
    document.head.appendChild(style);
    document.body.appendChild(notification);

    // Add event listeners
    const closeBtn = notification.querySelector('.chunk-error-close');
    const reloadBtn = notification.querySelector('.chunk-error-reload');
    const clearCacheBtn = notification.querySelector('.chunk-error-clear-cache');

    closeBtn?.addEventListener('click', () => {
        notification.remove();
    });

    reloadBtn?.addEventListener('click', () => {
        window.location.reload();
    });

    clearCacheBtn?.addEventListener('click', () => {
        // Clear service worker cache if available
        if ('caches' in window) {
            caches.keys().then(names => {
                Promise.all(names.map(name => caches.delete(name))).then(() => {
                    (window as any).location.reload();
                });
            });
        } else {
            // Fallback: Clear localStorage and session storage
            localStorage.clear();
            sessionStorage.clear();
            (window as any).location.reload();
        }
    });
};

/**
 * Check if a chunk failed to load and try to recover
 */
export const checkAndRecoverFromChunkError = () => {
    // Check if there's a hash/query param indicating chunk error
    const params = new URLSearchParams(window.location.search);
    if (params.get('chunk_error') === '1') {
        // Already tried to recover, clear the flag
        params.delete('chunk_error');
        window.history.replaceState({}, document.title, window.location.pathname);

        // Show error message
        showChunkErrorNotification(
            'Recovery Failed',
            'Unable to load the application. Please clear your browser cache and try again.',
            'generic-error'
        );
    }
};
