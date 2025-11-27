import React from 'react';

export function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const [hasError, setHasError] = React.useState(false);
  const [error, setError] = React.useState<any>(null);

  React.useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setHasError(true);
      setError(event.error);
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="p-4 border border-red-500 rounded">
        <h2 className="text-red-500">Something went wrong.</h2>
        <pre className="mt-2 text-sm">{error?.message || 'Unknown error'}</pre>
        <button 
          onClick={() => setHasError(false)}
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded"
        >
          Try Again
        </button>
      </div>
    );
  }

  return <>{children}</>;
}