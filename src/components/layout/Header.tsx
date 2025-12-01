import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, User, Search, Bell, LogOut } from 'lucide-react';
import { NotificationDropdown } from '../NotificationDropdown';

interface HeaderProps {
  user?: any;
  onAuthClick?: () => void;
  onLogout?: () => void;
}

export function Header({ user, onAuthClick, onLogout }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  const navItems = [
    { href: '/', label: 'Home' },
    { href: '/search', label: 'Find SMEs' },
    { href: '/sme-gateway', label: 'Become an SME' },
    { href: '/sdp-gateway', label: 'Become an SDP' },
    { href: '/blogs', label: 'Blogs' },
    { href: '/about', label: 'About' },
    { href: '/pricing', label: 'Pricing' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <img 
              src="/images/Screenshot 2025-10-27 at 22.21.45.png" 
              alt="EduLinker Logo" 
              className="h-12 w-auto"
            />
            <span className="text-xl font-bold text-gray-900">Scholarz</span>
          </Link>

          {/* Desktop Navigation - Hidden for logged-in users */}
          {!user && (
            <nav className="hidden md:flex space-x-8">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-700 hover:text-blue-600'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          )}
          
          {/* Logo Center for logged-in users */}
          {user && (
            <div className="flex-1 flex justify-center">
              <div className="text-lg font-semibold text-gray-700">
                {user.role === 'SME' ? 'SME Dashboard' : user.role === 'SDP' ? 'SDP Dashboard' : 'Admin Dashboard'}
              </div>
            </div>
          )}

          {/* User Actions */}
          <div className="flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-3">
                <button className="p-2 text-gray-600 hover:text-blue-600 transition-colors">
                  <Search className="w-5 h-5" />
                </button>
                {user?.id && <NotificationDropdown userId={user.id} />}
                <Link
                  to="/edit-profile"
                  className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  title="Edit Profile"
                >
                  {user?.profile?.profileImage ? (
                    <img
                      src={`${user.profile.profileImage}${user.profile.profileImageUpdatedAt ? `?v=${user.profile.profileImageUpdatedAt}` : ''}`}
                      alt={user.profile.name || 'Profile'}
                      className="w-8 h-8 rounded-full object-cover border-2 border-gray-200 hover:border-blue-500 transition-colors"
                      onError={(e) => {
                        // Fallback if image fails to load
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  )}
                  <span className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors">{user.profile.name}</span>
                </Link>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600 hover:text-red-600"
                    title="Logout"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
              )}
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <Link
                  to="/login"
                  className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Get Started
                </Link>
              </div>
            )}

            {/* Mobile menu button - Hidden for logged-in users */}
            {!user && (
              <button
                className="md:hidden p-2 text-gray-600 hover:text-blue-600 transition-colors"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
              >
                {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation - Only shown when user is not logged in */}
        {isMenuOpen && !user && (
          <div className="md:hidden py-4 border-t border-gray-200">
            <nav className="flex flex-col space-y-3">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`text-sm font-medium px-3 py-2 rounded-lg transition-colors ${
                    isActive(item.href)
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
                  }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <div className="flex flex-col space-y-2 pt-3 border-t border-gray-200">
                <Link
                  to="/login"
                  className="text-sm font-medium text-gray-700 hover:text-blue-600 px-3 py-2"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Get Started
                </Link>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}