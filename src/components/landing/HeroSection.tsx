import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle, Users, Award, Shield } from 'lucide-react';
import { Button } from '../ui/Button';

export function HeroSection() {
  return (
    <section className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-green-600 overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-96 h-96 bg-white/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-green-500/5 rounded-full blur-3xl"></div>
      </div>
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="space-y-8 text-white">
            <div className="space-y-6">
              {/* Badge */}
              <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-lg rounded-full px-4 py-2 border border-white/20">
                <Shield className="w-4 h-4" />
                <span className="text-sm font-medium">SETA Compliant Platform</span>
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              </div>
              
              {/* Headline */}
              <h1 className="text-5xl lg:text-6xl font-extrabold leading-tight">
                Connect Skills, Build 
                <span className="block text-green-300">Future Talent</span>
              </h1>
              
              <p className="text-xl text-blue-100 leading-relaxed max-w-xl">
                Scholarz is South Africa's platform connecting accredited Skills Development Providers 
                with verified Subject Matter Experts. <strong className="text-green-300">Earn from every engagement (10% platform fee deducted).</strong> Streamline your training with our AI-powered matching system.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/sdp-gateway">
                <Button size="lg" className="w-full sm:w-auto bg-white text-blue-600 hover:bg-gray-100 shadow-xl" variant="secondary">
                  Get Started as SDP
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Link to="/sme-gateway">
                <Button size="lg" className="w-full sm:w-auto bg-transparent border-2 border-white text-white hover:bg-white hover:text-blue-600" variant="outline">
                  Join as SME
                </Button>
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 pt-8">
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
                <div className="text-3xl font-bold text-white">847+</div>
                <div className="text-sm text-blue-100">Verified SMEs</div>
              </div>
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
                <div className="text-3xl font-bold text-white">156+</div>
                <div className="text-sm text-blue-100">Partner SDPs</div>
              </div>
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
                <div className="text-3xl font-bold text-green-300">R2500</div>
                <div className="text-sm text-blue-100">minimum engagement</div>
              </div>
            </div>
          </div>

          {/* Right Content - Hero Image */}
          <div className="relative hidden lg:block">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl ring-4 ring-white/20">
              <img
                src="/images/Whisk_9c08a2fb5c7974ea88345e139e6ef374dr.png"
                alt="Professional training session"
                className="w-full h-[600px] object-cover"
              />
              
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}