import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { SearchInterface } from '../components/search/SearchInterface';
import { SME, User } from '../types';
import { Badge } from '../components/ui/Badge';
import { DollarSign } from 'lucide-react';
import { db, isFirebaseConfigured } from '../firebase/config';
import { collection, getDocs, query, where, onSnapshot } from 'firebase/firestore';

interface SearchPageProps {
  user?: User | null;
}

export function SearchPage({ user }: SearchPageProps) {
  const navigate = useNavigate();
  const [smes, setSMEs] = useState<SME[]>([]);
  const [selectedSME, setSelectedSME] = useState<SME | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSMEs();
    
    // Return cleanup function for real-time listener
    return () => {
      // Cleanup will be handled by onSnapshot unsubscribe
    };
  }, []);

  const loadSMEs = () => {
    if (!isFirebaseConfigured()) {
      console.warn('Firebase not configured');
      setSMEs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const usersRef = collection(db, 'users');
    
    // Query for users with SME role AND verified status
    const q = query(
      usersRef, 
      where('role', '==', 'SME'),
      where('verified', '==', true)
    );
    
    console.log('Loading verified SMEs from Firestore...');
    
    // Use real-time listener for live updates
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        console.log(`Found ${snapshot.size} verified SME users in Firestore`);
        const smesData: SME[] = [];
        
        snapshot.forEach((doc) => {
          const userData = doc.data();
          const profile = userData.profile || {};
          
          // Log for debugging
          if (snapshot.size <= 5) {
            console.log('User data:', { id: doc.id, email: userData.email, hasProfile: !!userData.profile, profileKeys: Object.keys(profile) });
          }
          
          // Map user data to SME interface
          const sme: SME = {
            id: doc.id,
            name: profile.name || userData.email || 'Unknown',
            email: userData.email || '',
            roles: profile.roles || (profile.role ? [profile.role] : []),
            role: profile.role, // legacy support
            specializations: profile.specializations || [],
            sectors: profile.sectors || [],
            location: profile.location || profile.locations?.[0] || 'Not specified',
            locations: profile.locations || [],
            experience: profile.experience || 'Not specified',
            qualifications: profile.qualifications || [],
            qualificationSpecs: profile.qualificationSpecs || {},
            otherRole: profile.otherRole,
            rates: profile.rates || {},
            availability: profile.availability || 'Available',
            rating: profile.rating || 0,
            reviews: profile.reviews || 0,
            verified: userData.verified || profile.verified || false,
            profileImage: profile.profileImage || '/images/profile-1.jpg',
            aboutMe: profile.aboutMe,
            phone: profile.phone,
            setaRegistration: profile.setaRegistration,
            setaRegistrations: profile.setaRegistrations || {},
            documentCertificationDate: profile.documentCertificationDate,
            documentCertificationDates: profile.documentCertificationDates,
            documentsCertificationConfirmed: profile.documentsCertificationConfirmed,
            cv: profile.cv,
            testimonials: profile.testimonials,
            planType: userData.planType,
            planStatus: userData.planStatus,
            planActivatedAt: userData.planActivatedAt,
            planExpiresAt: userData.planExpiresAt,
            planReference: userData.planReference,
            planRequiresPayment: userData.planRequiresPayment,
            planExpiredAt: userData.planExpiredAt,
            planIssue: userData.planIssue,
            billingProfile: userData.billingProfile
          };
          
          smesData.push(sme);
        });
        
        console.log(`Mapped ${smesData.length} SMEs for display`);
        setSMEs(smesData);
        setLoading(false);
      },
      (error) => {
        console.error('Error loading SME data:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        setLoading(false);
      }
    );
    
    // Return cleanup function
    return () => {
      unsubscribe();
    };
  };

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