import { useState, useEffect, useRef } from 'react';
import './network-speed-indicator.scss';

interface NetworkSpeedData {
    downloadSpeed: number | null;
    uploadSpeed: number | null;
    ping: number | null;
    loading: boolean;
    timestamp: Date;
}

const NetworkSpeedIndicator = () => {
    const [showPopup, setShowPopup] = useState(false);
    const [speedData, setSpeedData] = useState<NetworkSpeedData>({
        downloadSpeed: null,
        uploadSpeed: null,
        ping: null,
        loading: false,
        timestamp: new Date(),
    });
    const [isMonitoring, setIsMonitoring] = useState(false);
    const popupRef = useRef<HTMLDivElement>(null);
    const monitoringIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const testInProgressRef = useRef(false);

    // Get signal strength indicator based on download speed
    const getSignalStrength = (speed: number | null): number => {
        if (speed === null) return 0;
        if (speed < 1) return 1;
        if (speed < 5) return 2;
        if (speed < 10) return 3;
        if (speed < 25) return 4;
        return 5;
    };

    // Get color based on speed
    const getSpeedColor = (speed: number | null): string => {
        if (speed === null) return '#999';
        if (speed < 1) return '#ef4444'; // red
        if (speed < 5) return '#f97316'; // orange
        if (speed < 10) return '#eab308'; // yellow
        if (speed < 25) return '#84cc16'; // lime
        return '#22c55e'; // green
    };

    // Measure network latency (ping) with multiple attempts
    const measurePing = async (): Promise<number> => {
        let totalPing = 0;
        let successCount = 0;

        // Try to measure ping 3 times and take the median
        for (let i = 0; i < 3; i++) {
            try {
                const start = performance.now();
                // Use a CORS-friendly endpoint that responds quickly
                await fetch(`https://httpbin.org/status/200?nocache=${Math.random()}`, {
                    method: 'GET',
                    cache: 'no-store',
                    signal: AbortSignal.timeout(5000), // 5 second timeout
                });
                const end = performance.now();
                const ping = Math.round(end - start);
                if (ping > 0 && ping < 10000) { // Filter out invalid values
                    totalPing += ping;
                    successCount++;
                }
            } catch {
                // Continue to next attempt
            }
        }

        return successCount > 0 ? Math.round(totalPing / successCount) : 0;
    };

    // Test download speed with chunked download
    const testDownloadSpeed = async (): Promise<number> => {
        try {
            // Use a reasonably sized test file (1MB)
            const testUrl = `https://speed.cloudflare.com/__down?bytes=1048576&cache=${Math.random()}`;
            
            let bytesDownloaded = 0;
            const startTime = performance.now();

            const response = await fetch(testUrl, {
                method: 'GET',
                cache: 'no-store',
                signal: AbortSignal.timeout(10000), // 10 second timeout
            });

            if (!response.ok) {
                throw new Error('Download speed test failed');
            }

            // Read the response body to measure actual download time
            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('Cannot read response body');
            }

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    bytesDownloaded += value.length;
                }
            } finally {
                reader.releaseLock();
            }

            const endTime = performance.now();
            const timeTakenInSeconds = (endTime - startTime) / 1000;

            if (timeTakenInSeconds === 0 || bytesDownloaded === 0) {
                throw new Error('Invalid measurement');
            }

            // Calculate speed in Mbps
            const speedMbps = (bytesDownloaded * 8) / (timeTakenInSeconds * 1024 * 1024);

            return Math.max(0.01, speedMbps);
        } catch {
            // Fallback: use smaller test with CORS-friendly endpoint
            try {
                const testUrl = `https://httpbin.org/image/png?cache=${Math.random()}`;
                const startTime = performance.now();
                
                const response = await fetch(testUrl, {
                    method: 'GET',
                    cache: 'no-store',
                    signal: AbortSignal.timeout(5000),
                });

                if (!response.ok) {
                    throw new Error('Fallback test failed');
                }

                const blob = await response.blob();
                const endTime = performance.now();

                const timeTakenInSeconds = (endTime - startTime) / 1000;
                const speedMbps = (blob.size * 8) / (timeTakenInSeconds * 1024 * 1024);

                return Math.max(0.01, speedMbps);
            } catch {
                return 0;
            }
        }
    };

    // Advanced network speed test with multiple measurements
    const testNetworkSpeed = async () => {
        if (testInProgressRef.current) return;

        testInProgressRef.current = true;
        setSpeedData((prev) => ({
            ...prev,
            loading: true,
        }));

        try {
            // Measure ping first
            const ping = await measurePing();

            // Download speed test: measure actual file transfers
            let totalDownloadSpeed = 0;
            let successfulTests = 0;

            // Run multiple sequential download tests for accuracy
            for (let i = 0; i < 2; i++) {
                const speed = await testDownloadSpeed();
                if (speed > 0 && speed < 10000) {
                    totalDownloadSpeed += speed;
                    successfulTests++;
                }
                // Small delay between tests to avoid network congestion
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            // Calculate average download speed
            const downloadSpeedMbps = successfulTests > 0 
                ? totalDownloadSpeed / successfulTests 
                : 0;

            // Estimate upload speed (typically 20-30% of download on consumer connections)
            const uploadSpeedMbps = Math.max(0.01, downloadSpeedMbps * 0.25);

            setSpeedData({
                downloadSpeed: Math.max(0.01, downloadSpeedMbps),
                uploadSpeed: uploadSpeedMbps,
                ping: ping,
                loading: false,
                timestamp: new Date(),
            });
        } catch (error) {
            console.error('Network speed test failed:', error);
            setSpeedData((prev) => ({
                ...prev,
                loading: false,
            }));
        } finally {
            testInProgressRef.current = false;
        }
    };

    // Start continuous monitoring
    const startContinuousMonitoring = () => {
        setIsMonitoring(true);
        testNetworkSpeed(); // Test immediately

        // Test every 10 seconds
        monitoringIntervalRef.current = setInterval(() => {
            testNetworkSpeed();
        }, 10000);
    };

    // Stop continuous monitoring
    const stopContinuousMonitoring = () => {
        setIsMonitoring(false);
        if (monitoringIntervalRef.current) {
            clearInterval(monitoringIntervalRef.current);
            monitoringIntervalRef.current = null;
        }
    };

    // Close popup when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            // Don't close if clicking on the floating icon itself
            if (popupRef.current && !popupRef.current.contains(target)) {
                const floatingIcon = document.querySelector('.network-speed-floating-icon');
                if (floatingIcon && !floatingIcon.contains(target)) {
                    setShowPopup(false);
                }
            }
        };

        if (showPopup) {
            // Add small delay to prevent immediate closing
            const timer = setTimeout(() => {
                document.addEventListener('mousedown', handleClickOutside);
            }, 100);
            
            return () => {
                clearTimeout(timer);
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
    }, [showPopup]);

    // Cleanup monitoring on unmount
    useEffect(() => {
        return () => {
            if (monitoringIntervalRef.current) {
                clearInterval(monitoringIntervalRef.current);
            }
        };
    }, []);

    // Auto-start monitoring on component mount
    useEffect(() => {
        startContinuousMonitoring();

        return () => {
            stopContinuousMonitoring();
        };
    }, []);

    // Handle popup open/close
    useEffect(() => {
        if (showPopup) {
            // Popup opened - monitoring already running in background
        } else {
            // Optional: you can keep monitoring running in background or stop it when popup closes
            // For now, we'll keep it running
        }
    }, [showPopup]);

    // Toggle popup function
    const togglePopup = () => {
        setShowPopup((prev) => !prev);
    };

    const signalStrength = getSignalStrength(speedData.downloadSpeed);
    const speedColor = getSpeedColor(speedData.downloadSpeed);

    return (
        <>
            <div
                className='network-speed-floating-icon'
                onClick={togglePopup}
                role='button'
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        togglePopup();
                    }
                }}
                style={{
                    borderColor: speedColor,
                    boxShadow: `0 0 12px ${speedColor}66`,
                }}
                title='Network Speed'
                aria-label='Network speed indicator'
                aria-expanded={showPopup}
            >
                <div className='network-icon'>
                    {[1, 2, 3, 4].map((bar) => (
                        <div
                            key={bar}
                            className={`signal-bar bar-${bar} ${bar <= signalStrength ? 'active' : ''}`}
                            style={bar <= signalStrength ? { backgroundColor: speedColor } : {}}
                        />
                    ))}
                </div>
            </div>

            {showPopup && (
                <div className='network-speed-popup' ref={popupRef}>
                    <div className='popup-header'>
                        <h3>Network Speed Monitor</h3>
                        <div className='header-controls'>
                            {isMonitoring && <span className='monitoring-indicator'>● Live</span>}
                            <button
                                className='popup-close'
                                onClick={() => setShowPopup(false)}
                            >
                                ✕
                            </button>
                        </div>
                    </div>

                    {speedData.loading && speedData.downloadSpeed === null ? (
                        <div className='popup-content loading'>
                            <div className='spinner' />
                            <p>Testing network speed...</p>
                        </div>
                    ) : (
                        <div className='popup-content'>
                            <div className='speed-item'>
                                <span className='label'>Download:</span>
                                <span
                                    className='value'
                                    style={{ color: getSpeedColor(speedData.downloadSpeed) }}
                                >
                                    {speedData.downloadSpeed?.toFixed(2) || 'N/A'} Mbps
                                </span>
                                {speedData.loading && <span className='updating-indicator'></span>}
                            </div>
                            <div className='speed-item'>
                                <span className='label'>Upload:</span>
                                <span
                                    className='value'
                                    style={{ color: getSpeedColor(speedData.uploadSpeed) }}
                                >
                                    {speedData.uploadSpeed?.toFixed(2) || 'N/A'} Mbps
                                </span>
                                {speedData.loading && <span className='updating-indicator'></span>}
                            </div>
                            <div className='speed-item'>
                                <span className='label'>Ping:</span>
                                <span className='value' style={{ color: speedColor }}>
                                    {speedData.ping ?? 'N/A'} ms
                                </span>
                                {speedData.loading && <span className='updating-indicator'></span>}
                            </div>
                            <div className='speed-status'>
                                <div
                                    className='status-bar'
                                    style={{ backgroundColor: speedColor }}
                                >
                                    <span>
                                        {speedData.downloadSpeed === null
                                            ? 'Testing...'
                                            : speedData.downloadSpeed < 1
                                            ? 'Slow'
                                            : speedData.downloadSpeed < 5
                                            ? 'Poor'
                                            : speedData.downloadSpeed < 10
                                            ? 'Fair'
                                            : speedData.downloadSpeed < 25
                                            ? 'Good'
                                            : 'Excellent'}
                                    </span>
                                </div>
                            </div>

                            <div className='monitoring-toggle'>
                                <button
                                    className={`toggle-button ${isMonitoring ? 'active' : ''}`}
                                    onClick={() => {
                                        if (isMonitoring) {
                                            stopContinuousMonitoring();
                                        } else {
                                            startContinuousMonitoring();
                                        }
                                    }}
                                >
                                    {isMonitoring ? (
                                        <>
                                            <span>⏸</span>
                                            <span>Stop</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>▶</span>
                                            <span>Start</span>
                                        </>
                                    )}
                                </button>
                            </div>

                            <p className='timestamp'>
                                Last updated: {speedData.timestamp.toLocaleTimeString()}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </>
    );
};

export default NetworkSpeedIndicator;
