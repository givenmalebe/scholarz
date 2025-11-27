import React from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Twitter, Linkedin, Mail, Phone, MapPin } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <img 
                src="/images/Screenshot 2025-10-27 at 22.21.45.png" 
                alt="EduLinker Logo" 
                className="h-12 w-auto"
              />
              <span className="text-xl font-bold">Scholarz</span>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed">
              Connecting Skills Development Providers with qualified Subject Matter Experts across South Africa.
              Building the future of skills development together.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-gray-400 hover:text-blue-400 transition-colors">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-blue-400 transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-blue-400 transition-colors">
                <Linkedin className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/search" className="text-gray-300 hover:text-white transition-colors">Find SMEs</Link></li>
              <li><Link to="/sme-gateway" className="text-gray-300 hover:text-white transition-colors">Become an SME</Link></li>
              <li><Link to="/register" className="text-gray-300 hover:text-white transition-colors">Register as SDP</Link></li>
              <li><Link to="/pricing" className="text-gray-300 hover:text-white transition-colors">Pricing</Link></li>
              <li><Link to="/about" className="text-gray-300 hover:text-white transition-colors">About Us</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Support</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/help" className="text-gray-300 hover:text-white transition-colors">Help Center</Link></li>
              <li><Link to="/verification" className="text-gray-300 hover:text-white transition-colors">Verification Process</Link></li>
              <li><Link to="/seta-info" className="text-gray-300 hover:text-white transition-colors">SETA Information</Link></li>
              <li><Link to="/terms" className="text-gray-300 hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link to="/privacy" className="text-gray-300 hover:text-white transition-colors">Privacy Policy</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Contact Us</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4 text-blue-400" />
                <span className="text-gray-300">support@edulinker.co.za</span>
              </div>
              <div className="flex items-center space-x-2">
                <Phone className="w-4 h-4 text-blue-400" />
                <span className="text-gray-300">+27 11 123 4567</span>
              </div>
              <div className="flex items-start space-x-2">
                <MapPin className="w-4 h-4 text-blue-400 mt-0.5" />
                <span className="text-gray-300">
                  123 Business District<br />
                  Johannesburg, 2000<br />
                  South Africa
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <p className="text-gray-400 text-sm">
              © 2025 Scholarz. All rights reserved. Proudly South African.
            </p>
            <div className="flex space-x-6 text-sm">
              <span className="text-gray-400">SETA Compliant</span>
              <span className="text-gray-400">GDPR/POPIA Compliant</span>
              <span className="text-gray-400">Secure Platform</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}