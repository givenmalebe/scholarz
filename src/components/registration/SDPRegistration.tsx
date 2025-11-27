import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Upload, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { authService } from '../../firebase/auth';
import { SDP } from '../../types';
import { httpsCallable } from 'firebase/functions';
import { functions, isFirebaseConfigured } from '../../firebase/config';

type SDPPlanKey = 'free' | 'monthly' | 'annual';

interface PlanDefinition {
  label: string;
  amount: number;
  billingType: 'trial' | 'subscription' | 'once_off';
  durationDays?: number;
  payfastPlanId: string;
  description: string;
}

interface PayfastResponseData {
  paymentId: string;
  paymentUrl?: string;
  paymentStatus: string;
  amount: number;
  currency: string;
  expiresAt?: { seconds: number; nanoseconds: number } | null;
  message?: string;
}

const SDP_PLAN_DETAILS: Record<SDPPlanKey, PlanDefinition> = {
  free: {
    label: 'Free Trial',
    amount: 0,
    billingType: 'trial',
    durationDays: 30,
    payfastPlanId: 'sdp-free',
    description: '30-day trial to explore Scholarz'
  },
  monthly: {
    label: 'SDP Monthly',
    amount: 149,
    billingType: 'subscription',
    durationDays: 30,
    payfastPlanId: 'sdp-monthly',
    description: 'Introductory offer for the first 3 months'
  },
  annual: {
    label: 'SDP Annual',
    amount: 2499,
    billingType: 'subscription',
    durationDays: 365,
    payfastPlanId: 'sdp-annual',
    description: 'Annual membership with savings'
  }
};

const formatAmount = (amount: number) => `R${amount.toLocaleString('en-ZA')}`;

const computeExpiryDate = (durationDays?: number) => {
  if (!durationDays) return undefined;
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + durationDays);
  return expiry.toISOString();
};

const normalizeFirestoreTimestamp = (value: any): string | undefined => {
  if (!value) return undefined;
  if (typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  if (typeof value === 'object' && typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000).toISOString();
  }
  return undefined;
};

interface SDPFormData {
  // Company Information
  companyName: string;
  registrationNumber: string;
  email: string;
  phone: string;
  website: string;
  
  // Contact Person
  contactFirstName: string;
  contactLastName: string;
  contactEmail: string;
  contactPhone: string;
  contactPosition: string;
  password: string;
  confirmPassword: string;
  
  // Organization Details
  organizationType: string;
  establishedYear: string;
  sectors: string[];
  otherSector: string;
  location: string;
  sectorAccreditations: { [sector: string]: string };
  
  // Accreditation
  setaAccreditation: string;
  accreditationNumber: string;
  qualifications: string[];
  isAccredited: 'yes' | 'no';
  goals: string[];
  otherGoal: string;
  
  // Services
  services: string[];
  otherService: string;
  learnerCapacity: string;
  assessmentCentre: boolean;
  
  // New SDP Status
  isNewSDP: boolean;
  
  // Documents (CIPC removed as it's the same as Company Registration)
  documents: {
    companyRegistration: File | null;
    accreditations: File | null;
    referenceLetters: File[];
    appointmentForVerification: File | null;
    idForVerification: File | null;
    additionalDocuments: File[];  // Any other related documents
  };
  
  // Payment
  paymentPlan: 'free' | 'monthly' | 'annual' | '';
  termsAccepted: boolean;
}

export function SDPRegistration() {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorSections, setErrorSections] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentReceipt, setPaymentReceipt] = useState<{ reference: string; amount: string; expiresAt?: string } | null>(null);
  const [formData, setFormData] = useState<SDPFormData>({
    companyName: '',
    registrationNumber: '',
    email: '',
    phone: '',
    website: '',
    contactFirstName: '',
    contactLastName: '',
    contactEmail: '',
    contactPhone: '',
    contactPosition: '',
    password: '',
    confirmPassword: '',
    organizationType: '',
    establishedYear: '',
    sectors: [],
    otherSector: '',
    location: '',
    sectorAccreditations: {},
    setaAccreditation: '',
    accreditationNumber: '',
    qualifications: [],
    isAccredited: 'no',
    goals: [],
    otherGoal: '',
    services: [],
    otherService: '',
    learnerCapacity: '',
    assessmentCentre: false,
    isNewSDP: false,
    documents: {
      companyRegistration: null,
      accreditations: null,
      referenceLetters: [],
      appointmentForVerification: null,
      idForVerification: null,
      additionalDocuments: []
    },
    paymentPlan: '',
    termsAccepted: false
  });

  const getSectionClasses = (sectionId: string, baseClass = 'space-y-6') => {
    const highlightClasses = errorSections.includes(sectionId)
      ? 'border-2 border-red-400 rounded-xl p-4 bg-red-50/40'
      : '';
    return `${baseClass} ${highlightClasses}`.trim();
  };

  const hasFieldError = (fieldId: string) => fieldErrors.includes(fieldId);

  const getInputClasses = (fieldId: string, extraClasses = '') => {
    const base =
      'w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent';
    const errorStyles = hasFieldError(fieldId)
      ? 'border-red-500 focus:ring-red-500 focus:border-red-500 bg-red-50'
      : '';
    return `${base} ${errorStyles} ${extraClasses}`.trim();
  };

  const getDocumentClasses = (fieldId: string) =>
    hasFieldError(fieldId)
      ? 'border-2 border-red-400 rounded-lg p-4 bg-red-50/40'
      : '';

  const highlightSection = (sectionId: string, fields: string[] = []) => {
    setErrorSections([sectionId]);
    setFieldErrors(fields);
  };

  const clearFieldError = (fieldId: string) => {
    setFieldErrors(prev => prev.filter(id => id !== fieldId));
  };

  // Handle pre-selected plan from pricing page
  useEffect(() => {
    const state = location.state as { selectedPlan?: string };
    if (state?.selectedPlan) {
      const planId = state.selectedPlan;
      if (planId === 'sdp-free') {
        setFormData(prev => ({ ...prev, paymentPlan: 'free' }));
      } else if (planId === 'sdp-monthly') {
        setFormData(prev => ({ ...prev, paymentPlan: 'monthly' }));
      } else if (planId === 'sdp-annual') {
        setFormData(prev => ({ ...prev, paymentPlan: 'annual' }));
      }
    }
  }, [location]);

  useEffect(() => {
    setPaymentConfirmed(false);
    setPaymentReceipt(null);
    setPaymentProcessing(false);
  }, [formData.paymentPlan]);

  const mockPaymentConfirmation = (plan: PlanDefinition) => {
    const reference = `MOCK-${Date.now()}`;
    const expiresAt = computeExpiryDate(plan.durationDays);
    setPaymentReceipt({
      amount: plan.amount === 0 ? 'R0' : formatAmount(plan.amount),
      reference,
      expiresAt
    });
    setPaymentConfirmed(true);
    clearFieldError('payment');
    setPaymentProcessing(false);
  };

  const handlePaymentConfirmation = async () => {
    if (!formData.paymentPlan) {
      setError('Please select a membership plan before completing payment.');
      highlightSection('step7', ['payment']);
      return;
    }

    const planKey = formData.paymentPlan as SDPPlanKey;
    const plan = SDP_PLAN_DETAILS[planKey];
    if (!plan) {
      setError('Unable to locate the selected plan. Please choose again.');
      return;
    }

    setPaymentProcessing(true);

    if (!isFirebaseConfigured()) {
      console.warn('Firebase Functions not configured. Using mock payment confirmation.');
      mockPaymentConfirmation(plan);
      return;
    }

    try {
      const initiatePayfast = httpsCallable(functions, 'initiatePayfastPayment');
      const response = await initiatePayfast({
        amount: plan.amount,
        currency: 'ZAR',
        planId: plan.payfastPlanId,
        billingType: plan.billingType,
        role: 'sdp',
        customer: {
          name: formData.companyName || `${formData.contactFirstName} ${formData.contactLastName}`.trim(),
          email: formData.contactEmail || formData.email
        },
        returnUrl: typeof window !== 'undefined' ? `${window.location.origin}/payments/success` : undefined,
        cancelUrl: typeof window !== 'undefined' ? `${window.location.origin}/payments/cancelled` : undefined,
        metadata: {
          organization: formData.companyName,
          selectedPlan: plan.label
        }
      });

      const data = response.data as PayfastResponseData;
      if (data.paymentUrl && plan.amount > 0 && typeof window !== 'undefined') {
        window.open(data.paymentUrl, '_blank', 'noopener');
      }

      const expiresAt = plan.durationDays
        ? computeExpiryDate(plan.durationDays)
        : normalizeFirestoreTimestamp(data.expiresAt);

      const reference = data.paymentId || `PAY-${Date.now()}`;

      setPaymentReceipt({
        amount: plan.amount === 0 ? 'R0' : formatAmount(plan.amount),
        reference,
        expiresAt
      });
      setPaymentConfirmed(true);
      clearFieldError('payment');
    } catch (payfastError: any) {
      console.error('PayFast initialization error:', payfastError);
      setError('Unable to start PayFast checkout. Please try again once PayFast credentials are configured.');
    } finally {
      setPaymentProcessing(false);
    }
  };

  const organizationTypes = [
    'Private Training Provider',
    'Public Training Institution',
    'University',
    'University of Technology',
    'TVET College',
    'Corporate Training Division',
    'Professional Body',
    'Industry Association'
  ];

  const sectors = [
    'Agricultural Sector Education and Training Authority (AgriSETA)',
    'Banking Sector Education and Training Authority (BANKSETA)',
    'Chemical Industries Education and Training Authority (CHIETA)',
    'Construction Education and Training Authority (CETA)',
    'Culture, Arts, Tourism, Hospitality and Sport Sector Education and Training Authority (CATHSSETA)',
    'Education, Training and Development Practices Sector Education and Training Authority (ETDP SETA)',
    'Energy and Water Sector Education and Training Authority (EWSETA)',
    'Fibre Processing and Manufacturing Sector Education and Training Authority (FP&M SETA)',
    'Finance and Accounting Services Sector Education and Training Authority (FASSET)',
    'Food and Beverage Manufacturing Industry Sector Education and Training Authority (FoodBev SETA)',
    'Health and Welfare Sector Education and Training Authority (HWSETA)',
    'Insurance Sector Education and Training Authority (INSETA)',
    'Local Government Sector Education and Training Authority (LGSETA)',
    'Manufacturing, Engineering and Related Services Sector Education and Training Authority (merSETA)',
    'Media, Information and Communication Technologies Sector Education and Training Authority (MICT SETA)',
    'Mining Qualifications Authority (MQA)',
    'Public Service Sector Education and Training Authority (PSETA)',
    'Safety and Security Sector Education and Training Authority (SASSETA)',
    'Services Sector Education and Training Authority (SSETA)',
    'Transport Education Training Authority (TETA)',
    'Wholesale and Retail Sector Education and Training Authority (W&RSETA)'
  ];

  const setaList = [
    'Agricultural Sector Education and Training Authority (AgriSETA)',
    'Banking Sector Education and Training Authority (BANKSETA)',
    'Chemical Industries Education and Training Authority (CHIETA)',
    'Construction Education and Training Authority (CETA)',
    'Culture, Arts, Tourism, Hospitality and Sport Sector Education and Training Authority (CATHSSETA)',
    'Education, Training and Development Practices Sector Education and Training Authority (ETDP SETA)',
    'Energy and Water Sector Education and Training Authority (EWSETA)',
    'Fibre Processing and Manufacturing Sector Education and Training Authority (FP&M SETA)',
    'Finance and Accounting Services Sector Education and Training Authority (FASSET)',
    'Food and Beverage Manufacturing Industry Sector Education and Training Authority (FoodBev SETA)',
    'Health and Welfare Sector Education and Training Authority (HWSETA)',
    'Insurance Sector Education and Training Authority (INSETA)',
    'Local Government Sector Education and Training Authority (LGSETA)',
    'Manufacturing, Engineering and Related Services Sector Education and Training Authority (merSETA)',
    'Media, Information and Communication Technologies Sector Education and Training Authority (MICT SETA)',
    'Mining Qualifications Authority (MQA)',
    'Public Service Sector Education and Training Authority (PSETA)',
    'Safety and Security Sector Education and Training Authority (SASSETA)',
    'Services Sector Education and Training Authority (SSETA)',
    'Transport Education Training Authority (TETA)',
    'Wholesale and Retail Sector Education and Training Authority (W&RSETA)',
    'Other'
  ];

  const serviceTypes = [
    'Learnerships',
    'Skills Programmes',
    'Short Courses',
    'Assessment Services',
    'Recognition of Prior Learning (RPL)',
    'Apprenticeships',
    'Workplace-based Learning',
    'Consultation Services'
  ];

  const steps = [
    { number: 1, title: 'Company Information', completed: currentStep > 1 },
    { number: 2, title: 'Contact Details', completed: currentStep > 2 },
    { number: 3, title: 'Organization Profile', completed: currentStep > 3 },
    { number: 4, title: 'Accreditation & Needs', completed: currentStep > 4 },
    { number: 5, title: 'Services Offered', completed: currentStep > 5 },
    { number: 6, title: 'Document Upload', completed: currentStep > 6 },
    { number: 7, title: 'Review & Pay', completed: false }
  ];

  const nextStep = async () => {
    setError('');
    setErrorSections([]);
    setFieldErrors([]);

    if (currentStep === 1) {
      const missingFields: string[] = [];
      if (!formData.companyName.trim()) missingFields.push('companyName');
      if (!formData.registrationNumber.trim()) missingFields.push('registrationNumber');
      if (!formData.organizationType.trim()) missingFields.push('organizationType');
      if (!formData.email.trim()) missingFields.push('email');
      if (!formData.phone.trim()) missingFields.push('phone');

      if (missingFields.length > 0) {
        setError('Please complete all company information fields.');
        highlightSection('step1', missingFields);
        return;
      }
    }

    // Validation for Step 2 (Contact Person with password)
    if (currentStep === 2) {
      const missingFields: string[] = [];
      if (!formData.contactFirstName.trim()) missingFields.push('contactFirstName');
      if (!formData.contactLastName.trim()) missingFields.push('contactLastName');
      if (!formData.contactEmail.trim()) missingFields.push('contactEmail');
      if (!formData.contactPhone.trim()) missingFields.push('contactPhone');
      if (!formData.contactPosition.trim()) missingFields.push('contactPosition');
      if (!formData.password.trim()) missingFields.push('password');
      if (!formData.confirmPassword.trim()) missingFields.push('confirmPassword');

      if (missingFields.length > 0) {
        setError('Please complete all contact details.');
        highlightSection('step2', missingFields);
        return;
      }
      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters');
        highlightSection('step2', ['password']);
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        highlightSection('step2', ['password', 'confirmPassword']);
        return;
      }
    }

    if (currentStep === 3) {
      const missingFields: string[] = [];
      if (!formData.organizationType.trim()) missingFields.push('organizationType');
      if (!formData.establishedYear.trim()) missingFields.push('establishedYear');
      if (!formData.location.trim()) missingFields.push('location');
      if (!formData.sectors.length) missingFields.push('sectors');
      if (formData.sectors.includes('Other') && !formData.otherSector.trim()) missingFields.push('otherSector');

      if (missingFields.length > 0) {
        setError('Please complete your organization profile.');
        highlightSection('step3', missingFields);
        return;
      }
    }

    if (currentStep === 4) {
      const missingFields: string[] = [];
      if (!formData.goals.length) missingFields.push('goals');
      if (formData.goals.includes('Other') && !formData.otherGoal.trim()) missingFields.push('otherGoal');

      if (formData.isAccredited === 'yes') {
        const missingAccreditations = formData.sectors.filter(
          (sector) => !formData.sectorAccreditations[sector]?.trim()
        );
        if (missingAccreditations.length > 0) {
          missingFields.push('sectorAccreditations');
        }
      }

      if (missingFields.length > 0) {
        setError('Please provide your accreditation details.');
        highlightSection('step4', missingFields);
        return;
      }
    }

    if (currentStep === 5) {
      const missingFields: string[] = [];
      if (!formData.services.length) missingFields.push('services');
      if (!formData.learnerCapacity.trim()) missingFields.push('learnerCapacity');
      if (formData.services.includes('Other') && !formData.otherService.trim()) missingFields.push('otherService');

      if (!formData.goals.length) missingFields.push('goals');

      if (missingFields.length > 0) {
        setError('Please specify the services you offer.');
        highlightSection('step5', missingFields);
        return;
      }
    }

    if (currentStep === 6) {
      const missingFields: string[] = [];
      if (!formData.documents.companyRegistration) missingFields.push('companyRegistration');
      if (!formData.documents.idForVerification) missingFields.push('idForVerification');
      if (formData.isNewSDP) {
        if (!formData.documents.appointmentForVerification) {
          missingFields.push('appointmentForVerification');
        }
      } else {
        if (formData.documents.referenceLetters.length < 3) {
          missingFields.push('referenceLetters');
        }
      }

      if (missingFields.length > 0) {
        setError('Please upload all required documents.');
        highlightSection('documents', missingFields);
        return;
      }
    }

    // Validation for Step 7 (Terms and Payment)
    if (currentStep === 7) {
      if (!formData.termsAccepted) {
        setError('You must accept the Terms of Service to continue');
        highlightSection('step7');
        return;
      }
      if (!formData.paymentPlan) {
        setError('Please select a payment plan to continue');
        highlightSection('step7', ['payment']);
        return;
      }
      if (!paymentConfirmed) {
        setError('Please complete payment to activate your plan before logging in.');
        highlightSection('step7', ['payment']);
        return;
      }

      // Final step - Create user account
      setLoading(true);
      try {
        const primarySeta = formData.sectors[0] || '';
        const primaryAccreditationNumber = primarySeta
          ? formData.sectorAccreditations[primarySeta] || ''
          : '';
        const selectedPlan = formData.paymentPlan as SDPPlanKey;
        const planActivatedAt = new Date();
        let planExpiresAt: string | undefined;
        if (selectedPlan === 'free' || selectedPlan === 'monthly') {
          const expiry = new Date(planActivatedAt);
          expiry.setDate(expiry.getDate() + 30);
          planExpiresAt = expiry.toISOString();
        } else if (selectedPlan === 'annual') {
          const expiry = new Date(planActivatedAt);
          expiry.setFullYear(expiry.getFullYear() + 1);
          planExpiresAt = expiry.toISOString();
        }

        const result = await authService.signUp(
          formData.contactEmail,
          formData.password,
          {
            email: formData.contactEmail,
            role: 'SDP',
            verified: false,
            profile: {
              id: '', // Will be set by Firebase
              name: formData.companyName,
              email: formData.contactEmail,
              type: formData.organizationType,
              specializations: formData.services,
              sectors: formData.sectors,
              location: formData.location,
              experience: `Established ${formData.establishedYear}`,
              establishedYear: formData.establishedYear,
              learners: formData.learnerCapacity || 'N/A',
              qualifications: formData.qualifications,
              rates: {},
              availability: 'Available',
              rating: 0.0,
              reviews: 0,
              verified: false,
              profileImage: '/images/profile-3.jpg',
              aboutMe: `${formData.companyName} - ${formData.organizationType}`,
              assessmentCentre: formData.assessmentCentre,
              aboutUs: formData.goals.length ? formData.goals.join(', ') : '',
              // Accreditation information
              setaAccreditation: primarySeta,
              accreditationNumber: primaryAccreditationNumber,
              sectorAccreditations: formData.sectorAccreditations,
              isAccredited: formData.isAccredited,
              accreditation: formData.isAccredited === 'yes' ? primarySeta : 'Not Accredited',
              planType: selectedPlan,
              planStatus: selectedPlan === 'free' ? 'trial_active' : 'active',
              planActivatedAt: planActivatedAt.toISOString(),
              planExpiresAt,
              planReference: paymentReceipt?.reference
            } as SDP
          }
        );

        if (result.user) {
          alert('Registration successful! Welcome to Scholarz.');
          navigate('/sdp-dashboard');
        } else {
          setError(result.error || 'Registration failed. Please try again.');
        }
      } catch (err: any) {
        console.error('Registration error:', err);
        setError(err.message || 'An error occurred during registration');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (currentStep < 7) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setError('');
      setErrorSections([]);
      setFieldErrors([]);
      setCurrentStep(currentStep - 1);
    }
  };

  const handleArrayFieldChange = (field: 'sectors' | 'qualifications' | 'services', value: string) => {
    setFormData(prev => {
      const updated = prev[field].includes(value)
        ? prev[field].filter(item => item !== value)
        : [...prev[field], value];

      if (field === 'sectors') {
        const updatedAccreditations = { ...prev.sectorAccreditations };
        if (prev[field].includes(value)) {
          delete updatedAccreditations[value];
        } else {
          updatedAccreditations[value] = '';
        }
        return { ...prev, [field]: updated, sectorAccreditations: updatedAccreditations };
      }

      return { ...prev, [field]: updated };
    });
  };

  const handleGoalsChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      goals: prev.goals.includes(value)
        ? prev.goals.filter(g => g !== value)
        : [...prev.goals, value]
    }));
  };

  const updateSectorAccreditation = (sector: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      sectorAccreditations: {
        ...prev.sectorAccreditations,
        [sector]: value
      }
    }));
  };

  const StepIndicator = () => (
    <div className="mb-8">
      <div className="flex items-center justify-between overflow-x-auto">
        {steps.map((step, index) => (
          <div key={step.number} className="flex items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 ${
              step.completed
                ? 'bg-green-500 text-white'
                : currentStep === step.number
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-600'
            }`}>
              {step.completed ? <CheckCircle className="w-5 h-5" /> : step.number}
            </div>
            {index < steps.length - 1 && (
              <div className={`w-8 lg:w-16 h-0.5 ${
                step.completed ? 'bg-green-500' : 'bg-gray-200'
              }`} />
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 text-center">
        <h2 className="text-xl font-semibold text-gray-900">
          {steps[currentStep - 1].title}
        </h2>
      </div>
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className={getSectionClasses('step1')}>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="text-sm font-medium text-blue-900 mb-2">Are you a new SDP?</h3>
              <p className="text-xs text-blue-700 mb-3">
                New SDPs may have different documentation requirements. Please indicate if you are a newly established Skills Development Provider.
              </p>
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="isNewSDP"
                    checked={formData.isNewSDP === true}
                    onChange={() => setFormData({ ...formData, isNewSDP: true })}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Yes, I'm a new SDP</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="isNewSDP"
                    checked={formData.isNewSDP === false}
                    onChange={() => setFormData({ ...formData, isNewSDP: false })}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">No, I'm an established SDP</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company/Organization Name *
              </label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => {
                  clearFieldError('companyName');
                  setFormData({ ...formData, companyName: e.target.value });
                }}
                className={getInputClasses('companyName')}
                placeholder="Enter your organization name"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Registration Number *
                </label>
                <input
                  type="text"
                  value={formData.registrationNumber}
                  onChange={(e) => {
                    clearFieldError('registrationNumber');
                    setFormData({ ...formData, registrationNumber: e.target.value });
                  }}
                  className={getInputClasses('registrationNumber')}
                  placeholder="Company registration number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Organization Type *
                </label>
                <select
                  value={formData.organizationType}
                  onChange={(e) => {
                    clearFieldError('organizationType');
                    setFormData({ ...formData, organizationType: e.target.value });
                  }}
                  className={getInputClasses('organizationType')}
                >
                  <option value="">Select organization type</option>
                  {organizationTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Primary Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => {
                    clearFieldError('email');
                    setFormData({ ...formData, email: e.target.value });
                  }}
                  className={getInputClasses('email')}
                  placeholder="company@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => {
                    clearFieldError('phone');
                    setFormData({ ...formData, phone: e.target.value });
                  }}
                  className={getInputClasses('phone')}
                  placeholder="+27 11 123 4567"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Website
              </label>
              <input
                type="url"
                value={formData.website}
                onChange={(e) => {
                  setFormData({ ...formData, website: e.target.value });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="https://www.yourcompany.co.za"
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className={getSectionClasses('step2')}>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-medium text-blue-900 mb-2">Primary Contact Person</h3>
              <p className="text-blue-700 text-sm">
                This person will be the main point of contact for Scholarz communications.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  First Name *
                </label>
                <input
                  type="text"
                  value={formData.contactFirstName}
                  onChange={(e) => {
                    clearFieldError('contactFirstName');
                    setFormData({ ...formData, contactFirstName: e.target.value });
                  }}
                  className={getInputClasses('contactFirstName')}
                  placeholder="Contact person's first name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name *
                </label>
                <input
                  type="text"
                  value={formData.contactLastName}
                  onChange={(e) => {
                    clearFieldError('contactLastName');
                    setFormData({ ...formData, contactLastName: e.target.value });
                  }}
                  className={getInputClasses('contactLastName')}
                  placeholder="Contact person's last name"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Position/Title *
              </label>
              <input
                type="text"
                value={formData.contactPosition}
                  onChange={(e) => {
                    clearFieldError('contactPosition');
                    setFormData({ ...formData, contactPosition: e.target.value });
                  }}
                  className={getInputClasses('contactPosition')}
                placeholder="e.g. Training Manager, CEO, Skills Development Coordinator"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Email *
                </label>
                <input
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => {
                    clearFieldError('contactEmail');
                    setFormData({ ...formData, contactEmail: e.target.value });
                  }}
                  className={getInputClasses('contactEmail')}
                  placeholder="contact.person@company.com"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This email, together with the password below, will become your SDP dashboard login.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Phone *
                </label>
                <input
                  type="tel"
                  value={formData.contactPhone}
                  onChange={(e) => {
                    clearFieldError('contactPhone');
                    setFormData({ ...formData, contactPhone: e.target.value });
                  }}
                  className={getInputClasses('contactPhone')}
                  placeholder="+27 11 123 4567"
                />
              </div>
            </div>

            {/* Password Fields */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <h4 className="text-sm font-medium text-yellow-900 mb-2">Create Account Password</h4>
              <p className="text-xs text-yellow-700">
                This password will be used along with the contact email above to log in to your SDP dashboard.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password *
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => {
                    clearFieldError('password');
                    setFormData({ ...formData, password: e.target.value });
                  }}
                  className={getInputClasses('password')}
                  placeholder="Minimum 6 characters"
                  minLength={6}
                />
                <p className="text-xs text-gray-500 mt-1">Must be at least 6 characters</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password *
                </label>
                <input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => {
                    clearFieldError('confirmPassword');
                    setFormData({ ...formData, confirmPassword: e.target.value });
                  }}
                  className={getInputClasses('confirmPassword')}
                  placeholder="Re-enter password"
                />
                {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                  <p className="text-xs text-red-600 mt-1">Passwords do not match</p>
                )}
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className={getSectionClasses('step3')}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Year Established *
                </label>
                <input
                  type="number"
                  min="1900"
                  max="2025"
                  value={formData.establishedYear}
                  onChange={(e) => setFormData({ ...formData, establishedYear: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="YYYY"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Primary Location *
                </label>
                <select
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select primary location</option>
                  <option value="Johannesburg, Gauteng">Johannesburg, Gauteng</option>
                  <option value="Cape Town, Western Cape">Cape Town, Western Cape</option>
                  <option value="Durban, KwaZulu-Natal">Durban, KwaZulu-Natal</option>
                  <option value="Pretoria, Gauteng">Pretoria, Gauteng</option>
                  <option value="Port Elizabeth, Eastern Cape">Port Elizabeth, Eastern Cape</option>
                  <option value="Bloemfontein, Free State">Bloemfontein, Free State</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Sectors * (Select all sectors you operate in)
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {sectors.map(sector => (
                  <label key={sector} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.sectors.includes(sector)}
                      onChange={() => handleArrayFieldChange('sectors', sector)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{sector}</span>
                  </label>
                ))}
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.sectors.includes('Other')}
                    onChange={() => handleArrayFieldChange('sectors', 'Other')}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Other</span>
                </label>
              </div>
              {formData.sectors.includes('Other') && (
                <div className="mt-3">
                  <input
                    type="text"
                    value={formData.otherSector}
                      onChange={(e) => {
                        clearFieldError('otherSector');
                        setFormData({ ...formData, otherSector: e.target.value });
                      }}
                    placeholder="Please specify your other sector"
                      className={getInputClasses('otherSector')}
                  />
                </div>
              )}
            </div>
          </div>
        );

      case 4:
        return (
          <div className={getSectionClasses('step4')}>
            {/* Accreditation status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Are you currently accredited?</label>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-2">
                    <input type="radio" name="isAccredited" checked={formData.isAccredited === 'yes'} onChange={() => setFormData({ ...formData, isAccredited: 'yes' })} />
                    <span className="text-sm text-gray-700">Yes</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input type="radio" name="isAccredited" checked={formData.isAccredited === 'no'} onChange={() => setFormData({ ...formData, isAccredited: 'no' })} />
                    <span className="text-sm text-gray-700">No</span>
                  </label>
                </div>
              </div>
            </div>

            {formData.isAccredited === 'yes' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-700">
                  Please provide the accreditation number for each sector you operate in.
                </p>
                {formData.sectors.length === 0 ? (
                  <p className="text-sm text-red-600">
                    No sectors selected. Please select your sectors in the previous step.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {formData.sectors.map((sector) => (
                      <div
                        key={sector}
                        className="flex flex-col md:flex-row md:items-center md:space-x-4 border border-gray-200 rounded-lg p-3"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-800">{sector}</p>
                </div>
                        <div className="mt-2 md:mt-0 md:w-1/2">
                          <label className="sr-only">Accreditation Number for {sector}</label>
                  <input
                    type="text"
                            value={formData.sectorAccreditations[sector] || ''}
                            onChange={(e) => {
                              clearFieldError('sectorAccreditations');
                              updateSectorAccreditation(sector, e.target.value);
                            }}
                            className={getInputClasses('sectorAccreditations')}
                            placeholder="Enter accreditation number"
                  />
                </div>
              </div>
                  ))}
                </div>
                )}
              </div>
            )}

            {/* Intent / Goals */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="text-green-900 font-semibold mb-2">What do you need help with on Scholarz?</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {['Accreditation support', 'Learning material', 'Facilitators', 'Assessors', 'Moderators', 'We want to sell our services'].map((g) => (
                  <label key={g} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.goals.includes(g)}
                      onChange={() => handleGoalsChange(g)}
                      className="rounded border-gray-300 text-green-600 focus:ring-green-600"
                    />
                    <span className="text-sm text-gray-800">{g}</span>
                  </label>
                ))}
              </div>
              <div className="mt-3">
                <label className="block text-sm text-gray-700 mb-1">Other (optional)</label>
                <input
                  type="text"
                  value={formData.otherGoal}
                  onChange={(e) => {
                    clearFieldError('otherGoal');
                    setFormData({ ...formData, otherGoal: e.target.value });
                  }}
                  className={getInputClasses('otherGoal')}
                  placeholder="Tell us more about what you need"
                />
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className={getSectionClasses('step5')}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Services Offered *</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {serviceTypes.map((service) => (
                  <label key={service} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.services.includes(service)}
                      onChange={() => handleArrayFieldChange('services', service)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{service}</span>
                  </label>
                ))}
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.services.includes('Other')}
                    onChange={() => handleArrayFieldChange('services', 'Other')}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Other</span>
                </label>
              </div>
              {formData.services.includes('Other') && (
                <div className="mt-3">
                  <input
                    type="text"
                    value={formData.otherService}
                    onChange={(e) => setFormData({ ...formData, otherService: e.target.value })}
                    placeholder="Please specify your other service"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Learner Capacity (per year)</label>
                <input
                  type="number"
                  value={formData.learnerCapacity}
                  onChange={(e) => setFormData({ ...formData, learnerCapacity: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g. 250"
                />
              </div>
              <div className="flex items-center space-x-3 pt-7">
                <input
                  id="assessmentCentre"
                  type="checkbox"
                  checked={formData.assessmentCentre}
                  onChange={(e) => setFormData({ ...formData, assessmentCentre: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="assessmentCentre" className="text-sm text-gray-700">Assessment Centre</label>
              </div>
            </div>
          </div>
        );

      case 6:
        const handleReferenceLetterUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
          const files = Array.from(e.target.files || []);
          setFormData({
            ...formData,
            documents: {
              ...formData.documents,
              referenceLetters: [...formData.documents.referenceLetters, ...files]
            }
          });
        };

        const removeReferenceLetter = (index: number) => {
          setFormData({
            ...formData,
            documents: {
              ...formData.documents,
              referenceLetters: formData.documents.referenceLetters.filter((_, i) => i !== index)
            }
          });
        };

        return (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="text-sm font-medium text-blue-900 mb-2">Required Documents for SDP Registration</h3>
              <p className="text-xs text-blue-700 mb-2">
                Please upload all required documents to verify your organization and complete your registration.
              </p>
              <div className="text-xs text-blue-700 space-y-1 mt-3">
                <p className="font-medium">Required Documents ({formData.isNewSDP ? 'New SDP' : 'Established SDP'}):</p>
                <ul className="list-disc list-inside ml-2 space-y-1">
                  <li>Company Registration Certificate (CIPC) - <strong>Required</strong></li>
                  <li>ID for Verification (Primary contact person) - <strong>Required</strong></li>
                  {formData.isNewSDP ? (
                    <li>Appointment letter for verification - <strong>Required for new SDPs</strong></li>
                  ) : (
                    <li>3 Training Project Reference Letters - <strong>Required for established SDPs</strong></li>
                  )}
                  <li>SETA Accreditations - <span className="text-gray-600">Optional (if you have accreditation)</span></li>
                  <li>Additional Related Documents - <span className="text-gray-600">Optional (any other supporting documents)</span></li>
                </ul>
              </div>
            </div>

            <div className="space-y-6">
              {/* Company Registration (CIPC) */}
              <div className={getDocumentClasses('companyRegistration')}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company Registration Certificate / CIPC (PDF) *
                </label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setFormData({ ...formData, documents: { ...formData.documents, companyRegistration: e.target.files?.[0] || null } })}
                  className="w-full text-sm"
                />
                {formData.documents.companyRegistration && (
                  <p className="text-xs text-green-600 mt-1 flex items-center">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    {formData.documents.companyRegistration.name}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Your CIPC registration certificate (Companies and Intellectual Property Commission)
                </p>
              </div>

              {/* Accreditations */}
              <div className={getDocumentClasses('accreditations')}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  SETA Accreditations (PDF)
                  <span className="text-xs text-gray-500 ml-2">(Optional - if you have accreditation)</span>
                </label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setFormData({ ...formData, documents: { ...formData.documents, accreditations: e.target.files?.[0] || null } })}
                  className="w-full text-sm"
                />
                {formData.documents.accreditations && (
                  <p className="text-xs text-green-600 mt-1 flex items-center">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    {formData.documents.accreditations.name}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Upload your SETA accreditation certificates if you have them. New SDPs without accreditation can skip this.
                </p>
              </div>

              {/* Conditional: Reference Letters OR Appointment for Verification */}
              {formData.isNewSDP ? (
                <div className={getDocumentClasses('appointmentForVerification')}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Appointment Letter for Verification (PDF) *
                    <span className="text-xs text-gray-500 ml-2">(Required for new SDPs)</span>
                  </label>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setFormData({ ...formData, documents: { ...formData.documents, appointmentForVerification: e.target.files?.[0] || null } })}
                    className="w-full text-sm"
                  />
                  {formData.documents.appointmentForVerification && (
                    <p className="text-xs text-green-600 mt-1 flex items-center">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      {formData.documents.appointmentForVerification.name}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">Upload your appointment letter for verification as a new SDP</p>
                </div>
              ) : (
                <div className={getDocumentClasses('referenceLetters')}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    3 Training Project Reference Letters (PDF) *
                    <span className="text-xs text-gray-500 ml-2">(Required for established SDPs)</span>
                  </label>
                  <input
                    type="file"
                    accept="application/pdf"
                    multiple
                    onChange={handleReferenceLetterUpload}
                    className="w-full text-sm"
                  />
                  {formData.documents.referenceLetters.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {formData.documents.referenceLetters.map((file, index) => (
                        <div key={index} className="flex items-center justify-between bg-green-50 px-2 py-1 rounded text-xs">
                          <span className="text-green-700 flex itemser">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            {file.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeReferenceLetter(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Upload 3 reference letters from previous training projects ({formData.documents.referenceLetters.length}/3 uploaded)
                  </p>
                </div>
              )}

              {/* ID for Verification */}
              <div className={getDocumentClasses('idForVerification')}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ID for Verification (PDF or Image) *
                </label>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={(e) => setFormData({ ...formData, documents: { ...formData.documents, idForVerification: e.target.files?.[0] || null } })}
                  className="w-full text-sm"
                />
                {formData.documents.idForVerification && (
                  <p className="text-xs text-green-600 mt-1 flex items-center">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    {formData.documents.idForVerification.name}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">ID document of the primary contact person</p>
              </div>

              {/* Additional Related Documents */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Related Documents (PDF)
                  <span className="text-xs text-gray-500 ml-2">(Optional - any other supporting documents)</span>
                </label>
                <input
                  type="file"
                  accept="application/pdf"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setFormData({
                      ...formData,
                      documents: {
                        ...formData.documents,
                        additionalDocuments: [...formData.documents.additionalDocuments, ...files]
                      }
                    });
                  }}
                  className="w-full text-sm"
                />
                {formData.documents.additionalDocuments.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {formData.documents.additionalDocuments.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-green-50 px-2 py-1 rounded text-xs">
                        <span className="text-green-700 flex items-center">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          {file.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              documents: {
                                ...formData.documents,
                                additionalDocuments: formData.documents.additionalDocuments.filter((_, i) => i !== index)
                              }
                            });
                          }}
                          className="text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Upload any additional documents that may help verify your organization (e.g., business licenses, tax certificates, partnership agreements, etc.)
                </p>
              </div>
            </div>
          </div>
        );

      case 7:
        return (
          <div className={getSectionClasses('step7')}>
            {/* Terms of Service Acceptance */}
            <div className="bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Terms of Service & Payment</h3>
              <p className="text-gray-600">Please read and accept our terms before selecting your plan</p>
            </div>

            {/* Terms Acceptance Checkbox */}
            <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Terms of Service Agreement</h4>
              <p className="text-gray-700 mb-4">
                Before proceeding with your registration, please read and accept our{' '}
                <button
                  type="button"
                  onClick={() => setShowTermsModal(true)}
                  className="text-blue-600 hover:text-blue-800 underline font-medium"
                >
                  Terms of Service
                </button>
                .
              </p>
              
              <label className="flex items-start space-x-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={formData.termsAccepted}
                  onChange={(e) => setFormData({ ...formData, termsAccepted: e.target.checked })}
                  className="mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 group-hover:text-gray-900">
                  I have read and agree to the Scholarz{' '}
                  <button
                    type="button"
                    onClick={() => setShowTermsModal(true)}
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    Terms of Service
                  </button>
                  , including the escrow payment system and platform dispute resolution process.
                </span>
                </label>

              {!formData.termsAccepted && (
                <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-800">
                    <AlertCircle className="w-4 h-4 inline mr-1" />
                    You must accept the Terms of Service to continue with registration.
                  </p>
              </div>
              )}
            </div>

            {/* Payment Plan Selection - Only show if terms accepted */}
            {formData.termsAccepted && (
              <>
                <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-green-900 mb-2">
                    <CheckCircle className="w-5 h-5 inline mr-2" />
                    Terms Accepted - Now Choose Your Plan
                  </h4>
                  <p className="text-sm text-green-800">Select a membership plan to complete your registration</p>
                </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Free Plan */}
              <div 
                onClick={() => setFormData({ ...formData, paymentPlan: 'free' })}
                className={`relative border-2 rounded-xl p-6 cursor-pointer transition-all ${
                  formData.paymentPlan === 'free' 
                    ? 'border-blue-600 bg-blue-50 shadow-lg' 
                    : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
                }`}
              >
                {formData.paymentPlan === 'free' && (
                  <div className="absolute top-4 right-4">
                    <CheckCircle className="w-6 h-6 text-blue-600" />
                  </div>
                )}
                <div className="text-center mb-4">
                  <h4 className="text-xl font-bold text-gray-900 mb-2">Free Trial</h4>
                  <div className="text-3xl font-bold text-gray-900">R0</div>
                  <div className="text-sm text-gray-600">30 days free</div>
                </div>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Search up to 10 SMEs</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Up to 2 engagements</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Standard support</span>
                  </li>
                  <li className="flex items-start">
                    <AlertCircle className="w-4 h-4 text-gray-400 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-500">No AI Advisor</span>
                  </li>
                </ul>
                <div className="mt-6">
                  <Badge variant="info" className="w-full justify-center">Perfect for trying out</Badge>
              </div>
            </div>

              {/* Monthly Plan */}
              <div 
                onClick={() => setFormData({ ...formData, paymentPlan: 'monthly' })}
                className={`relative border-2 rounded-xl p-6 cursor-pointer transition-all ${
                  formData.paymentPlan === 'monthly' 
                    ? 'border-green-600 bg-green-50 shadow-lg' 
                    : 'border-gray-200 hover:border-green-300 hover:shadow-md'
                }`}
              >
                {formData.paymentPlan === 'monthly' && (
                  <div className="absolute top-4 right-4">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                )}
                <div className="text-center mb-4">
                  <h4 className="text-xl font-bold text-gray-900 mb-2">Monthly</h4>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-sm text-gray-400 line-through">R299</span>
                    <div className="text-3xl font-bold text-gray-900">R149</div>
                  </div>
                  <div className="text-sm text-gray-600">per month</div>
                  <div className="text-xs text-green-600 font-medium mt-1">First 3 months</div>
                </div>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Unlimited SME searches</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Unlimited engagements</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Priority support</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="font-semibold text-purple-700">AI Advisor included</span>
                  </li>
                </ul>
                <div className="mt-6">
                  <Badge className="w-full justify-center bg-green-100 text-green-800">Great value</Badge>
              </div>
            </div>

              {/* Annual Plan */}
              <div 
                onClick={() => setFormData({ ...formData, paymentPlan: 'annual' })}
                className={`relative border-2 rounded-xl p-6 cursor-pointer transition-all ${
                  formData.paymentPlan === 'annual' 
                    ? 'border-purple-600 bg-purple-50 shadow-lg' 
                    : 'border-gray-200 hover:border-purple-300 hover:shadow-md'
                }`}
              >
                <div className="absolute top-2 right-2">
                  <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs">Most Popular</Badge>
              </div>
                {formData.paymentPlan === 'annual' && (
                  <div className="absolute top-4 right-4">
                    <CheckCircle className="w-6 h-6 text-purple-600" />
            </div>
                )}
                <div className="text-center mb-4 mt-2">
                  <h4 className="text-xl font-bold text-gray-900 mb-2">Annual</h4>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-sm text-gray-400 line-through">R2,899</span>
                    <div className="text-3xl font-bold text-gray-900">R2,499</div>
                  </div>
                  <div className="text-sm text-gray-600">per year</div>
                  <div className="text-xs text-green-600 font-medium mt-1">Save R400</div>
                </div>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Unlimited SME searches</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Unlimited engagements</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Priority support</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="font-semibold text-purple-700">AI Advisor included</span>
                  </li>
                </ul>
                <div className="mt-6">
                  <Badge className="w-full justify-center bg-purple-100 text-purple-800">Best value</Badge>
                </div>
              </div>
            </div>

            {formData.paymentPlan && (
              <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-300 rounded-xl p-6 text-center">
                <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
                <h4 className="text-lg font-bold text-gray-900 mb-2">
                  {formData.paymentPlan === 'free' ? 'Free Trial' : formData.paymentPlan === 'monthly' ? 'Monthly Plan' : 'Annual Plan'} Selected
                </h4>
                <p className="text-gray-700">Complete payment below to finish your registration.</p>
              </div>
            )}

            {formData.paymentPlan && (
              <div
                className={`bg-white border-2 rounded-xl p-6 space-y-4 ${
                  hasFieldError('payment') ? 'border-red-400 bg-red-50/40' : 'border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">
                      {formData.paymentPlan === 'free'
                        ? 'Free Trial (30 days)'
                        : formData.paymentPlan === 'monthly'
                        ? 'Monthly Subscription'
                        : 'Annual Subscription'}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {formData.paymentPlan === 'free'
                        ? 'Requires confirmation even though no payment is due.'
                        : 'Secure your plan to unlock full platform access.'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900">
                      {formData.paymentPlan === 'free'
                        ? 'R0'
                        : formData.paymentPlan === 'monthly'
                        ? 'R149'
                        : 'R2,499'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formData.paymentPlan === 'free'
                        ? '30-day trial'
                        : formData.paymentPlan === 'monthly'
                        ? 'First 3 months special'
                        : 'Per year'}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-gray-500">
                  Payments are processed securely via PayFast. Free trials generate a R0 invoice so that we can track the 30-day timer before your access expires.
                </p>

                {paymentReceipt && paymentConfirmed ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm text-green-800 font-medium">
                      <CheckCircle className="w-4 h-4 inline mr-1" />
                      Payment confirmed – reference {paymentReceipt.reference}
                    </p>
                    <p className="text-xs text-green-700 mt-1">
                      Amount: {paymentReceipt.amount}
                      {paymentReceipt.expiresAt &&
                        ` • Trial expires on ${new Date(paymentReceipt.expiresAt).toLocaleDateString()}`}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <Button
                      onClick={handlePaymentConfirmation}
                      disabled={paymentProcessing}
                      className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
                    >
                      {paymentProcessing
                        ? 'Processing...'
                        : formData.paymentPlan === 'free'
                        ? 'Start 30-Day Free Trial'
                        : 'Pay & Activate Plan'}
                    </Button>
                    <p className="text-xs text-gray-600">
                      Clicking this button records your payment and activates your plan.
                    </p>
                  </div>
                )}
              </div>
            )}
              </>
            )}
          </div>
        );

      default:
        return (
          <div className="text-center py-12">
            <AlertCircle className="w-16 h-16 text-blue-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Unknown step</h3>
            <p className="text-gray-600">Please navigate using the buttons below.</p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center space-x-4">
            <Link to="/register" className="text-gray-600 hover:text-blue-600">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">SDP Registration</h1>
              <p className="text-gray-600">Register as a Skills Development Provider</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <StepIndicator />
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          {renderStepContent()}
          
          <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 1}
            >
              Previous
            </Button>
            
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start space-x-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
            
            <Button
              onClick={nextStep}
              disabled={
                loading ||
                (currentStep === 7 && (!formData.termsAccepted || !formData.paymentPlan || !paymentConfirmed))
              }
            >
              {loading ? 'Processing...' : currentStep === 7 ? 'Complete Registration & Login' : 'Next Step'}
            </Button>
          </div>
        </div>
      </div>

      {/* Terms of Service Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-green-600 p-6 text-white">
              <h2 className="text-2xl font-bold">SDP Terms of Service</h2>
              <p className="text-sm text-blue-50 mt-1">Scholarz Platform Agreement for Skills Development Providers</p>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="overflow-y-auto flex-1 p-6">
              <div className="prose max-w-none text-sm">
                <section className="mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">1. Acceptance of Terms</h3>
                  <p className="text-gray-700 leading-relaxed">
                    By registering as a Skills Development Provider (SDP) on Scholarz, you agree to these Terms of Service. 
                    These terms govern your use of the platform and your relationship with Subject Matter Experts (SMEs) and other users.
                  </p>
                </section>

                <section className="mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">2. SDP Registration and Verification</h3>
                  <p className="text-gray-700 leading-relaxed mb-3">
                    As an SDP, you must provide accurate information and documentation for verification, including:
                  </p>
                  <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                    <li>Company registration certificate (CIPC)</li>
                    <li>SETA accreditation certificates</li>
                    <li>Appointment letter (for new SDPs) or Reference letters (for established SDPs)</li>
                    <li>Primary contact person identification</li>
                  </ul>
                  <p className="text-gray-700 leading-relaxed mt-3">
                    The verification process typically takes 2-3 business days. You will be notified via email once your registration is approved or if additional information is required.
                  </p>
                </section>

                <section className="mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">3. Company Profile and Information Accuracy</h3>
                  <p className="text-gray-700 leading-relaxed mb-3">
                    You agree to:
                  </p>
                  <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                    <li>Provide accurate, current, and complete company information during registration</li>
                    <li>Maintain and update your company profile to keep it accurate</li>
                    <li>Not misrepresent your accreditations, services, or capabilities</li>
                    <li>Upload genuine and unaltered documents</li>
                    <li>Ensure all contact information is current and monitored</li>
                  </ul>
                </section>

                <section className="mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">4. Professional Conduct</h3>
                  <p className="text-gray-700 leading-relaxed mb-3">
                    As an SDP on our platform, you agree to:
                  </p>
                  <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                    <li>Maintain professional standards in all engagements with SMEs</li>
                    <li>Honor commitments and agreements made with SMEs</li>
                    <li>Provide fair and honest ratings and reviews of SMEs</li>
                    <li>Respect confidentiality and intellectual property</li>
                    <li>Comply with all relevant SETA and industry regulations</li>
                  </ul>
                </section>

                <section className="mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">5. Subscription and Fees</h3>
                  <p className="text-gray-700 leading-relaxed mb-3">
                    Scholarz operates on a subscription model with the following terms:
                  </p>
                  <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                    <li>Free Trial: 30 days with limited features (no AI Advisor)</li>
                    <li>Monthly Subscription: R149/month (intro) then R299/month, billed monthly</li>
                    <li>Annual Subscription: R2,499/year (save R400), billed annually</li>
                    <li>Platform fee: 10% commission on completed engagements</li>
                    <li>All subscription fees are non-refundable except as required by law</li>
                  </ul>
                </section>

                <section className="mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">6. Escrow Payment System</h3>
                  <p className="text-gray-700 leading-relaxed mb-3">
                    Scholarz operates a secure <strong>escrow payment system</strong> to protect both SDPs and SMEs.
                  </p>
                  
                  <h4 className="text-md font-semibold text-gray-900 mt-4 mb-2">How It Works for SDPs:</h4>
                  <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                    <li>When engaging an SME, you deposit payment into the Scholarz escrow account</li>
                    <li>Funds are held securely until the engagement is completed</li>
                    <li>The SME delivers services, materials, or training as agreed</li>
                    <li>You review the work and confirm satisfaction</li>
                    <li>Upon your approval, payment is released to the SME</li>
                    <li>If issues arise, you can initiate our dispute resolution process</li>
                  </ul>

                  <h4 className="text-md font-semibold text-gray-900 mt-4 mb-2">Your Protection:</h4>
                  <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                    <li><strong>No Payment Until Satisfied:</strong> Funds are only released when you approve the work</li>
                    <li><strong>Your Protection:</strong> Review period to verify work meets requirements</li>
                    <li><strong>Dispute Resolution:</strong> Fair mediation if quality issues arise</li>
                    <li><strong>Refund Protection:</strong> Eligible for refunds if SME fails to deliver</li>
                  </ul>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                    <p className="text-sm text-blue-900">
                      <strong>Important:</strong> All payments to SMEs must be processed through the platform escrow system. 
                      Payments made outside the platform are not protected and violate our Terms of Service.
                    </p>
                  </div>
                </section>

                <section className="mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">7. Dispute Resolution Process</h3>
                  <p className="text-gray-700 leading-relaxed mb-3">
                    If you are not satisfied with an SME's work:
                  </p>
                  <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                    <li><strong>Step 1:</strong> Submit a dispute through the platform dispute system</li>
                    <li><strong>Step 2:</strong> Provide evidence and documentation of the issues</li>
                    <li><strong>Step 3:</strong> Scholarz mediation team reviews the case within 2-3 business days</li>
                    <li><strong>Step 4:</strong> Both parties work toward a fair resolution</li>
                    <li><strong>Step 5:</strong> Outcome is implemented (revision, partial payment, or refund)</li>
                  </ul>
                  <p className="text-gray-700 leading-relaxed mt-3">
                    <strong>All disputes must be resolved through the platform.</strong> This ensures faster, more cost-effective, 
                    and fairer outcomes compared to traditional legal processes.
                  </p>
                </section>

                <section className="mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">8. SME Ratings and Reviews</h3>
                  <p className="text-gray-700 leading-relaxed mb-3">
                    You may rate and review SMEs after completed engagements. You agree to:
                  </p>
                  <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                    <li>Provide honest and fair ratings based on actual performance</li>
                    <li>Not post false, misleading, or defamatory reviews</li>
                    <li>Base reviews on professional criteria (quality, timeliness, communication)</li>
                    <li>Not use reviews for harassment or retaliation</li>
                  </ul>
                </section>

                <section className="mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">9. Account Suspension and Termination</h3>
                  <p className="text-gray-700 leading-relaxed mb-3">
                    Scholarz reserves the right to suspend or terminate your account if:
                  </p>
                  <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                    <li>You violate these Terms of Service</li>
                    <li>You provide false or misleading company information</li>
                    <li>You engage in fraudulent activities or payment disputes</li>
                    <li>Your accreditations cannot be verified or expire</li>
                    <li>You repeatedly fail to honor engagements with SMEs</li>
                  </ul>
                </section>

                <section className="mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">10. Privacy and Data Protection</h3>
                  <p className="text-gray-700 leading-relaxed mb-3">
                    Your company and personal information will be handled in accordance with South African data protection laws (POPIA). 
                    We will not share your information with third parties without your consent, except as required by law or for platform operations.
                  </p>
                </section>

                <section className="mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">11. Governing Law</h3>
                  <p className="text-gray-700 leading-relaxed mb-3">
                    These Terms of Service are governed by the laws of South Africa. All disputes must be resolved through the 
                    Scholarz platform dispute resolution process as described in Section 7.
                  </p>
                  
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
                    <p className="text-sm text-green-900">
                      <strong>Platform-First Resolution:</strong> By using Scholarz, you agree that all disputes will be 
                      resolved through our internal mediation process. This ensures faster, more affordable, and fairer outcomes 
                      for both SDPs and SMEs.
                    </p>
                  </div>
                </section>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                  <p className="text-sm text-blue-900">
                    <strong>Last Updated:</strong> January 2025
                  </p>
                  <p className="text-sm text-blue-900 mt-2">
                    By clicking "I Accept" or completing your registration, you acknowledge that you have read, understood, 
                    and agree to be bound by these Terms of Service for Skills Development Providers.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 p-6 flex justify-end space-x-4 border-t border-gray-200">
              <Button
                variant="outline"
                onClick={() => setShowTermsModal(false)}
              >
                Close
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setFormData({ ...formData, termsAccepted: true });
                  setShowTermsModal(false);
                }}
              >
                I Accept
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}