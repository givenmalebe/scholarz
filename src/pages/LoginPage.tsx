import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { User } from '../types';
import { authService } from '../firebase/auth';
import { isFirebaseConfigured } from '../firebase/config';

interface LoginPageProps {
  onLogin: (user: User) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Authenticate with Firebase
      if (!isFirebaseConfigured()) {
        setError('Firebase is not configured. Please contact support.');
        setLoading(false);
        return;
      }

      const result = await authService.signIn(email, password);
      
      if (result.user && !result.error) {
        // Successfully authenticated with Firebase
        const userData: User = {
          id: result.user.id || '',
          email: result.user.email || email,
          role: result.user.role as 'SME' | 'SDP' | 'Admin',
          profile: result.user.profile,
          verified: result.user.verified || false
        };
        
        onLogin(userData);
        
        // Navigate to appropriate dashboard
        const dashboardPath = userData.role === 'SME' ? '/sme-dashboard' : userData.role === 'SDP' ? '/sdp-dashboard' : '/admin-dashboard';
          navigate(dashboardPath);
      } else {
        setError(result.error || 'Invalid email or password. Please check your credentials and try again.');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'An error occurred during login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-blue-700 to-green-600 p-12 flex-col justify-between">
        <div>
          <Link to="/" className="inline-flex items-center text-white mb-8">
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Home
          </Link>
          
          <div className="flex items-center space-x-3 mb-12">
            <img 
              src="/images/Screenshot 2025-10-27 at 22.21.45.png" 
              alt="EduLinker Logo" 
              className="h-12 w-auto"
            />
            <span className="text-3xl font-bold text-white">Scholarz</span>
          </div>
          
          <h1 className="text-5xl font-bold text-white mb-6">
            Welcome Back to
            <br />
            Scholarz
          </h1>
          <p className="text-xl text-blue-100 leading-relaxed">
            Connect with verified SMEs and accredited SDPs across South Africa.
          </p>
        </div>
        
        <div className="mt-12">
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <p className="text-white font-medium mb-4">Platform Stats</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-3xl font-bold text-white">847+</div>
                <div className="text-blue-100 text-sm">Verified SMEs</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white">156+</div>
                <div className="text-blue-100 text-sm">Partner SDPs</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <div className="max-w-md w-full">
          {/* Mobile Header */}
          <div className="lg:hidden mb-8">
            <Link to="/" className="inline-flex items-center text-gray-600 hover:text-blue-600 mb-6">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Link>
            <div className="flex items-center space-x-2 mb-4">
              <img 
                src="/images/Screenshot 2025-10-27 at 22.21.45.png" 
                alt="EduLinker Logo" 
                className="h-10 w-auto"
              />
              <span className="text-2xl font-bold text-gray-900">Scholarz</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Sign In
              </h2>
              <p className="text-gray-600">
                Enter your credentials to access your account
              </p>
            </div>


            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="Enter your email"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-14 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    className="rounded border-2 border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-600">Remember me</span>
                </label>
                
                <a href="#" className="text-sm font-medium text-blue-600 hover:text-blue-700">
                  Forgot password?
                </a>
              </div>
              
              <Button
                type="submit"
                className="w-full py-3.5 text-base font-semibold"
                size="lg"
                disabled={loading}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
            
            <div className="mt-6 text-center">
              <p className="text-gray-600">
                Don't have an account?{' '}
                <Link to="/register" className="font-semibold text-blue-600 hover:text-blue-700">
                  Create one here
                </Link>
              </p>
            </div>
          </div>
          
          <div className="text-center mt-6">
            <p className="text-xs text-gray-500">
              By signing in, you agree to our{' '}
              <a href="#" className="text-blue-600 hover:text-blue-700">Terms of Service</a>
              {' '}and{' '}
              <a href="#" className="text-blue-600 hover:text-blue-700">Privacy Policy</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}