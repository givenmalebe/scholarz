import React from 'react';
import { Link } from 'react-router-dom';
import { Users, Building2, ArrowRight, CheckCircle, ArrowLeft, Shield, TrendingUp, Target } from 'lucide-react';
import { Button } from '../ui/Button';

export function RegistrationChoice() {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-blue-700 to-green-600 p-12 flex-col justify-between">
        <div>
          <Link to="/" className="inline-flex items-center text-white mb-8 hover:text-blue-100 transition-colors">
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
            Join Our Platform
            <br />
            <span className="text-green-200">Connect & Grow</span>
          </h1>
          <p className="text-xl text-blue-100 leading-relaxed mb-8">
            Join South Africa's premier platform connecting Skills Development Providers with verified Subject Matter Experts.
          </p>
          
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
              <Shield className="w-8 h-8 text-white mb-2" />
              <div className="text-3xl font-bold text-white mb-1">847+</div>
              <div className="text-blue-100 text-sm">Verified SMEs</div>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
              <Target className="w-8 h-8 text-white mb-2" />
              <div className="text-3xl font-bold text-white mb-1">156+</div>
              <div className="text-blue-100 text-sm">Partner SDPs</div>
            </div>
          </div>
        </div>
        
        <div className="mt-12">
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <p className="text-white font-medium mb-4 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2" />
              Why Join Us?
            </p>
            <div className="space-y-3">
              <div className="flex items-start text-white">
                <CheckCircle className="w-5 h-5 text-green-300 mr-2 flex-shrink-0 mt-0.5" />
                <span className="text-blue-100">SETA Verified Platform</span>
              </div>
              <div className="flex items-start text-white">
                <CheckCircle className="w-5 h-5 text-green-300 mr-2 flex-shrink-0 mt-0.5" />
                <span className="text-blue-100">Transparent Pricing</span>
              </div>
              <div className="flex items-start text-white">
                <CheckCircle className="w-5 h-5 text-green-300 mr-2 flex-shrink-0 mt-0.5" />
                <span className="text-blue-100">Secure Document Management</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Registration Options */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <div className="max-w-4xl w-full">
          {/* Mobile Header */}
          <div className="lg:hidden mb-8">
            <Link to="/" className="inline-flex items-center text-gray-600 hover:text-blue-600 mb-6">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Link>
            <div className="flex items-center space-x-2 mb-6">
              <img 
                src="/images/Screenshot 2025-10-27 at 22.21.45.png" 
                alt="EduLinker Logo" 
                className="h-10 w-auto"
              />
              <span className="text-2xl font-bold text-gray-900">Scholarz</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Choose Your Path
            </h1>
            <p className="text-gray-600">
              Select how you'd like to join our platform
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* SME Registration */}
          <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-8 flex flex-col border-2 border-transparent hover:border-green-200">
            <div className="text-center mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-green-100 to-green-50 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Users className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Subject Matter Expert
              </h2>
              <p className="text-gray-600 text-sm">
                Join as a facilitator, assessor, moderator, or consultant
              </p>
            </div>

            <div className="space-y-2.5 mb-6 flex-grow">
              <div className="flex items-start space-x-3">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700 text-sm">Showcase your expertise</span>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700 text-sm">Connect with SDPs</span>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700 text-sm">Flexible engagement terms</span>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700 text-sm">SETA verification</span>
              </div>
            </div>

            {/* Removed price box per request */}

            <Link to="/register/sme" className="block mt-auto">
              <Button className="w-full bg-green-600 hover:bg-green-700" size="lg">
                Register as SME
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>

          {/* SDP Registration */}
          <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-8 flex flex-col border-2 border-transparent hover:border-blue-200">
            <div className="text-center mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Building2 className="w-10 h-10 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Skills Development Provider
              </h2>
              <p className="text-gray-600 text-sm">
                Register your training organization or assessment centre
              </p>
            </div>

            <div className="space-y-2.5 mb-6 flex-grow">
              <div className="flex items-start space-x-3">
                <CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700 text-sm">Access qualified SMEs</span>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700 text-sm">Manage engagements</span>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700 text-sm">Document management</span>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700 text-sm">SETA accreditation verified</span>
              </div>
            </div>

            {/* Removed price box per request */}

            <Link to="/register/sdp" className="block mt-auto">
              <Button className="w-full bg-blue-600 hover:bg-blue-700" size="lg">
                Register as SDP
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>
          </div>

          <div className="text-center mt-8">
            <p className="text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="text-blue-600 hover:text-blue-700 font-semibold">
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}