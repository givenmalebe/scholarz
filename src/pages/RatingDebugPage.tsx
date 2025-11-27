import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';
import { Button } from '../components/ui/Button';
import { CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';

export function RatingDebugPage() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const runDiagnostics = async () => {
    setLoading(true);
    const diagnostics: any[] = [];

    try {
      // 1. Check Firebase Configuration
      diagnostics.push({
        test: 'Firebase Configuration',
        status: isFirebaseConfigured() ? 'pass' : 'fail',
        message: isFirebaseConfigured() 
          ? 'Firebase is properly configured' 
          : 'Firebase is using demo/placeholder values',
        details: {
          configured: isFirebaseConfigured(),
          projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'NOT SET'
        }
      });

      if (!isFirebaseConfigured()) {
        diagnostics.push({
          test: 'Firebase Environment Variables',
          status: 'fail',
          message: 'Environment variables not set properly',
          details: {
            VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY ? 'SET' : 'NOT SET',
            VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID ? 'SET' : 'NOT SET',
            VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ? 'SET' : 'NOT SET'
          }
        });
      }

      // 2. Check Firestore Connection
      try {
        const testQuery = query(collection(db, 'users'), where('role', '==', 'SME'));
        const snapshot = await getDocs(testQuery);
        diagnostics.push({
          test: 'Firestore Connection',
          status: 'pass',
          message: `Successfully connected. Found ${snapshot.size} SME(s)`,
          details: { smeCount: snapshot.size }
        });

        // 3. Check SME Ratings
        if (snapshot.size > 0) {
          const firstSME = snapshot.docs[0];
          const smeData = firstSME.data();
          const smeProfile = smeData.profile || {};

          diagnostics.push({
            test: 'SME Profile Data',
            status: 'info',
            message: `First SME: ${smeProfile.name || 'Unknown'}`,
            details: {
              id: firstSME.id,
              name: smeProfile.name,
              rating: smeProfile.rating,
              reviews: smeProfile.reviews
            }
          });

          // Check ratings for this SME
          const ratingsQuery = query(
            collection(db, 'smeRatings'),
            where('smeId', '==', firstSME.id)
          );
          const ratingsSnapshot = await getDocs(ratingsQuery);

          diagnostics.push({
            test: 'SME Ratings Collection',
            status: ratingsSnapshot.size > 0 ? 'pass' : 'warn',
            message: `Found ${ratingsSnapshot.size} rating(s) for ${smeProfile.name}`,
            details: {
              ratingsCount: ratingsSnapshot.size,
              ratings: ratingsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              }))
            }
          });

          // Calculate expected rating
          if (ratingsSnapshot.size > 0) {
            let totalRating = 0;
            ratingsSnapshot.forEach(ratingDoc => {
              totalRating += ratingDoc.data().rating || 0;
            });
            const expectedAverage = Number((totalRating / ratingsSnapshot.size).toFixed(1));

            diagnostics.push({
              test: 'Rating Calculation',
              status: expectedAverage === smeProfile.rating ? 'pass' : 'warn',
              message: expectedAverage === smeProfile.rating 
                ? 'Rating matches calculated average'
                : `Rating mismatch! Expected: ${expectedAverage}, Stored: ${smeProfile.rating}`,
              details: {
                storedRating: smeProfile.rating,
                calculatedRating: expectedAverage,
                totalRatings: totalRating,
                count: ratingsSnapshot.size
              }
            });
          }
        }

      } catch (error: any) {
        diagnostics.push({
          test: 'Firestore Connection',
          status: 'fail',
          message: `Failed to connect: ${error.message}`,
          details: { error: error.toString() }
        });
      }

      // 4. Check Authentication
      const currentUser = localStorage.getItem('currentUser');
      if (currentUser) {
        try {
          const userData = JSON.parse(currentUser);
          diagnostics.push({
            test: 'User Authentication',
            status: 'pass',
            message: `Logged in as: ${userData.profile?.name || userData.email}`,
            details: {
              role: userData.profile?.role || 'Unknown',
              id: userData.id,
              email: userData.email
            }
          });
        } catch {
          diagnostics.push({
            test: 'User Authentication',
            status: 'warn',
            message: 'User data exists but is malformed'
          });
        }
      } else {
        diagnostics.push({
          test: 'User Authentication',
          status: 'warn',
          message: 'No user logged in'
        });
      }

    } catch (error: any) {
      diagnostics.push({
        test: 'General Error',
        status: 'fail',
        message: error.message,
        details: { error: error.toString() }
      });
    }

    setResults(diagnostics);
    setLoading(false);
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'fail':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'warn':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      default:
        return <AlertCircle className="w-5 h-5 text-blue-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pass':
        return 'bg-green-50 border-green-200';
      case 'fail':
        return 'bg-red-50 border-red-200';
      case 'warn':
        return 'bg-yellow-50 border-yellow-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Rating System Diagnostics</h1>
              <p className="text-gray-600">Check why ratings aren't working</p>
            </div>
            <Button
              onClick={runDiagnostics}
              disabled={loading}
              className="flex items-center space-x-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Running...' : 'Run Again'}</span>
            </Button>
          </div>

          {loading && results.length === 0 ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Running diagnostics...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {results.map((result, index) => (
                <div
                  key={index}
                  className={`border rounded-lg p-4 ${getStatusColor(result.status)}`}
                >
                  <div className="flex items-start space-x-3">
                    {getStatusIcon(result.status)}
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">{result.test}</h3>
                      <p className="text-gray-700 mb-2">{result.message}</p>
                      {result.details && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-800">
                            View Details
                          </summary>
                          <pre className="mt-2 p-3 bg-white rounded border border-gray-200 text-xs overflow-x-auto">
                            {JSON.stringify(result.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Instructions */}
          <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-3">🔧 How to Fix Issues:</h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li className="flex items-start">
                <span className="mr-2">1.</span>
                <span>If Firebase is not configured, add environment variables to <code className="bg-blue-100 px-1 rounded">.env.local</code></span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">2.</span>
                <span>If Firestore connection fails, deploy Firestore rules: <code className="bg-blue-100 px-1 rounded">npx firebase deploy --only firestore</code></span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">3.</span>
                <span>If rating mismatch exists, the stored rating needs to be recalculated</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">4.</span>
                <span>If no ratings found, try rating an SME from the SDP Dashboard</span>
              </li>
            </ul>
          </div>

          {/* Quick Actions */}
          <div className="mt-6 flex items-center justify-center space-x-4">
            <Button
              variant="outline"
              onClick={() => window.location.href = '/sdp-dashboard'}
            >
              Go to SDP Dashboard
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open('https://console.firebase.google.com/project/link-my-skills/firestore', '_blank')}
            >
              Open Firebase Console
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

