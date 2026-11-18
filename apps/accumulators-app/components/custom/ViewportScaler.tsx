'use client';

export default function ViewportScaler({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: '100%', height: '100dvh', minHeight: 0, overflowX: 'hidden', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      {children}
    </div>
  );
}
