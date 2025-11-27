import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, CheckCircle, AlertCircle, Mail, Lock, User, Phone } from 'lucide-react';
import { Button } from '../ui/Button';
import { authService } from '../../firebase/auth';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { db, isFirebaseConfigured, functions } from '../../firebase/config';
import { httpsCallable } from 'firebase/functions';

interface AdminFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  adminKey: string; // Security key to prevent unauthorized admin creation
}

export function AdminRegistration() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState<AdminFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    adminKey: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validation
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.password) {
      setError('Please fill in all required fields');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    // Admin key validation (optional security measure)
    // Set VITE_ADMIN_REGISTRATION_KEY in your .env file or use default
    const validAdminKey = import.meta.env.VITE_ADMIN_REGISTRATION_KEY || 'ADMIN2024';
    if (formData.adminKey !== validAdminKey) {
      setError('Invalid admin registration key. Please contact system administrator.');
      setLoading(false);
      return;
    }

    if (!isFirebaseConfigured()) {
      setError('Firebase is not configured. Please contact support.');
      setLoading(false);
      return;
    }

    try {
      // Create user account
      // Note: We'll update the profile with the actual userId and phone after creation
      const result = await authService.signUp(formData.email, formData.password, {
        email: formData.email,
        role: 'Admin',
        verified: true,
        profile: {
          id: 'temp', // Will be updated with actual userId
          name: `${formData.firstName} ${formData.lastName}`,
          email: formData.email,
          roles: ['Platform Administrator'],
          role: 'Platform Administrator',
          specializations: ['Platform Management', 'User Support', 'System Administration'],
          sectors: ['Administration', 'Technology'],
          location: 'Head Office',
          experience: 'Admin',
          qualifications: ['Platform Administrator'],
          rates: {},
          availability: 'Available',
          rating: 0.0,
          reviews: 0,
          verified: true,
          profileImage: '',
          aboutMe: 'Platform administrator with full system access'
        }
      });

      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      if (!result.user) {
        setError('Failed to create admin account');
        setLoading(false);
        return;
      }

      // Get user ID from Firebase user object (it's 'uid', not 'id')
      // The signUp function already creates the Firestore document, so we just need to update it
      const firebaseUser = result.user as any;
      const userId = firebaseUser.uid;
      
      if (!userId) {
        setError('User ID not returned from registration');
        setLoading(false);
        return;
      }

      // Update the Firestore document to ensure it has all admin data
      // (signUp already created it, but we want to make sure it's complete)
      const userDocRef = doc(db, 'users', userId);
      const adminData = {
        email: formData.email,
        role: 'Admin',
        verified: true,
        phone: formData.phone,
        profile: {
          id: userId,
          name: `${formData.firstName} ${formData.lastName}`,
          email: formData.email,
          role: 'Platform Administrator',
          specializations: ['Platform Management', 'User Support', 'System Administration'],
          sectors: ['Administration', 'Technology'],
          location: 'Head Office',
          experience: 'Admin',
          qualifications: ['Platform Administrator'],
          rates: {},
          availability: 'Available',
          rating: 0.0,
          reviews: 0,
          verified: true,
          profileImage: '',
          aboutMe: 'Platform administrator with full system access'
        },
        updatedAt: Timestamp.now()
      };

      // Use merge to update existing document or create if it doesn't exist
      await setDoc(userDocRef, adminData, { merge: true });

      // Set custom claims using Cloud Function (after Firestore document is created)
      try {
        if (functions) {
          const setAdminClaims = httpsCallable(functions, 'setAdminClaims');
          // Pass admin key for unauthenticated calls
          await setAdminClaims({ 
            uid: userId,
            adminKey: formData.adminKey 
          });
          console.log('Admin custom claims set successfully');
        } else {
          console.warn('Cloud Functions not available. Custom claims will need to be set manually.');
        }
      } catch (claimsError: any) {
        console.warn('Could not set custom claims via Cloud Function:', claimsError);
        // Continue anyway - the user can still log in, but may need to refresh token
        // Custom claims can be set manually later via the admin script
      }

      setSuccess(true);
      
      // Auto-login and redirect after 2 seconds
      setTimeout(async () => {
        try {
          const loginResult = await authService.signIn(formData.email, formData.password);
          if (loginResult.user && !loginResult.error) {
            navigate('/admin-dashboard');
          } else {
            navigate('/login');
          }
        } catch (loginError) {
          navigate('/login');
        }
      }, 2000);

    } catch (err: any) {
      console.error('Admin registration error:', err);
      setError(err.message || 'Failed to create admin account. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50/30 to-blue-50/20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link to="/register" className="inline-flex items-center text-gray-600 hover:text-blue-600 transition-colors">
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Registration
          </Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Success Message */}
        {success && (
          <div className="mb-6 bg-green-50 border-2 border-green-200 rounded-xl p-6">
            <div className="flex items-start space-x-3">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold text-green-900 mb-2">Admin Account Created Successfully!</h3>
                <p className="text-green-800 mb-2">
                  Your admin account has been created. You will be redirected to the admin dashboard shortly.
                </p>
                <p className="text-sm text-green-700">
                  <strong>Email:</strong> {formData.email}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Registration Form */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 via-purple-700 to-blue-600 p-8 text-white">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <Shield className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Create Admin Account</h1>
                <p className="text-purple-100 mt-1">Platform Administrator Registration</p>
              </div>
            </div>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-8">
            {error && (
              <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            )}

            {/* Security Notice */}
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-blue-900 mb-1">Admin Access Required</p>
                  <p className="text-xs text-blue-800">
                    Admin accounts have full access to manage users, payments, disputes, and platform settings. 
                    Only authorized personnel should create admin accounts.
                  </p>
                </div>
              </div>
            </div>

            {/* Personal Information */}
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <User className="w-5 h-5 mr-2 text-purple-600" />
                Personal Information
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="0821234567"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Account Security */}
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <Lock className="w-5 h-5 mr-2 text-purple-600" />
                Account Security
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                    minLength={6}
                  />
                  <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                    minLength={6}
                  />
                </div>
              </div>
            </div>

            {/* Admin Registration Key */}
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <Shield className="w-5 h-5 mr-2 text-purple-600" />
                Admin Registration Key
              </h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Registration Key <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.adminKey}
                  onChange={(e) => setFormData({ ...formData, adminKey: e.target.value })}
                  placeholder="Enter admin registration key"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Contact system administrator for the admin registration key
                </p>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex items-center justify-between pt-6 border-t border-gray-200">
              <Link
                to="/register"
                className="text-gray-600 hover:text-gray-900 font-medium"
              >
                ← Back to Registration
              </Link>
              <Button
                type="submit"
                disabled={loading || success}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creating Account...
                  </>
                ) : success ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Account Created!
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 mr-2" />
                    Create Admin Account
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-gray-50 rounded-lg p-4 border border-gray-200">
          <p className="text-sm text-gray-600 text-center">
            Already have an admin account?{' '}
            <Link to="/login" className="text-purple-600 hover:text-purple-700 font-semibold">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

