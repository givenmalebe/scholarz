import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { SearchPage } from './pages/SearchPage';
import { RegistrationChoice } from './components/registration/RegistrationChoice';
import { SMERegistration } from './components/registration/SMERegistration';
import { SDPRegistration } from './components/registration/SDPRegistration';
import { AdminRegistration } from './components/registration/AdminRegistration';
import { SMEDashboard } from './components/dashboard/SMEDashboard';
import { SDPDashboard } from './components/dashboard/SDPDashboard';
import { AdminDashboard } from './components/dashboard/AdminDashboard';
import { Layout } from './components/layout/Layout';
import { SMEGateway } from './pages/SMEGateway';
import { SDPGateway } from './pages/SDPGateway';
import { PricingPage } from './pages/PricingPage';
import { AboutPage } from './pages/AboutPage';
import { LoginPage } from './pages/LoginPage';
import { EditProfilePage } from './pages/EditProfilePage';
import { RatingDebugPage } from './pages/RatingDebugPage';
import { PaymentSuccessPage } from './pages/PaymentSuccessPage';
import { PaymentCancelledPage } from './pages/PaymentCancelledPage';
import { BlogsPage } from './pages/BlogsPage';
import { BlogDetailPage } from './pages/BlogDetailPage';
import { User } from './types';
import { authService } from './firebase/auth';
import { isFirebaseConfigured } from './firebase/config';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If Firebase is not configured, load from localStorage
    if (!isFirebaseConfigured()) {
      const userData = localStorage.getItem('edulinker_user');
      if (userData) {
        try {
          const parsedUser = JSON.parse(userData);
          // Just load the user data as-is from localStorage
          setUser(parsedUser);
        } catch (error) {
          console.error('Error parsing user data:', error);
        }
      }
      setLoading(false);
      return;
    }

    // Listen to Firebase auth state changes
    const unsubscribe = authService.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        // User is signed in, get user data from Firestore
        try {
          const userData = await authService.getCurrentUserData();
          if (userData) {
            // Load user data as-is from Firebase (ratings already managed there)
            setUser(userData);
            localStorage.setItem('edulinker_user', JSON.stringify(userData));
          } else {
            // Fallback to localStorage if Firestore fails
    const userData = localStorage.getItem('edulinker_user');
    if (userData) {
      try {
                const parsedUser = JSON.parse(userData);
                setUser(parsedUser);
      } catch (error) {
        console.error('Error parsing user data:', error);
              }
            }
          }
        } catch (error: any) {
          // Ignore AbortError (happens when component unmounts or listener is replaced)
          if (error.name === 'AbortError' || error.message?.includes('aborted')) {
            return;
          }
          console.error('Error fetching user data:', error);
          // Fallback to localStorage
          const userData = localStorage.getItem('edulinker_user');
          if (userData) {
            try {
              const parsedUser = JSON.parse(userData);
              setUser(parsedUser);
            } catch (err) {
              console.error('Error parsing user data:', err);
            }
          }
        }
      } else {
        // User is signed out
        setUser(null);
        localStorage.removeItem('edulinker_user');
    }
    setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = (userData: User) => {
    // Just set the user data as-is - ratings are managed in Firebase
    setUser(userData);
    localStorage.setItem('edulinker_user', JSON.stringify(userData));
  };

  const handleLogout = async () => {
    try {
      await authService.signOutUser();
    } catch (error) {
      console.error('Error signing out:', error);
    }
    setUser(null);
    localStorage.removeItem('edulinker_user');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/search" element={<SearchPage user={user} />} />
        <Route path="/sme-gateway" element={<SMEGateway />} />
        <Route path="/sdp-gateway" element={<SDPGateway />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/blogs" element={<BlogsPage />} />
        <Route path="/blogs/:slug" element={<BlogDetailPage />} />
        <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
        
        {/* Registration Routes */}
        <Route path="/register" element={<RegistrationChoice />} />
        <Route path="/register/sme" element={<SMERegistration />} />
        <Route path="/register/sdp" element={<SDPRegistration />} />
        <Route path="/register/admin" element={<AdminRegistration />} />
        
        {/* Edit Profile - Protected route */}
        <Route
          path="/edit-profile"
          element={
            user ? (
              <EditProfilePage user={user} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        
        {/* Debug Page - Public route */}
        <Route path="/debug/rating" element={<RatingDebugPage />} />
        
        {/* Payment Handler Routes */}
        <Route path="/payments/success" element={<PaymentSuccessPage />} />
        <Route path="/payments/cancelled" element={<PaymentCancelledPage />} />
        
        {/* Protected Routes */}
        <Route 
          path="/sme-dashboard" 
          element={
            user && user.role === 'SME' ? (
              <Layout user={user} onLogout={handleLogout}>
                <SMEDashboard user={user as any} />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />
        <Route 
          path="/sdp-dashboard" 
          element={
            user && user.role === 'SDP' ? (
              <Layout user={user} onLogout={handleLogout}>
                <SDPDashboard user={user as any} />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />
        <Route 
          path="/admin-dashboard" 
          element={
            user && user.role === 'Admin' ? (
              <Layout user={user} onLogout={handleLogout}>
                <AdminDashboard user={user as any} />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;