import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Phone, MapPin, Building2, Upload, Save, ArrowLeft, Camera, CheckCircle, AlertCircle, Lock, Eye, EyeOff } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db, storage, isFirebaseConfigured, isStorageConfigured } from '../firebase/config';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { authService } from '../firebase/auth';
import { updateProfile } from 'firebase/auth';
import { auth } from '../firebase/config';

interface EditProfilePageProps {
  user: {
    id: string;
    email: string;
    role: 'SME' | 'SDP' | 'Admin';
    profile: any;
    verified: boolean;
  };
}

export function EditProfilePage({ user }: EditProfilePageProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  // Password change state
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  
  // Form data - dynamically based on role
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    // Initialize form data with current user profile
    setFormData({
      // Basic
      name: user.profile.name || '',
      email: user.email || '',
      phone: user.profile.phone || '',
      location: user.profile.location || '',
      aboutMe: user.profile.aboutMe || '',
      website: user.profile.website || '',
      
      // SME specific
      role: user.profile.role || '',
      specializations: user.profile.specializations || [],
      sectors: user.profile.sectors || [],
      experience: user.profile.experience || '',
      qualifications: user.profile.qualifications || [],
      rates: user.profile.rates || {},
      availability: user.profile.availability || 'Available',
      
      // SDP specific - Complete registration details
      companyName: user.profile.companyName || user.profile.name || '',
      registrationNumber: user.profile.registrationNumber || '',
      organizationType: user.profile.organizationType || user.profile.type || '',
      establishedYear: user.profile.establishedYear || '',
      setaAccreditation: user.profile.setaAccreditation || user.profile.accreditation || '',
      accreditationNumber: user.profile.accreditationNumber || '',
      isAccredited: user.profile.isAccredited || 'no',
      learnerCapacity: user.profile.learnerCapacity || user.profile.learners || '',
      services: user.profile.services || [],
      assessmentCentre: user.profile.assessmentCentre || false,
      goals: user.profile.goals || [],
      
      // Contact person details
      contactFirstName: user.profile.contactFirstName || '',
      contactLastName: user.profile.contactLastName || '',
      contactEmail: user.profile.contactEmail || user.email || '',
      contactPhone: user.profile.contactPhone || user.profile.phone || '',
      contactPosition: user.profile.contactPosition || '',
    });
    setPreviewImage(user.profile.profileImage || null);
  }, [user]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setMessage({ type: 'error', text: 'Image size should be less than 5MB' });
        return;
      }
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setMessage({ type: 'error', text: 'Please select a valid image file' });
        return;
      }
      
      setProfileImage(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleArrayFieldChange = (field: string, value: string) => {
    setFormData((prev: any) => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter((item: string) => item !== value)
        : [...prev[field], value]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      let updatedData: any = { ...formData };
      
      // Upload profile image if changed
      if (profileImage && isFirebaseConfigured() && isStorageConfigured()) {
        try {
          // Use consistent filename to overwrite previous image
          // This ensures we always have one profile image per user
          const fileExtension = profileImage.name.split('.').pop()?.toLowerCase() || 'jpg';
          const consistentFileName = `profile.${fileExtension}`;
          const imageRef = ref(storage, `users/${user.id}/profile/${consistentFileName}`);
          
          // Delete old profile image if it exists (optional - Firebase Storage will overwrite)
          // But we'll keep the old one for now to avoid errors
          
          // Upload new image (overwrites existing file with same name)
          await uploadBytes(imageRef, profileImage);
          const imageUrl = await getDownloadURL(imageRef);
          
          // Store clean URL in Firestore (without cache busting)
          // We'll add timestamp when displaying to force browser refresh
          updatedData.profileImage = imageUrl;
          
          console.log('Profile image uploaded successfully:', imageUrl);
        } catch (error: any) {
          console.error('Error uploading image:', error);
          setMessage({ type: 'error', text: `Failed to upload profile image: ${error.message || 'Unknown error'}` });
          setLoading(false);
          return;
        }
      } else if (profileImage) {
        // Fallback to localStorage for demo
        const reader = new FileReader();
        reader.onloadend = () => {
          updatedData.profileImage = reader.result as string;
        };
        reader.readAsDataURL(profileImage);
      }

      // Update Firestore
      if (isFirebaseConfigured()) {
        const userRef = doc(db, 'users', user.id);
        
        // Ensure profileImage is properly included in the profile object
        const profileUpdate = {
          ...updatedData,
          // Preserve existing profileImage if no new one was uploaded
          profileImage: updatedData.profileImage || user.profile?.profileImage || '',
          // Add image version timestamp to force browser refresh when image changes
          profileImageUpdatedAt: updatedData.profileImage ? new Date().getTime() : (user.profile?.profileImageUpdatedAt || null)
        };
        
        const updatePayload: any = {
          email: updatedData.email,
          updatedAt: new Date(),
          profile: profileUpdate
        };
        
        await updateDoc(userRef, updatePayload);

        // Also update Firebase Auth display name and photo URL if changed
        if (auth.currentUser) {
          try {
            const authUpdates: any = {};
            
            if (updatedData.name && updatedData.name !== user.profile?.name) {
              authUpdates.displayName = updatedData.name;
            }
            
            if (updatedData.profileImage && updatedData.profileImage !== user.profile?.profileImage) {
              // Use clean URL for Firebase Auth photoURL
              authUpdates.photoURL = updatedData.profileImage;
            }
            
            if (Object.keys(authUpdates).length > 0) {
              await updateProfile(auth.currentUser, authUpdates);
              console.log('Firebase Auth profile updated');
            }
          } catch (authError: any) {
            console.warn('Could not update auth profile:', authError);
            // Non-critical, continue
          }
        }

        // Update localStorage immediately for instant UI update
        try {
          const currentUserData = await getDoc(userRef);
          if (currentUserData.exists()) {
            const updatedUserData = {
              id: user.id,
              ...currentUserData.data(),
              role: user.role,
              verified: user.verified
            };
            localStorage.setItem('edulinker_user', JSON.stringify(updatedUserData));
          }
        } catch (localError) {
          console.warn('Could not update localStorage:', localError);
        }

        setMessage({ type: 'success', text: 'Profile updated successfully! Refreshing...' });
        
        // Reload the page to reflect changes and refresh user state
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        // Update localStorage for demo
        const storedUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        storedUser.email = updatedData.email;
        storedUser.profile = updatedData;
        localStorage.setItem('currentUser', JSON.stringify(storedUser));
        
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } catch (error: any) {
      console.error('Error updating profile:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to update profile' });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordLoading(true);
    setMessage(null);

    // Validation
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'Please fill in all password fields' });
      setPasswordLoading(false);
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setMessage({ type: 'error', text: 'New password must be at least 6 characters long' });
      setPasswordLoading(false);
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'New password and confirm password do not match' });
      setPasswordLoading(false);
      return;
    }

    if (passwordData.currentPassword === passwordData.newPassword) {
      setMessage({ type: 'error', text: 'New password must be different from current password' });
      setPasswordLoading(false);
      return;
    }

    try {
      const result = await authService.changePassword(
        passwordData.currentPassword,
        passwordData.newPassword
      );

      if (result.error) {
        setMessage({ type: 'error', text: result.error });
      } else {
        setMessage({ type: 'success', text: 'Password changed successfully!' });
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
        setShowPasswordSection(false);
      }
    } catch (error: any) {
      console.error('Error changing password:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to change password' });
    } finally {
      setPasswordLoading(false);
    }
  };

  const renderSMEFields = () => (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Role/Title</label>
          <input
            type="text"
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g., Skills Development Facilitator"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Experience</label>
          <input
            type="text"
            value={formData.experience}
            onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g., 5+ years"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Specializations</label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {['Facilitation', 'Assessment', 'Moderation', 'Consultation', 'Training Design', 'Workplace Assessment'].map((spec) => (
            <label key={spec} className="flex items-center space-x-2 cursor-pointer bg-gray-50 p-2 rounded hover:bg-blue-50 transition-colors">
              <input
                type="checkbox"
                checked={formData.specializations?.includes(spec)}
                onChange={() => handleArrayFieldChange('specializations', spec)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">{spec}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Sectors</label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {['ETDP', 'BANKSETA', 'SERVICES SETA', 'MANUFACTURING', 'CONSTRUCTION', 'HEALTHCARE'].map((sector) => (
            <label key={sector} className="flex items-center space-x-2 cursor-pointer bg-gray-50 p-2 rounded hover:bg-blue-50 transition-colors">
              <input
                type="checkbox"
                checked={formData.sectors?.includes(sector)}
                onChange={() => handleArrayFieldChange('sectors', sector)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">{sector}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Availability</label>
        <select
          value={formData.availability}
          onChange={(e) => setFormData({ ...formData, availability: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="Available">Available</option>
          <option value="Limited">Limited</option>
          <option value="Unavailable">Unavailable</option>
        </select>
      </div>
    </>
  );

  const renderSDPFields = () => (
    <>
      {/* Company Information */}
      <div className="mb-6">
        <h4 className="text-md font-semibold text-gray-800 mb-4">Company Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Company Name</label>
            <input
              type="text"
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Your company name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Registration Number</label>
            <input
              type="text"
              value={formData.registrationNumber}
              onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Company registration number"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Website</label>
            <input
              type="url"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="https://www.example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Organization Type</label>
            <input
              type="text"
              value={formData.organizationType}
              onChange={(e) => setFormData({ ...formData, organizationType: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Training Provider, Private Company"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Year Established</label>
            <input
              type="text"
              value={formData.establishedYear}
              onChange={(e) => setFormData({ ...formData, establishedYear: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., 2015"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Learner Capacity</label>
            <input
              type="text"
              value={formData.learnerCapacity}
              onChange={(e) => setFormData({ ...formData, learnerCapacity: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., 500+ learners annually"
            />
          </div>
        </div>
      </div>

      {/* Accreditation Details */}
      <div className="mb-6 border-t border-gray-200 pt-6">
        <h4 className="text-md font-semibold text-gray-800 mb-4">Accreditation Details</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Are you accredited?</label>
            <select
              value={formData.isAccredited}
              onChange={(e) => setFormData({ ...formData, isAccredited: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>

          {formData.isAccredited === 'yes' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">SETA Accreditation</label>
                <input
                  type="text"
                  value={formData.setaAccreditation}
                  onChange={(e) => setFormData({ ...formData, setaAccreditation: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., ETDP SETA"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Accreditation Number</label>
                <input
                  type="text"
                  value={formData.accreditationNumber}
                  onChange={(e) => setFormData({ ...formData, accreditationNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., ETDP12345"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Contact Person */}
      <div className="mb-6 border-t border-gray-200 pt-6">
        <h4 className="text-md font-semibold text-gray-800 mb-4">Primary Contact Person</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
            <input
              type="text"
              value={formData.contactFirstName}
              onChange={(e) => setFormData({ ...formData, contactFirstName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Contact person's first name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
            <input
              type="text"
              value={formData.contactLastName}
              onChange={(e) => setFormData({ ...formData, contactLastName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Contact person's last name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Position/Title</label>
            <input
              type="text"
              value={formData.contactPosition}
              onChange={(e) => setFormData({ ...formData, contactPosition: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Training Manager, CEO"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Contact Email</label>
            <input
              type="email"
              value={formData.contactEmail}
              onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="contact@company.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Contact Phone</label>
            <input
              type="tel"
              value={formData.contactPhone}
              onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="+27 11 123 4567"
            />
          </div>
        </div>
      </div>

      {/* Services and Assessment Centre */}
      <div className="mb-6 border-t border-gray-200 pt-6">
        <h4 className="text-md font-semibold text-gray-800 mb-4">Services & Offerings</h4>
        
        <div className="mb-4">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.assessmentCentre}
              onChange={(e) => setFormData({ ...formData, assessmentCentre: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Assessment Centre</span>
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Services Offered</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {['Skills Training', 'Assessment', 'Moderation', 'RPL', 'Learnerships', 'Short Courses'].map((service) => (
              <label key={service} className="flex items-center space-x-2 cursor-pointer bg-gray-50 p-2 rounded hover:bg-blue-50 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.services?.includes(service)}
                  onChange={() => handleArrayFieldChange('services', service)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{service}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 transition-colors mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Dashboard</span>
          </button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Edit Profile</h1>
              <p className="text-gray-600">Update your profile information and settings</p>
            </div>
            <Badge variant={user.verified ? 'success' : 'warning'} size="lg">
              {user.verified ? 'Verified' : 'Pending Verification'}
            </Badge>
          </div>
        </div>

        {/* Message Alert */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-start space-x-3 ${
            message.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            )}
            <p className={`text-sm ${message.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
              {message.text}
            </p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          {/* Profile Image Section */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-8">
            <div className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-6">
              <div className="relative">
                {previewImage ? (
                  <img
                    src={previewImage}
                    alt="Profile"
                    className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-lg"
                    onError={(e) => {
                      // Fallback if image fails to load
                      (e.target as HTMLImageElement).src = '/images/profile-1.jpg';
                    }}
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-white/20 flex items-center justify-center border-4 border-white shadow-lg">
                    <User className="w-16 h-16 text-white" />
                  </div>
                )}
                <label className="absolute bottom-0 right-0 bg-white rounded-full p-2 shadow-lg cursor-pointer hover:bg-gray-100 transition-colors">
                  <Camera className="w-5 h-5 text-blue-600" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
              </div>
              <div className="text-white text-center md:text-left">
                <h2 className="text-2xl font-bold mb-1">{formData.name}</h2>
                <p className="text-blue-100 mb-2">{user.role}</p>
                <p className="text-sm text-blue-200">Click the camera icon to update your profile picture</p>
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="p-8 space-y-6">
            {/* Basic Information */}
            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <User className="w-5 h-5 mr-2 text-blue-600" />
                Basic Information
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter your full name"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="your@email.com"
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="+27 11 123 4567"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Johannesburg, Gauteng"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">About Me</label>
                <textarea
                  value={formData.aboutMe}
                  onChange={(e) => setFormData({ ...formData, aboutMe: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Tell us about yourself, your experience, and what you offer..."
                />
              </div>
            </div>

            {/* Role-specific fields */}
            {user.role !== 'Admin' && (
              <div className="border-b border-gray-200 pb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Building2 className="w-5 h-5 mr-2 text-blue-600" />
                  {user.role} Specific Information
                </h3>
                
                {user.role === 'SME' && renderSMEFields()}
                {user.role === 'SDP' && renderSDPFields()}
              </div>
            )}

            {/* Change Password Section - For Admin */}
            {user.role === 'Admin' && (
              <div className="border-b border-gray-200 pb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <Lock className="w-5 h-5 mr-2 text-blue-600" />
                    Change Password
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowPasswordSection(!showPasswordSection);
                      if (showPasswordSection) {
                        setPasswordData({
                          currentPassword: '',
                          newPassword: '',
                          confirmPassword: ''
                        });
                        setMessage(null);
                      }
                    }}
                  >
                    {showPasswordSection ? 'Cancel' : 'Change Password'}
                  </Button>
                </div>

                {showPasswordSection && (
                  <form onSubmit={handlePasswordChange} className="space-y-4 bg-gray-50 p-6 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Current Password
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                          type={showPasswords.current ? 'text' : 'password'}
                          value={passwordData.currentPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Enter current password"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showPasswords.current ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        New Password
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                          type={showPasswords.new ? 'text' : 'password'}
                          value={passwordData.newPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Enter new password (min. 6 characters)"
                          required
                          minLength={6}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showPasswords.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Confirm New Password
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                          type={showPasswords.confirm ? 'text' : 'password'}
                          value={passwordData.confirmPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Confirm new password"
                          required
                          minLength={6}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showPasswords.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button
                        type="submit"
                        disabled={passwordLoading}
                        className="min-w-[150px]"
                      >
                        {passwordLoading ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                            Updating...
                          </>
                        ) : (
                          <>
                            <Lock className="w-4 h-4 mr-2" />
                            Update Password
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-4 pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(-1)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="min-w-[150px]"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

