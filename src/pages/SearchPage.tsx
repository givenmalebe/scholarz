import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { SearchInterface } from '../components/search/SearchInterface';
import { SME, User } from '../types';
import { Badge } from '../components/ui/Badge';
import { DollarSign } from 'lucide-react';

interface SearchPageProps {
  user?: User | null;
}

export function SearchPage({ user }: SearchPageProps) {
  const navigate = useNavigate();
  const [smes, setSMEs] = useState<SME[]>([]);
  const [selectedSME, setSelectedSME] = useState<SME | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load mock data
    fetch('/data/mock-data.json')
      .then(response => response.json())
      .then(data => {
        setSMEs(data.smes);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error loading SME data:', error);
        setLoading(false);
      });
  }, []);

  const handleSMESelect = (sme: SME) => {
    // Check if user is logged in
    if (!user) {
      // Store the selected SME ID in localStorage to restore after login
      localStorage.setItem('edulinker_pending_sme', JSON.stringify(sme));
      // Redirect to login page
      navigate('/login');
      return;
    }
    
    setSelectedSME(sme);
    // In a real app, this would navigate to the SME profile page
    console.log('Selected SME:', sme);
  };

  if (loading) {
    return (
      <Layout user={user}>
        <div className="flex items-center justify-center min-h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user}>
      <div className="bg-gray-50 min-h-screen">
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Find Subject Matter Experts
            </h1>
            <p className="text-lg text-gray-600">
              Search and connect with verified SMEs across South Africa. Find the right expertise for your training and assessment needs.
            </p>
            <div className="mt-4 flex items-center space-x-4">
              <Badge variant="info" size="lg" className="text-base px-4 py-2">
                <DollarSign className="w-5 h-5 mr-2" />
                Standard Engagement Fee: R2,500
              </Badge>
              <p className="text-sm text-gray-500">All engagements are standard priced for transparency</p>
            </div>
          </div>
        </div>
        
        <SearchInterface smes={smes} onSMESelect={handleSMESelect} />
      </div>
    </Layout>
  );
}