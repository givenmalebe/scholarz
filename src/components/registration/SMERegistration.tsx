import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { PayPalButton } from '../ui/PayPalButton';
import { authService } from '../../firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { storage, db, functions, isFirebaseConfigured, isStorageConfigured } from '../../firebase/config';

interface FormData {
  // Personal Information
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  idNumber: string;
  password: string;
  confirmPassword: string;
  
  // Professional Information
  roles: string[];
  otherRole: string;
  experience: string;
  specializations: string[];
  sectors: string[];
  locations: string[];
  otherSpecialization: string;
  otherSector: string;
  
  // Qualifications
  qualifications: string[];
  qualificationSpecs: { [key: string]: string }; // Store specifications for each qualification
  otherQualification: string;
  setaRegistrations: { [sector: string]: string };
  
  // Rates
  facilitationRate: string;
  assessmentRate: string;
  consultationRate: string;
  moderationRate: string;
  
  // CV Form Data (replaces CV upload)
  cv: {
    professionalSummary: string;
    workExperience: Array<{
      id: string;
      company: string;
      position: string;
      startDate: string;
      endDate: string;
      current: boolean;
      description: string;
    }>;
    languages: Array<{
      language: string;
      proficiency: 'Basic' | 'Conversational' | 'Fluent' | 'Native';
    }>;
    references: Array<{
      id: string;
      name: string;
      position: string;
      company: string;
      email: string;
      phone: string;
    }>;
  };
  
  // Documents
  documents: {
    idDocuments: File[];
    qualificationCerts: File[];
    setaCertificates: File[];
  };
  documentsCertificationDates: {
    idDocuments: string;
    qualificationCerts: string;
    setaCertificates: string;
  };
  documentsCertificationConfirmed: boolean;
  termsAccepted: boolean;
  
  // Payment
  paymentPlan: 'free' | 'monthly' | 'annual' | '';
}

export function SMERegistration() {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    idNumber: '',
    password: '',
    confirmPassword: '',
    roles: [],
    otherRole: '',
    experience: '',
    specializations: [],
    sectors: [],
    locations: [],
    otherSpecialization: '',
    otherSector: '',
    qualifications: [],
    qualificationSpecs: {},
    otherQualification: '',
    setaRegistrations: {},
    facilitationRate: '',
    assessmentRate: '',
    consultationRate: '',
    moderationRate: '',
    cv: {
      professionalSummary: '',
      workExperience: [],
      languages: [],
      references: []
    },
    documents: {
      idDocuments: [],
      qualificationCerts: [],
      setaCertificates: []
    },
    documentsCertificationDates: {
      idDocuments: '',
      qualificationCerts: '',
      setaCertificates: ''
    },
    documentsCertificationConfirmed: false,
    termsAccepted: false,
    paymentPlan: ''
  });

  const roles = [
    'Facilitator',
    'Assessor',
    'Moderator',
    'Consultant',
    'Skills Development Coordinator',
    'Training Manager',
    'Other'
  ];

  const specializations = [
    'Business Management',
    'Human Resources',
    'Information Technology',
    'Leadership Development',
    'Project Management',
    'Skills Development',
    'Training Design',
    'Quality Assurance',
    'Digital Literacy',
    'Communication Skills'
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

const NATIONAL_LOCATION = 'National availability (willing to travel anywhere)';
const MAX_DOCUMENT_SIZE = 5 * 1024 * 1024; // 5MB limit per document

type SMEPlanKey = 'free' | 'monthly' | 'annual';

interface SMEPlanDefinition {
  label: string;
  amount: number;
  billingType: 'trial' | 'subscription' | 'once_off';
  durationDays?: number;
  paypalPlanId: string;
  description: string;
}

interface PaymentReceiptInfo {
  reference: string;
  amount: string;
  expiresAt?: string;
}

interface PaypalResponseData {
  orderId: string;
  approvalUrl?: string;
  paymentStatus: string;
  amount: number;
  currency: string;
  expiresAt?: { seconds: number; nanoseconds: number } | null;
  message?: string;
}

const SME_PLAN_DETAILS: Record<SMEPlanKey, SMEPlanDefinition> = {
  free: {
    label: 'Free Trial',
    amount: 0,
    billingType: 'trial',
    durationDays: 30,
    paypalPlanId: 'sme-free',
    description: '30-day access to get started'
  },
  monthly: {
    label: 'SME Monthly',
    amount: 99,
    billingType: 'subscription',
    durationDays: 30,
    paypalPlanId: 'sme-monthly',
    description: 'Flexible month-to-month access'
  },
  annual: {
    label: 'SME Annual',
    amount: 999,
    billingType: 'subscription',
    durationDays: 365,
    paypalPlanId: 'sme-annual',
    description: 'Best value annual plan'
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

  const locationOptions = [
    'Johannesburg, Gauteng',
    'Cape Town, Western Cape',
    'Durban, KwaZulu-Natal',
    'Pretoria, Gauteng',
    'Port Elizabeth, Eastern Cape',
    'Bloemfontein, Free State',
    'Polokwane, Limpopo',
    'Nelspruit, Mpumalanga',
    'Kimberley, Northern Cape',
    NATIONAL_LOCATION
  ];

  const [errorSections, setErrorSections] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentReceipt, setPaymentReceipt] = useState<PaymentReceiptInfo | null>(null);

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

  const highlightError = (sectionId: string, fields: string[] = []) => {
    setErrorSections([sectionId]);
    setFieldErrors(fields);
  };

  const clearFieldError = (fieldId: string) => {
    setFieldErrors(prev => prev.filter(id => id !== fieldId));
  };

  const mockPaymentConfirmation = (plan: SMEPlanDefinition) => {
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
      highlightError('step7', ['payment']);
      return;
    }

    const planKey = formData.paymentPlan as SMEPlanKey;
    const plan = SME_PLAN_DETAILS[planKey];
    if (!plan) {
      setError('Unable to locate the selected plan. Please choose again.');
      return;
    }

    setPaymentProcessing(true);

    if (!isFirebaseConfigured()) {
      console.warn('Firebase Functions not configured. Using mock payment confirmation for SME.');
      mockPaymentConfirmation(plan);
      return;
    }

    try {
      const initiatePaypal = httpsCallable(functions, 'initiatePaypalPayment');
      // For free trials, set post-trial amount to monthly plan amount
      const postTrialAmount = plan.billingType === 'trial' 
        ? (SME_PLAN_DETAILS.monthly.amount) 
        : undefined;
      
      // Store payment details in localStorage for success/cancelled pages
      // Note: currency is handled by backend based on PayPal environment (USD for sandbox, ZAR for production)
      const paymentDetails = {
        amount: plan.amount,
        // Don't set currency - let backend decide based on PayPal environment
        planId: plan.paypalPlanId,
        billingType: plan.billingType,
        role: 'sme',
        customer: {
          name: `${formData.firstName} ${formData.lastName}`.trim(),
          email: formData.email
        },
        metadata: {
          planName: plan.label,
          planLabel: plan.label,
          userEmail: formData.email,
          planDurationDays: plan.durationDays,
          postTrialAmount: postTrialAmount
        }
      };
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('pending_payment', JSON.stringify(paymentDetails));
      }
      
      const response = await initiatePaypal({
        ...paymentDetails,
        returnUrl: typeof window !== 'undefined' ? `${window.location.origin}/payments/success` : undefined,
        cancelUrl: typeof window !== 'undefined' ? `${window.location.origin}/payments/cancelled` : undefined
      });

      const data = response.data as PaypalResponseData;

      // Always open approval URL for trials (even if amount is 0) to set up payment method
      // Also open for paid plans
      if (data.approvalUrl && typeof window !== 'undefined') {
        window.open(data.approvalUrl, '_blank', 'noopener');
      }

      const expiresAt = plan.durationDays
        ? computeExpiryDate(plan.durationDays)
        : normalizeFirestoreTimestamp(data.expiresAt);

      setPaymentReceipt({
        amount: plan.amount === 0 ? 'R0' : formatAmount(plan.amount),
        reference: data.orderId || `PAYPAL-${Date.now()}`,
        expiresAt
      });
      setPaymentConfirmed(true);
      clearFieldError('payment');
    } catch (paypalError: any) {
      console.error('PayPal initialization error (SME):', paypalError);
      const errorMessage = paypalError?.message || paypalError?.code || 'Unknown error';
      if (errorMessage.includes('credentials') || errorMessage.includes('failed-precondition')) {
        setError('PayPal is not configured. Please contact support or try again later.');
      } else if (errorMessage.includes('plan')) {
        setError('Unable to set up payment plan. Please try again or contact support.');
      } else {
        setError(`Unable to start PayPal checkout: ${errorMessage}. Please try again.`);
      }
    } finally {
      setPaymentProcessing(false);
    }
  };

  // Handle pre-selected plan from pricing page
  useEffect(() => {
    const state = location.state as { selectedPlan?: string };
    if (state?.selectedPlan) {
      const planId = state.selectedPlan;
      if (planId === 'sme-free') {
        setFormData(prev => ({ ...prev, paymentPlan: 'free' }));
      } else if (planId === 'sme-monthly') {
        setFormData(prev => ({ ...prev, paymentPlan: 'monthly' }));
      } else if (planId === 'sme-annual') {
        setFormData(prev => ({ ...prev, paymentPlan: 'annual' }));
      }
    }
  }, [location]);

  useEffect(() => {
    setPaymentConfirmed(false);
    setPaymentReceipt(null);
    setPaymentProcessing(false);
  }, [formData.paymentPlan]);

  const steps = [
    { number: 1, title: 'Personal Information', completed: currentStep > 1 },
    { number: 2, title: 'Professional Details', completed: currentStep > 2 },
    { number: 3, title: 'Qualifications', completed: currentStep > 3 },
    { number: 4, title: 'Rates & Availability', completed: currentStep > 4 },
    { number: 5, title: 'Document Upload', completed: currentStep > 5 },
    { number: 6, title: 'Review & Subscribe', completed: currentStep > 6 },
    { number: 7, title: 'Payment', completed: false }
  ];

  const formatSetaRegistrationSummary = (data: FormData) => {
    const entries: string[] = [];
    data.sectors.forEach(sector => {
      const label = sector === 'Other'
        ? (data.otherSector?.trim() || 'Other Sector')
        : sector;
      const value = data.setaRegistrations[sector];
      if (value && value.trim()) {
        entries.push(`${label}: ${value.trim()}`);
      }
    });
    return entries.join(' | ');
  };

  const formatCertificationDateForDisplay = (value: string) => {
    if (!value) return '';
    return new Date(value).toLocaleDateString('en-ZA', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const highlightSection = (sectionId: string, fields: string[] = []) => {
    highlightError(sectionId, fields);
  };

  const nextStep = async () => {
    setError('');
    setErrorSections([]);
    
    // Validate current step before proceeding
    if (currentStep === 1) {
      const missingPersonalFields: string[] = [];
      if (!formData.firstName.trim()) missingPersonalFields.push('firstName');
      if (!formData.lastName.trim()) missingPersonalFields.push('lastName');
      if (!formData.email.trim()) missingPersonalFields.push('email');
      if (!formData.phone.trim()) missingPersonalFields.push('phone');
      if (!formData.idNumber.trim()) missingPersonalFields.push('idNumber');

      if (missingPersonalFields.length > 0) {
        setError('Please fill in all personal information fields');
        highlightSection('step1', missingPersonalFields);
        return;
      }
      if (!formData.password || !formData.confirmPassword) {
        setError('Please enter a password');
        highlightSection('step1', ['password', 'confirmPassword']);
        return;
      }
      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters');
        highlightSection('step1', ['password']);
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        highlightSection('step1', ['password', 'confirmPassword']);
        return;
      }
    }
    
    // Validate step 2 (Professional Details)
    if (currentStep === 2) {
      if (formData.roles.length === 0) {
        setError('Please select at least one role');
        highlightSection('step2');
        return;
      }
      if (formData.roles.includes('Other') && !formData.otherRole.trim()) {
        setError('Please specify your other role');
        highlightSection('step2');
        return;
      }
      if (!formData.experience) {
        setError('Please select your years of experience');
        highlightSection('step2');
        return;
      }
      if (formData.locations.length === 0) {
        setError('Please select at least one location');
        highlightSection('step2');
        return;
      }
    }
    
    // Validate step 3 (Qualifications)
    if (currentStep === 3) {
      if (formData.qualifications.length === 0) {
        setError('Please select at least one qualification');
        highlightSection('step3');
        return;
      }
      // Check that each selected qualification has a specification
      for (const qual of formData.qualifications) {
          if (qual === 'Other') {
            if (!formData.otherQualification.trim()) {
              setError('Please specify your other qualification');
              highlightSection('step3');
              return;
            }
          } else {
            if (!formData.qualificationSpecs[qual]?.trim()) {
              setError(`Please name your ${qual.toLowerCase()}`);
              highlightSection('step3');
              return;
            }
          }
      }

      if (formData.sectors.length > 0) {
        for (const sector of formData.sectors.filter(sector => sector !== 'Other')) {
          if (!formData.setaRegistrations[sector]?.trim()) {
            setError(`Please enter your ${sector} registration number`);
            highlightSection('step3');
            return;
          }
        }

        if (formData.sectors.includes('Other') && formData.otherSector.trim()) {
          if (!formData.setaRegistrations['Other']?.trim()) {
            setError(`Please enter your ${formData.otherSector.trim()} registration number`);
            highlightSection('step3');
            return;
          }
        }
      }
    }
    
    // Validate CV form on step 5
    if (currentStep === 5) {
      if (!formData.cv.professionalSummary.trim()) {
        setError('Please provide a professional summary');
        return;
      }
      if (formData.cv.workExperience.length === 0) {
        setError('Please add at least one work experience entry');
        highlightSection('documents', ['workExperience']);
        return;
      }
      // Validate each work experience entry
      for (const exp of formData.cv.workExperience) {
        if (!exp.company.trim() || !exp.position.trim() || !exp.startDate) {
          setError('Please complete all required fields for work experience');
          highlightSection('documents', ['workExperience']);
          return;
        }
        if (!exp.current && !exp.endDate) {
          setError('Please provide an end date or mark as current position');
          highlightSection('documents', ['workExperience']);
          return;
        }
      }
      if (formData.cv.references.length === 0) {
        setError('Please add at least one reference');
        highlightSection('documents', ['references']);
        return;
      }
      // Validate each reference
      for (const ref of formData.cv.references) {
        if (!ref.name.trim() || !ref.email.trim() || !ref.phone.trim()) {
          setError('Please complete all required fields for references');
          highlightSection('documents', ['references']);
          return;
        }
      }
      if (formData.documents.idDocuments.length === 0) {
        setError('Please upload at least one certified ID document');
        highlightSection('documents', ['idDocuments']);
        return;
      }
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const tenDaysAgo = new Date(now);
      tenDaysAgo.setDate(now.getDate() - 10);
      const ninetyDaysAgo = new Date(now);
      ninetyDaysAgo.setDate(now.getDate() - 90);

      const validateCertificationDate = (value: string, label: string) => {
        if (!value) {
          setError(`Please provide the ${label} certification date`);
          return false;
        }

        const certDate = new Date(value);
        certDate.setHours(0, 0, 0, 0);

        if (certDate > now) {
          setError(`${label} certification date cannot be in the future.`);
          return false;
        }

        if (certDate < ninetyDaysAgo) {
          setError(`${label} certification date must be within the last 3 months.`);
          return false;
        }

        if (certDate < tenDaysAgo) {
          setError(`${label} certification date must not be older than 10 days.`);
          return false;
        }

        return true;
      };

      if (!validateCertificationDate(formData.documentsCertificationDates.idDocuments, 'ID documents')) {
        highlightSection('documents', ['idDocuments']);
        return;
      }

      if (
        formData.documents.qualificationCerts.length > 0 &&
        !validateCertificationDate(formData.documentsCertificationDates.qualificationCerts, 'qualification certificates')
      ) {
        highlightSection('documents', ['qualificationCerts']);
        return;
      }

      if (
        formData.documents.setaCertificates.length > 0 &&
        !validateCertificationDate(formData.documentsCertificationDates.setaCertificates, 'SETA certificates')
      ) {
        highlightSection('documents', ['setaCertificates']);
        return;
      }
      if (!formData.documentsCertificationConfirmed) {
        setError('Please confirm your documents are certified and belong to you');
        highlightSection('documents');
        return;
      }
    }
    
    // Validate payment plan selection and terms agreement on step 7
    if (currentStep === 7) {
      if (!formData.termsAccepted) {
        setError('Please agree to the Terms of Service to continue');
        highlightSection('step7');
        return;
      }
      if (!formData.paymentPlan) {
        setError('Please select a payment plan to continue');
      highlightSection('step7', ['payment']);
      return;
    }
    if (!paymentConfirmed) {
      setError('Please complete the PayPal payment step before finishing your registration.');
      highlightSection('step7', ['payment']);
        return;
      }
    }
    
    if (currentStep < 7) {
      setCurrentStep(currentStep + 1);
    } else {
      // Final step - Create user account
      setLoading(true);
      const certificationDatesPayload = Object.entries(formData.documentsCertificationDates).reduce(
        (acc, [key, value]) => {
          if (value) {
            acc[key as keyof FormData['documentsCertificationDates']] = value;
          }
          return acc;
        },
        {} as FormData['documentsCertificationDates']
      );
      try {
        const selectedPlan = formData.paymentPlan as SMEPlanKey;
        const planDefinition = SME_PLAN_DETAILS[selectedPlan];
        const planActivatedAt = new Date();
        let planExpiresAt: string | undefined;
        if (planDefinition?.durationDays) {
          const expiry = new Date(planActivatedAt);
          expiry.setDate(expiry.getDate() + planDefinition.durationDays);
          planExpiresAt = expiry.toISOString();
        }

        const result = await authService.signUp(
          formData.email,
          formData.password,
          {
            email: formData.email,
            role: 'SME',
            verified: false,
            profile: {
              id: '', // Will be set by Firebase
              name: `${formData.firstName} ${formData.lastName}`,
              email: formData.email,
              roles: formData.roles.includes('Other') && formData.otherRole.trim()
                ? [...formData.roles.filter(r => r !== 'Other'), formData.otherRole.trim()]
                : formData.roles.filter(r => r !== 'Other'),
              specializations: formData.specializations,
              sectors: formData.sectors,
              location: formData.locations.includes(NATIONAL_LOCATION)
                ? 'National (Willing to travel anywhere)'
                : (formData.locations[0] || ''),
              locations: formData.locations,
              experience: formData.experience,
              qualifications: formData.qualifications.map(qual => {
                if (qual === 'Other') {
                  return formData.otherQualification.trim();
                } else {
                  const spec = formData.qualificationSpecs[qual]?.trim() || '';
                  return spec ? `${qual} - ${spec}` : qual;
                }
              }),
              rates: {
                facilitation: formData.facilitationRate,
                assessment: formData.assessmentRate,
                consultation: formData.consultationRate,
                moderation: formData.moderationRate
              },
              availability: 'Available' as const,
              rating: 0.0,
              reviews: 0,
              verified: false,
              profileImage: '',
              aboutMe: formData.cv.professionalSummary,
              cv: formData.cv,
              phone: formData.phone,
              setaRegistration: formatSetaRegistrationSummary(formData),
              setaRegistrations: formData.setaRegistrations,
              documentCertificationDate: certificationDatesPayload.idDocuments || '',
              documentCertificationDates: certificationDatesPayload,
              documentsCertificationConfirmed: formData.documentsCertificationConfirmed,
              planType: selectedPlan,
              planStatus: selectedPlan === 'free' ? 'trial_active' : 'active',
              planActivatedAt: planActivatedAt.toISOString(),
              planExpiresAt,
              planReference: paymentReceipt?.reference
            }
          }
        );
        
        if (result.error) {
          setError(result.error);
          setLoading(false);
        } else {
          // Upload registration documents if Firebase is configured
          if (result.user && isFirebaseConfigured() && isStorageConfigured()) {
            try {
              const userId = result.user.uid;
              const documentsToUpload: Array<{ file: File; name: string; type: string }> = [];

              // CV data is saved in profile, no file upload needed

              // Add ID Documents
              formData.documents.idDocuments.forEach((file, index) => {
                documentsToUpload.push({
                  file,
                  name: `ID Document ${index + 1}`,
                  type: file.type || 'application/pdf'
                });
              });

              // Add Qualification Certificates
              formData.documents.qualificationCerts.forEach((file, index) => {
                documentsToUpload.push({
                  file,
                  name: `Qualification Certificate ${index + 1}`,
                  type: file.type || 'application/pdf'
                });
              });

              // Add SETA Certificates
              formData.documents.setaCertificates.forEach((file, index) => {
                documentsToUpload.push({
                  file,
                  name: `SETA Certificate ${index + 1}`,
                  type: file.type || 'application/pdf'
                });
              });

              // Upload all documents
              for (const doc of documentsToUpload) {
                try {
                  // Upload to Firebase Storage
                  const fileExtension = doc.file.name.split('.').pop() || 'pdf';
                  const fileName = `${Date.now()}_${doc.name.replace(/[^a-zA-Z0-9]/g, '_')}.${fileExtension}`;
                  const storageRef = ref(storage, `user-documents/${userId}/${fileName}`);
                  
                  await uploadBytes(storageRef, doc.file);
                  const downloadURL = await getDownloadURL(storageRef);

                  // Save document reference to Firestore
                  await addDoc(collection(db, 'users', userId, 'documents'), {
                    name: doc.name,
                    type: doc.file.type || 'PDF',
                    size: `${(doc.file.size / 1024).toFixed(0)} KB`,
                    url: downloadURL,
                    uploadedAt: Timestamp.now(),
                    reviewStatus: 'pending',
                    source: 'registration'
                  });
                } catch (uploadError: any) {
                  console.error(`Error uploading ${doc.name}:`, uploadError);
                  // Continue with other documents even if one fails
                }
              }

              console.log(`✅ Uploaded ${documentsToUpload.length} registration document(s)`);
            } catch (docError: any) {
              console.error('Error uploading registration documents:', docError);
              // Don't block registration if document upload fails
            }
          }

          // Registration successful - redirect to login
          alert('Registration successful! Please log in with your credentials.');
          navigate('/login');
        }
      } catch (err: any) {
        console.error('Registration error:', err);
        setError(err.message || 'Failed to create account. Please try again.');
        setLoading(false);
      }
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleArrayFieldChange = (field: 'specializations' | 'sectors' | 'qualifications', value: string) => {
    setFormData(prev => {
      const isSelected = prev[field].includes(value);
      const updatedValues = isSelected
        ? prev[field].filter(item => item !== value)
        : [...prev[field], value];

      if (field === 'sectors') {
        const updatedSetaRegistrations = { ...prev.setaRegistrations };
        if (isSelected) {
          delete updatedSetaRegistrations[value];
        } else if (!updatedSetaRegistrations[value]) {
          updatedSetaRegistrations[value] = '';
        }

        return {
          ...prev,
          [field]: updatedValues,
          setaRegistrations: updatedSetaRegistrations
        };
      }

      return {
        ...prev,
        [field]: updatedValues
      };
    });
  };

  const updateSetaRegistrationValue = (sectorKey: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      setaRegistrations: {
        ...prev.setaRegistrations,
        [sectorKey]: value
      }
    }));
  };

  const documentFieldToLabel: Record<keyof FormData['documents'], string> = {
    idDocuments: 'ID documents',
    qualificationCerts: 'qualification certificates',
    setaCertificates: 'SETA certificates'
  };

  const documentFieldToDateKey: Record<
    keyof FormData['documents'],
    keyof FormData['documentsCertificationDates']
  > = {
    idDocuments: 'idDocuments',
    qualificationCerts: 'qualificationCerts',
    setaCertificates: 'setaCertificates'
  };

  const handleDocumentUpload = (
    field: keyof FormData['documents'],
    files: FileList | null
  ) => {
    if (!files || files.length === 0) return;

    const filesArray = Array.from(files);
    const oversizedFiles = filesArray.filter(file => file.size > MAX_DOCUMENT_SIZE);

    if (oversizedFiles.length) {
      setError(
        `Each ${documentFieldToLabel[field]} must be 5MB or smaller. Remove oversized files: ${oversizedFiles
          .map(file => file.name)
          .join(', ')}.`
      );
    }

    const validFiles = filesArray.filter(file => file.size <= MAX_DOCUMENT_SIZE);
    if (!validFiles.length) {
      return;
    }

    setError('');
    setFormData(prev => ({
      ...prev,
      documents: {
        ...prev.documents,
        [field]: [...prev.documents[field], ...validFiles]
      }
    }));
  };

  const handleDocumentRemoval = (
    field: keyof FormData['documents'],
    index: number
  ) => {
    setFormData(prev => {
      const updatedDocuments = {
        ...prev.documents,
        [field]: prev.documents[field].filter((_, idx) => idx !== index)
      };

      const dateKey = documentFieldToDateKey[field];
      const updatedDates = { ...prev.documentsCertificationDates };
      if (updatedDocuments[field].length === 0) {
        updatedDates[dateKey] = '';
      }

      return {
        ...prev,
        documents: updatedDocuments,
        documentsCertificationDates: updatedDates
      };
    });
    setError('');
  };

  const updateCertificationDate = (
    field: keyof FormData['documentsCertificationDates'],
    value: string
  ) => {
    setError('');
    setFormData(prev => ({
      ...prev,
      documentsCertificationDates: {
        ...prev.documentsCertificationDates,
        [field]: value
      }
    }));
  };

  const toggleLocation = (locationValue: string) => {
    setFormData(prev => {
      const exists = prev.locations.includes(locationValue);
      return {
        ...prev,
        locations: exists
          ? prev.locations.filter(loc => loc !== locationValue)
          : [...prev.locations, locationValue]
      };
    });
  };

  const StepIndicator = () => (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.number} className="flex items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
              step.completed
                ? 'bg-green-500 text-white'
                : currentStep === step.number
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-600'
            }`}>
              {step.completed ? <CheckCircle className="w-5 h-5" /> : step.number}
            </div>
            {index < steps.length - 1 && (
              <div className={`w-12 lg:w-24 h-0.5 ${
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  First Name *
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => {
                    clearFieldError('firstName');
                    setFormData({ ...formData, firstName: e.target.value });
                  }}
                  className={getInputClasses('firstName')}
                  placeholder="Enter your first name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name *
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => {
                    clearFieldError('lastName');
                    setFormData({ ...formData, lastName: e.target.value });
                  }}
                  className={getInputClasses('lastName')}
                  placeholder="Enter your last name"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => {
                  clearFieldError('email');
                  setFormData({ ...formData, email: e.target.value });
                }}
                className={getInputClasses('email')}
                placeholder="your.email@example.com"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ID Number *
                </label>
                <input
                  type="text"
                  value={formData.idNumber}
                  onChange={(e) => {
                    clearFieldError('idNumber');
                    setFormData({ ...formData, idNumber: e.target.value });
                  }}
                  className={getInputClasses('idNumber')}
                  placeholder="ID number for verification"
                />
              </div>
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
                />
                <p className="text-xs text-gray-500 mt-1">Choose a strong password (minimum 6 characters)</p>
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
              </div>
            </div>
            
          </div>
        );

      case 2:
        return (
          <div className={getSectionClasses('step2')}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Your Roles * <span className="text-gray-500 text-xs">(You can select multiple)</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                {roles.map(role => (
                  <label
                    key={role}
                    className={`flex items-center space-x-2 p-3 border rounded-md cursor-pointer transition-all ${
                      formData.roles.includes(role)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-300 hover:border-blue-300 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={formData.roles.includes(role)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, roles: [...formData.roles, role] });
                        } else {
                          setFormData({ ...formData, roles: formData.roles.filter(r => r !== role), otherRole: role === 'Other' ? '' : formData.otherRole });
                        }
                      }}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{role}</span>
                  </label>
                ))}
              </div>
              {formData.roles.includes('Other') && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Specify Your Other Role *
                  </label>
                  <input
                    type="text"
                    value={formData.otherRole}
                    onChange={(e) => setFormData({ ...formData, otherRole: e.target.value })}
                    placeholder="Enter your custom role"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}
              {formData.roles.length === 0 && (
                <p className="mt-1 text-sm text-red-600">Please select at least one role</p>
              )}
              {formData.roles.includes('Other') && !formData.otherRole.trim() && (
                <p className="mt-1 text-sm text-red-600">Please specify your other role</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Years of Experience *
              </label>
              <select
                value={formData.experience}
                onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select experience level</option>
                <option value="1-2 years">1-2 years</option>
                <option value="3-5 years">3-5 years</option>
                <option value="6-10 years">6-10 years</option>
                <option value="10+ years">10+ years</option>
                <option value="15+ years">15+ years</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Preferred Locations * (Select all that apply)
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {locationOptions.map(locationOption => (
                  <label key={locationOption} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.locations.includes(locationOption)}
                      onChange={() => toggleLocation(locationOption)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">
                      {locationOption === NATIONAL_LOCATION ? 'National (Willing to travel anywhere)' : locationOption}
                    </span>
                  </label>
                ))}
              </div>
              {formData.locations.length === 0 && (
                <p className="mt-2 text-sm text-red-600">Please select at least one location</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Specializations * (Select all that apply)
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {specializations.map(spec => (
                  <label key={spec} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.specializations.includes(spec)}
                      onChange={() => handleArrayFieldChange('specializations', spec)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{spec}</span>
                  </label>
                ))}
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.specializations.includes('Other')}
                    onChange={() => handleArrayFieldChange('specializations', 'Other')}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Other</span>
                </label>
              </div>
              {formData.specializations.includes('Other') && (
                <div className="mt-3">
                  <input
                    type="text"
                    value={formData.otherSpecialization}
                    onChange={(e) => setFormData({ ...formData, otherSpecialization: e.target.value })}
                    placeholder="Please specify your other specialization"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Sectors * (Select sectors you work in)
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
                    onChange={(e) => setFormData({ ...formData, otherSector: e.target.value })}
                    placeholder="Please specify your other sector"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}
            </div>
          </div>
        );

      case 3:
        const qualificationsList = [
          'Grade 12 / NQF Level 4',
          'Higher Certificate',
          'Diploma',
          'Bachelor\'s Degree',
          'Honours Degree',
          'Master\'s Degree',
          'PhD',
          'Assessor Registration',
          'Moderator Registration',
          'Facilitator Registration',
          'Industry Certification'
        ];
        const selectedSetaSectors = formData.sectors.filter(sector => sector !== 'Other');
        const includeOtherSector = formData.sectors.includes('Other');

        return (
          <div className={getSectionClasses('step3')}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Qualifications * (Select all that apply and specify each one)
              </label>
              <div className="space-y-4">
                {qualificationsList.map(qual => (
                  <div key={qual} className="border border-gray-200 rounded-lg p-3">
                    <label className="flex items-center space-x-2 cursor-pointer mb-2">
                    <input
                      type="checkbox"
                      checked={formData.qualifications.includes(qual)}
                        onChange={() => {
                          if (formData.qualifications.includes(qual)) {
                            // Remove qualification and its spec
                            const newSpecs = { ...formData.qualificationSpecs };
                            delete newSpecs[qual];
                            setFormData({ 
                              ...formData, 
                              qualifications: formData.qualifications.filter(q => q !== qual),
                              qualificationSpecs: newSpecs
                            });
                          } else {
                            // Add qualification
                            setFormData({ 
                              ...formData, 
                              qualifications: [...formData.qualifications, qual],
                              qualificationSpecs: { ...formData.qualificationSpecs, [qual]: '' }
                            });
                          }
                        }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                      <span className="text-sm font-medium text-gray-700">{qual}</span>
                  </label>
                    {formData.qualifications.includes(qual) && (
                      <div className="mt-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Name the qualification *
                        </label>
                        <input
                          type="text"
                          value={formData.qualificationSpecs[qual] || ''}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            qualificationSpecs: { ...formData.qualificationSpecs, [qual]: e.target.value }
                          })}
                          placeholder={
                            qual === 'Grade 12 / NQF Level 4' 
                              ? 'e.g., Mathematics and Physical Science, Business Studies, etc.'
                              : qual === 'Higher Certificate'
                              ? 'e.g., Higher Certificate in Business Management'
                              : qual === 'Diploma'
                              ? 'e.g., Diploma in Human Resources Management'
                              : qual === 'Bachelor\'s Degree'
                              ? 'e.g., Bachelor of Commerce in Business Management'
                              : qual === 'Master\'s Degree'
                              ? 'e.g., Master of Business Administration'
                              : qual === 'PhD'
                              ? 'e.g., PhD in Education'
                              : qual === 'ETDP SETA Registration'
                              ? 'e.g., ETDP12345'
                              : qual === 'Assessor Registration'
                              ? 'e.g., Assessor Registration Number'
                              : qual === 'Moderator Registration'
                              ? 'e.g., Moderator Registration Number'
                              : qual === 'Facilitator Registration'
                              ? 'e.g., Facilitator Registration Number'
                              : qual === 'Industry Certification'
                              ? 'e.g., PMP Certification, Microsoft Certified, etc.'
                              : `e.g., ${qual}`
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          required
                        />
                        {!formData.qualificationSpecs[qual]?.trim() && (
                          <p className="text-xs text-red-600 mt-1">Please name this qualification</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                <div className="border border-gray-200 rounded-lg p-3">
                  <label className="flex items-center space-x-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={formData.qualifications.includes('Other')}
                      onChange={() => {
                        if (formData.qualifications.includes('Other')) {
                          setFormData({ 
                            ...formData, 
                            qualifications: formData.qualifications.filter(q => q !== 'Other'),
                            otherQualification: ''
                          });
                        } else {
                          setFormData({ 
                            ...formData, 
                            qualifications: [...formData.qualifications, 'Other']
                          });
                        }
                      }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                    <span className="text-sm font-medium text-gray-700">Other</span>
                </label>
              {formData.qualifications.includes('Other') && (
                    <div className="mt-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Name the qualification *
                      </label>
                  <input
                    type="text"
                    value={formData.otherQualification}
                    onChange={(e) => setFormData({ ...formData, otherQualification: e.target.value })}
                        placeholder="e.g., Professional Certificate in Project Management"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        required
                  />
                      {!formData.otherQualification.trim() && (
                        <p className="text-xs text-red-600 mt-1">Please name this qualification</p>
                      )}
                </div>
              )}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                SETA Registration Numbers
              </label>
              {selectedSetaSectors.length === 0 && !includeOtherSector ? (
                <p className="text-sm text-gray-500">Select your sector(s) in the previous step to provide registration numbers.</p>
              ) : (
                <div className="space-y-3">
                  {selectedSetaSectors.map(sector => (
                    <div key={sector}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        {sector} Registration Number
              </label>
              <input
                type="text"
                        value={formData.setaRegistrations[sector] || ''}
                        onChange={(e) => updateSetaRegistrationValue(sector, e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder={`Enter your ${sector} registration number`}
                      />
                    </div>
                  ))}

                  {includeOtherSector && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        {(formData.otherSector?.trim() || 'Other Sector')} Registration Number
                      </label>
                      <input
                        type="text"
                        value={formData.setaRegistrations['Other'] || ''}
                        onChange={(e) => updateSetaRegistrationValue('Other', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter your custom sector registration number"
                      />
                    </div>
                  )}
                </div>
              )}
              <p className="text-xs text-gray-500 mt-1">Enter the SETA registration number for each sector you selected.</p>
            </div>
          </div>
        );

      case 4:
        return (
          <div className={getSectionClasses('documents')}>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-900 mb-2">Rates Information</h3>
              <p className="text-xs text-blue-700">
                Provide your standard rates per service type. This helps SDPs understand your pricing.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Facilitation Rate *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">R</span>
                  <input
                    type="text"
                    value={formData.facilitationRate}
                    onChange={(e) => setFormData({ ...formData, facilitationRate: e.target.value })}
                    className="w-full pl-6 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g. 1500"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Per day rate</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assessment Rate *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">R</span>
                  <input
                    type="text"
                    value={formData.assessmentRate}
                    onChange={(e) => setFormData({ ...formData, assessmentRate: e.target.value })}
                    className="w-full pl-6 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g. 800"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Per POE</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Consultation Rate
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">R</span>
                  <input
                    type="text"
                    value={formData.consultationRate}
                    onChange={(e) => setFormData({ ...formData, consultationRate: e.target.value })}
                    className="w-full pl-6 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g. 1200"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Per hour rate</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Moderation Rate
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">R</span>
                  <input
                    type="text"
                    value={formData.moderationRate}
                    onChange={(e) => setFormData({ ...formData, moderationRate: e.target.value })}
                    className="w-full pl-6 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g. 1000"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Per POE</p>
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-900 mb-2">Curriculum Vitae (CV)</h3>
              <p className="text-xs text-blue-700">
                Complete your CV information below. This standardized format helps SDPs understand your experience. 
                All supporting documents must be certified copies issued within the last 10 days (max 5MB each). You can upload multiple files per category and remove or replace them at any time.
              </p>
            </div>

            {/* Professional Summary */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Professional Summary *
              </label>
              <textarea
                value={formData.cv.professionalSummary}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  cv: { ...formData.cv, professionalSummary: e.target.value }
                })}
                placeholder="Write a brief summary of your professional background, key skills, and career objectives..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                required
              />
            </div>

            {/* Work Experience */}
            <div className={hasFieldError('workExperience') ? 'border-2 border-red-400 rounded-xl p-4 bg-red-50/40' : ''}>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  Work Experience * (At least one required)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const newExp = {
                      id: Date.now().toString(),
                      company: '',
                      position: '',
                      startDate: '',
                      endDate: '',
                      current: false,
                      description: ''
                    };
                    setFormData({
                      ...formData,
                      cv: {
                        ...formData.cv,
                        workExperience: [...formData.cv.workExperience, newExp]
                      }
                    });
                  }}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  + Add Experience
                </button>
              </div>
              
              {formData.cv.workExperience.map((exp, index) => (
                <div key={exp.id} className="mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-gray-700">Experience {index + 1}</h4>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          cv: {
                            ...formData.cv,
                            workExperience: formData.cv.workExperience.filter(e => e.id !== exp.id)
                          }
                        });
                      }}
                      className="text-xs text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Company/Organization *
              </label>
              <input
                        type="text"
                        value={exp.company}
                        onChange={(e) => {
                          const updated = formData.cv.workExperience.map(expItem => 
                            expItem.id === exp.id ? { ...expItem, company: e.target.value } : expItem
                          );
                          setFormData({
                            ...formData,
                            cv: { ...formData.cv, workExperience: updated }
                          });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Position/Job Title *
                      </label>
                      <input
                        type="text"
                        value={exp.position}
                        onChange={(e) => {
                          const updated = formData.cv.workExperience.map(expItem => 
                            expItem.id === exp.id ? { ...expItem, position: e.target.value } : expItem
                          );
                          setFormData({
                            ...formData,
                            cv: { ...formData.cv, workExperience: updated }
                          });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Start Date *
                      </label>
                      <input
                        type="month"
                        value={exp.startDate}
                        onChange={(e) => {
                          const updated = formData.cv.workExperience.map(expItem => 
                            expItem.id === exp.id ? { ...expItem, startDate: e.target.value } : expItem
                          );
                          setFormData({
                            ...formData,
                            cv: { ...formData.cv, workExperience: updated }
                          });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        End Date {exp.current ? '(Current Position)' : '*'}
                      </label>
                      <input
                        type="month"
                        value={exp.endDate}
                        onChange={(e) => {
                          const updated = formData.cv.workExperience.map(expItem => 
                            expItem.id === exp.id ? { ...expItem, endDate: e.target.value } : expItem
                          );
                          setFormData({
                            ...formData,
                            cv: { ...formData.cv, workExperience: updated }
                          });
                        }}
                        disabled={exp.current}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm disabled:bg-gray-100"
                        required={!exp.current}
                      />
                    </div>
                  </div>
                  
                  <div className="mt-3">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={exp.current}
                        onChange={(e) => {
                          const updated = formData.cv.workExperience.map(expItem => 
                            expItem.id === exp.id ? { ...expItem, current: e.target.checked, endDate: e.target.checked ? '' : expItem.endDate } : expItem
                          );
                          setFormData({
                            ...formData,
                            cv: { ...formData.cv, workExperience: updated }
                          });
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs text-gray-600">I currently work here</span>
                    </label>
                  </div>
                  
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Job Description
                    </label>
                    <textarea
                      value={exp.description}
                      onChange={(e) => {
                        const updated = formData.cv.workExperience.map(expItem => 
                          expItem.id === exp.id ? { ...expItem, description: e.target.value } : expItem
                        );
                        setFormData({
                          ...formData,
                          cv: { ...formData.cv, workExperience: updated }
                        });
                      }}
                      placeholder="Describe your responsibilities and achievements in this role..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>
                </div>
              ))}
              
              {formData.cv.workExperience.length === 0 && (
                <p className="text-xs text-gray-500 italic">Click "Add Experience" to add your work history</p>
              )}
            </div>

            {/* Languages */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Languages
              </label>
              {formData.cv.languages.map((lang, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={lang.language}
                    onChange={(e) => {
                      const updated = formData.cv.languages.map((l, i) => 
                        i === index ? { ...l, language: e.target.value } : l
                      );
                      setFormData({
                        ...formData,
                        cv: { ...formData.cv, languages: updated }
                      });
                    }}
                    placeholder="Language"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                  <select
                    value={lang.proficiency}
                    onChange={(e) => {
                      const updated = formData.cv.languages.map((l, i) => 
                        i === index ? { ...l, proficiency: e.target.value as any } : l
                      );
                      setFormData({
                        ...formData,
                        cv: { ...formData.cv, languages: updated }
                      });
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    <option value="Basic">Basic</option>
                    <option value="Conversational">Conversational</option>
                    <option value="Fluent">Fluent</option>
                    <option value="Native">Native</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        cv: {
                          ...formData.cv,
                          languages: formData.cv.languages.filter((_, i) => i !== index)
                        }
                      });
                    }}
                    className="px-3 py-2 text-red-600 hover:text-red-700 text-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  setFormData({
                    ...formData,
                    cv: {
                      ...formData.cv,
                      languages: [...formData.cv.languages, { language: '', proficiency: 'Basic' }]
                    }
                  });
                }}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                + Add Language
              </button>
            </div>

            {/* References */}
            <div className={hasFieldError('references') ? 'border-2 border-red-400 rounded-xl p-4 bg-red-50/30' : ''}>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  Professional References * (At least one required)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const newRef = {
                      id: Date.now().toString(),
                      name: '',
                      position: '',
                      company: '',
                      email: '',
                      phone: ''
                    };
                    setFormData({
                      ...formData,
                      cv: {
                        ...formData.cv,
                        references: [...formData.cv.references, newRef]
                      }
                    });
                  }}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  + Add Reference
                </button>
              </div>
              
              {formData.cv.references.map((ref, index) => (
                <div key={ref.id} className="mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-gray-700">Reference {index + 1}</h4>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          cv: {
                            ...formData.cv,
                            references: formData.cv.references.filter(r => r.id !== ref.id)
                          }
                        });
                      }}
                      className="text-xs text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        value={ref.name}
                        onChange={(e) => {
                          const updated = formData.cv.references.map(r => 
                            r.id === ref.id ? { ...r, name: e.target.value } : r
                          );
                          setFormData({
                            ...formData,
                            cv: { ...formData.cv, references: updated }
                          });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Position/Title
                      </label>
                      <input
                        type="text"
                        value={ref.position}
                        onChange={(e) => {
                          const updated = formData.cv.references.map(r => 
                            r.id === ref.id ? { ...r, position: e.target.value } : r
                          );
                          setFormData({
                            ...formData,
                            cv: { ...formData.cv, references: updated }
                          });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Company/Organization
                      </label>
                      <input
                        type="text"
                        value={ref.company}
                        onChange={(e) => {
                          const updated = formData.cv.references.map(r => 
                            r.id === ref.id ? { ...r, company: e.target.value } : r
                          );
                          setFormData({
                            ...formData,
                            cv: { ...formData.cv, references: updated }
                          });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Email *
                      </label>
                      <input
                        type="email"
                        value={ref.email}
                        onChange={(e) => {
                          const updated = formData.cv.references.map(r => 
                            r.id === ref.id ? { ...r, email: e.target.value } : r
                          );
                          setFormData({
                            ...formData,
                            cv: { ...formData.cv, references: updated }
                          });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Phone Number *
                      </label>
                      <input
                        type="tel"
                        value={ref.phone}
                        onChange={(e) => {
                          const updated = formData.cv.references.map(r => 
                            r.id === ref.id ? { ...r, phone: e.target.value } : r
                          );
                          setFormData({
                            ...formData,
                            cv: { ...formData.cv, references: updated }
                          });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        required
                      />
                    </div>
                  </div>
                </div>
              ))}
              
              {formData.cv.references.length === 0 && (
                <p className="text-xs text-gray-500 italic">Click "Add Reference" to add professional references</p>
              )}
            </div>

            <div className={hasFieldError('idDocuments') ? 'border-2 border-red-400 rounded-xl p-4 bg-red-50/30' : ''}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ID Documents * (PDF or Image, max 5MB each)
              </label>
              <input
                type="file"
                accept="application/pdf,image/*"
                multiple
                onChange={(e) => {
                  handleDocumentUpload('idDocuments', e.target.files);
                  e.target.value = '';
                }}
                className="w-full text-sm"
              />
              {formData.documents.idDocuments.length > 0 && (
                <ul className="text-xs mt-2 space-y-1">
                  {formData.documents.idDocuments.map((file, idx) => (
                    <li
                      key={`${file.name}-${idx}`}
                      className="flex items-center justify-between bg-green-50 text-green-700 border border-green-100 rounded px-2 py-1"
                    >
                      <span className="truncate pr-2">✓ {file.name}</span>
                      <button
                        type="button"
                        onClick={() => handleDocumentRemoval('idDocuments', idx)}
                        className="text-[11px] text-red-600 hover:text-red-700 font-medium"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Document Certification Date *
                </label>
                <input
                  type="date"
                  value={formData.documentsCertificationDates.idDocuments}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => updateCertificationDate('idDocuments', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  required
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Upload certified copies issued within the last 10 days. Certification cannot be older than 10 days.
              </p>
            </div>

            <div className={hasFieldError('qualificationCerts') ? 'border-2 border-red-400 rounded-xl p-4 bg-red-50/30' : ''}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Qualification Certificates (PDF, max 5MB each)
              </label>
              <input
                type="file"
                multiple
                accept="application/pdf"
                onChange={(e) => {
                  handleDocumentUpload('qualificationCerts', e.target.files);
                  e.target.value = '';
                }}
                className="w-full text-sm"
              />
              {formData.documents.qualificationCerts.length > 0 && (
                <ul className="text-xs mt-2 space-y-1">
                  {formData.documents.qualificationCerts.map((file, idx) => (
                    <li
                      key={`${file.name}-${idx}`}
                      className="flex items-center justify-between bg-green-50 text-green-700 border border-green-100 rounded px-2 py-1"
                    >
                      <span className="truncate pr-2">✓ {file.name}</span>
                      <button
                        type="button"
                        onClick={() => handleDocumentRemoval('qualificationCerts', idx)}
                        className="text-[11px] text-red-600 hover:text-red-700 font-medium"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Document Certification Date {formData.documents.qualificationCerts.length > 0 && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="date"
                  value={formData.documentsCertificationDates.qualificationCerts}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => updateCertificationDate('qualificationCerts', e.target.value)}
                  required={formData.documents.qualificationCerts.length > 0}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Required when uploading qualification certificates (must not be older than 10 days).
                </p>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Upload certified qualifications issued within the last 10 days.
              </p>
            </div>

            <div className={hasFieldError('setaCertificates') ? 'border-2 border-red-400 rounded-xl p-4 bg-red-50/30' : ''}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                SETA Certificates (PDF, optional, max 5MB each)
              </label>
              <input
                type="file"
                accept="application/pdf"
                multiple
                onChange={(e) => {
                  handleDocumentUpload('setaCertificates', e.target.files);
                  e.target.value = '';
                }}
                className="w-full text-sm"
              />
              {formData.documents.setaCertificates.length > 0 && (
                <ul className="text-xs mt-2 space-y-1">
                  {formData.documents.setaCertificates.map((file, idx) => (
                    <li
                      key={`${file.name}-${idx}`}
                      className="flex items-center justify-between bg-green-50 text-green-700 border border-green-100 rounded px-2 py-1"
                    >
                      <span className="truncate pr-2">✓ {file.name}</span>
                      <button
                        type="button"
                        onClick={() => handleDocumentRemoval('setaCertificates', idx)}
                        className="text-[11px] text-red-600 hover:text-red-700 font-medium"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Document Certification Date {formData.documents.setaCertificates.length > 0 && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="date"
                  value={formData.documentsCertificationDates.setaCertificates}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => updateCertificationDate('setaCertificates', e.target.value)}
                  required={formData.documents.setaCertificates.length > 0}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Required when uploading SETA certificates (must not be older than 10 days).
                </p>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Optional uploads must also be certified within the last 10 days.
              </p>
            </div>

            <div className="flex items-start gap-2 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <input
                type="checkbox"
                className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={formData.documentsCertificationConfirmed}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  documentsCertificationConfirmed: e.target.checked 
                })}
              />
              <p className="text-sm text-gray-700">
                I confirm that all uploaded documents are certified copies issued within the last 10 days, that they belong to me, and that the information provided is accurate. I understand that using another person’s documents is illegal and may result in legal action.
              </p>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-4">Review Your Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Name:</span> {formData.firstName} {formData.lastName}
                </div>
                <div>
                  <span className="font-medium text-gray-700">Email:</span> {formData.email}
                </div>
                <div>
                  <span className="font-medium text-gray-700">Roles:</span> {
                    formData.roles.length > 0 
                      ? formData.roles.map(r => r === 'Other' ? formData.otherRole || 'Other' : r).join(', ')
                      : 'None selected'
                  }
                </div>
                <div>
                  <span className="font-medium text-gray-700">Experience:</span> {formData.experience}
                </div>
                <div>
                  <span className="font-medium text-gray-700">Location:</span>{' '}
                  {formData.locations.length > 0 ? formData.locations.map(loc =>
                    loc === NATIONAL_LOCATION ? 'National (Willing to travel anywhere)' : loc
                  ).join(', ') : 'Not specified'}
                </div>
                <div>
                  <span className="font-medium text-gray-700">Document Certification Dates:</span>
                  <div className="text-sm text-gray-700 mt-1 space-y-1">
                    <p>
                      • ID Documents:{' '}
                      {formatCertificationDateForDisplay(formData.documentsCertificationDates.idDocuments) || 'Not provided'}
                    </p>
                    <p>
                      • Qualification Certificates:{' '}
                      {formatCertificationDateForDisplay(formData.documentsCertificationDates.qualificationCerts) || 'Not provided'}
                    </p>
                    <p>
                      • SETA Certificates:{' '}
                      {formatCertificationDateForDisplay(formData.documentsCertificationDates.setaCertificates) || 'Not provided'}
                    </p>
                  </div>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Specializations:</span> {formData.specializations.join(', ') || 'None'}
                </div>
                <div>
                  <span className="font-medium text-gray-700">Sectors:</span> {formData.sectors.join(', ') || 'None'}
                </div>
                <div className="md:col-span-2">
                  <span className="font-medium text-gray-700">Qualifications:</span>
                  <div className="mt-1 space-y-1">
                    {formData.qualifications.length > 0 ? (
                      formData.qualifications.map((qual, idx) => {
                        if (qual === 'Other') {
                          return (
                            <div key={idx} className="text-sm text-gray-700 pl-4">
                              • {formData.otherQualification || 'Other (not specified)'}
                            </div>
                          );
                        } else {
                          const spec = formData.qualificationSpecs[qual] || '';
                          return (
                            <div key={idx} className="text-sm text-gray-700 pl-4">
                              • {qual}{spec ? ` - ${spec}` : ' (not specified)'}
                            </div>
                          );
                        }
                      })
                    ) : (
                      <span className="text-sm text-gray-500">None selected</span>
                    )}
                  </div>
                </div>
                {formData.otherSpecialization && (
                  <div>
                    <span className="font-medium text-gray-700">Other Specialization:</span> {formData.otherSpecialization}
                  </div>
                )}
                {formData.otherSector && (
                  <div>
                    <span className="font-medium text-gray-700">Other Sector:</span> {formData.otherSector}
                  </div>
                )}
                {formData.otherQualification && (
                  <div>
                    <span className="font-medium text-gray-700">Other Qualification:</span> {formData.otherQualification}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-green-900 mb-4">Rates Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Facilitation:</span> R{formData.facilitationRate}/day
                </div>
                <div>
                  <span className="font-medium text-gray-700">Assessment:</span> R{formData.assessmentRate}/POE
                </div>
                <div>
                  <span className="font-medium text-gray-700">Consultation:</span> R{formData.consultationRate}/hour
                </div>
                <div>
                  <span className="font-medium text-gray-700">Moderation:</span> R{formData.moderationRate}/POE
                </div>
              </div>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-purple-900 mb-4">CV Summary</h3>
              <div className="space-y-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Professional Summary:</span>
                  <p className="mt-1 text-gray-600">{formData.cv.professionalSummary || 'Not provided'}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Work Experience:</span>
                  <div className="mt-2 space-y-2">
                    {formData.cv.workExperience.length > 0 ? (
                      formData.cv.workExperience.map((exp, idx) => (
                        <div key={idx} className="pl-4 border-l-2 border-purple-300">
                          <p className="font-medium text-gray-700">{exp.position} at {exp.company}</p>
                          <p className="text-xs text-gray-600">
                            {exp.startDate} - {exp.current ? 'Present' : exp.endDate}
                          </p>
                          {exp.description && (
                            <p className="text-xs text-gray-500 mt-1">{exp.description}</p>
                          )}
                        </div>
                      ))
                    ) : (
                      <span className="text-gray-500">No work experience added</span>
                    )}
                  </div>
                </div>
                {formData.cv.languages.length > 0 && (
                  <div>
                    <span className="font-medium text-gray-700">Languages:</span>
                    <div className="mt-1 space-y-1">
                      {formData.cv.languages.map((lang, idx) => (
                        <div key={idx} className="text-sm text-gray-600 pl-4">
                          • {lang.language} ({lang.proficiency})
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <span className="font-medium text-gray-700">References:</span>
                  <div className="mt-2 space-y-2">
                    {formData.cv.references.length > 0 ? (
                      formData.cv.references.map((ref, idx) => (
                        <div key={idx} className="pl-4 border-l-2 border-purple-300">
                          <p className="font-medium text-gray-700">{ref.name}</p>
                          {ref.position && <p className="text-xs text-gray-600">{ref.position}{ref.company ? ` at ${ref.company}` : ''}</p>}
                          <p className="text-xs text-gray-500">{ref.email} | {ref.phone}</p>
                        </div>
                      ))
                    ) : (
                      <span className="text-gray-500">No references added</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-900">
                <strong>Note:</strong> By submitting, you agree to our verification process and{' '}
                <button
                  type="button"
                  onClick={() => setShowTermsModal(true)}
                  className="text-blue-600 hover:text-blue-800 underline font-medium"
                >
                  terms of service
                </button>
                . Your registration will be reviewed within 2-3 business days.
              </p>
            </div>
          </div>
        );

      case 7:
        return (
          <div className={getSectionClasses('step7')}>
            <div className="bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Choose Your Plan</h3>
              <p className="text-gray-600">Select a membership plan to complete your registration</p>
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
                    <span>Basic profile listing</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Up to 3 engagements per month</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Standard support</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Profile verification</span>
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
                  <div className="text-3xl font-bold text-gray-900">R299</div>
                  <div className="text-sm text-gray-600">per month</div>
                </div>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Featured profile listing</span>
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
                    <span>Advanced analytics</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Marketing tools</span>
                  </li>
                </ul>
                <div className="mt-6">
                  <Badge variant="success" className="w-full justify-center">Most Popular</Badge>
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
                {formData.paymentPlan === 'annual' && (
                  <div className="absolute top-4 right-4">
                    <CheckCircle className="w-6 h-6 text-purple-600" />
                  </div>
                )}
                <div className="absolute top-2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                  <Badge variant="warning" size="sm">Save 33%</Badge>
                </div>
                <div className="text-center mb-4">
                  <h4 className="text-xl font-bold text-gray-900 mb-2">Annual</h4>
                  <div className="text-3xl font-bold text-gray-900">R2,399</div>
                  <div className="text-sm text-gray-600">per year (R199/month)</div>
                </div>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Everything in Monthly</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Premium badge</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Dedicated account manager</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Custom branding</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Annual training sessions</span>
                  </li>
                </ul>
                <div className="mt-6">
                  <Badge variant="warning" className="w-full justify-center">Best Value</Badge>
                </div>
              </div>
            </div>

            {formData.paymentPlan && (
              <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200 rounded-xl p-5 text-center">
                <CheckCircle className="w-10 h-10 text-green-600 mx-auto mb-2" />
                <p className="text-sm text-green-900">
                  You selected the <strong className="capitalize">{formData.paymentPlan}</strong> plan. Complete the PayPal subscription step below so trials convert automatically when the 30 days end.
                </p>
              </div>
            )}

            {formData.paymentPlan && (
              <div
                className={`bg-white border-2 rounded-xl p-6 space-y-4 ${
                  hasFieldError('payment') ? 'border-red-400 bg-red-50/40' : 'border-gray-200'
                }`}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
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
                        ? 'Start a PayPal free-trial subscription (card required) so billing resumes automatically on day 31.'
                        : 'Launch PayPal checkout to activate your subscription.'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900">
                      {formData.paymentPlan === 'free'
                        ? 'R0'
                        : formData.paymentPlan === 'monthly'
                        ? 'R99'
                        : 'R999'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formData.paymentPlan === 'free'
                        ? '30-day trial'
                        : formData.paymentPlan === 'monthly'
                        ? 'Per month'
                        : 'Per year'}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-gray-500">
                  Payments are processed securely via PayPal. Even free trials require a subscription so we can auto-debit when the trial ends.
                </p>

                {paymentReceipt && paymentConfirmed ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-900">
                    <p className="font-medium">
                      <CheckCircle className="w-4 h-4 inline mr-1" />
                      Payment confirmed – reference {paymentReceipt.reference}
                    </p>
                    <p className="text-xs text-green-700 mt-1">
                      Amount: {paymentReceipt.amount}
                      {paymentReceipt.expiresAt &&
                        ` • Expires on ${new Date(paymentReceipt.expiresAt).toLocaleDateString()}`}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {formData.paymentPlan && (() => {
                      const plan = SME_PLAN_DETAILS[formData.paymentPlan as keyof typeof SME_PLAN_DETAILS];
                      // For free trials, determine post-trial amount (default to monthly)
                      // The backend will use this to set up the subscription correctly
                      const postTrialAmount = plan.billingType === 'trial' 
                        ? SME_PLAN_DETAILS.monthly.amount // Default to monthly after trial
                        : undefined;
                      
                      return (
                        <PayPalButton
                          amount={plan.amount}
                          planId={plan.paypalPlanId}
                          billingType={plan.billingType}
                          role="sme"
                          customer={{
                            name: `${formData.firstName} ${formData.lastName}`.trim(),
                            email: formData.email
                          }}
                          metadata={postTrialAmount ? { postTrialAmount } : undefined}
                          onSuccess={(subscriptionId, orderId) => {
                            setPaymentReceipt({
                              amount: plan.amount === 0 ? 'R0' : formatAmount(plan.amount),
                              reference: orderId || subscriptionId,
                              expiresAt: plan.durationDays
                                ? computeExpiryDate(plan.durationDays)
                                : undefined
                            });
                            setPaymentConfirmed(true);
                            clearFieldError('payment');
                          }}
                          onError={(error) => {
                            setError(`Payment error: ${error}`);
                            setFieldErrors((prev) => ({ ...prev, payment: error }));
                          }}
                          label={formData.paymentPlan === 'free' ? 'Start Free Trial' : 'Subscribe Now'}
                        />
                      );
                    })()}
                    <p className="text-xs text-gray-600">
                      Enter your card details directly. No PayPal account required. Trials capture your billing agreement so charges resume automatically after 30 days.
                    </p>
                  </div>
                )}
              </div>
            )}

            {!formData.paymentPlan && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-900">
                  ⚠️ Please select a plan to continue with your registration and payment.
                </p>
              </div>
            )}

            <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={formData.termsAccepted}
                onChange={(e) => setFormData({ ...formData, termsAccepted: e.target.checked })}
              />
              <div className="text-sm text-gray-700">
                <p>
                  I have read and agree to the Scholarz{' '}
                  <button
                    type="button"
                    className="text-blue-600 hover:text-blue-800 underline font-medium"
                    onClick={() => setShowTermsModal(true)}
                  >
                    Terms of Service
                  </button>
                  . I understand that all engagements, payments, and dispute resolution will be handled through the platform.
                </p>
                {!formData.termsAccepted && (
                  <p className="text-xs text-red-600 mt-2">
                    You must accept the Terms of Service before completing your registration.
                  </p>
                )}
              </div>
            </div>
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
              <h1 className="text-2xl font-bold text-gray-900">SME Registration</h1>
              <p className="text-gray-600">Join as a Subject Matter Expert</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <StepIndicator />
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle className="w-5 h-5 mt-0.5 text-red-500 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {renderStepContent()}
          
          <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 1}
            >
              Previous
            </Button>
            
            <Button
              onClick={nextStep}
              disabled={
                loading ||
                (currentStep === 7 && (!formData.termsAccepted || !formData.paymentPlan || !paymentConfirmed))
              }
            >
              {loading ? 'Creating Account...' : currentStep === 7 ? 'Complete Registration & Login' : 'Next Step'}
            </Button>
          </div>
        </div>
      </div>

      {/* Terms of Service Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-green-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">Terms of Service</h2>
                <button
                  onClick={() => setShowTermsModal(false)}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-blue-100 text-sm mt-1">Scholarz Platform Agreement</p>
            </div>

            {/* Modal Content */}
            <div className="overflow-y-auto flex-1 px-6 py-6">
              <div className="prose prose-sm max-w-none">
                <section className="mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">1. Acceptance of Terms</h3>
                  <p className="text-gray-700 leading-relaxed mb-3">
                    By registering as a Subject Matter Expert (SME) on Scholarz, you agree to be bound by these Terms of Service. 
                    If you do not agree to these terms, please do not complete the registration process.
                  </p>
                </section>

                <section className="mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">2. Verification Process</h3>
                  <p className="text-gray-700 leading-relaxed mb-3">
                    All SME registrations are subject to a verification process that includes:
                  </p>
                  <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                    <li>Review of submitted qualifications and credentials</li>
                    <li>Verification of SETA registration (where applicable)</li>
                    <li>Background and reference checks</li>
                    <li>Document authenticity verification</li>
                  </ul>
                  <p className="text-gray-700 leading-relaxed mt-3">
                    The verification process typically takes 2-3 business days. You will be notified via email once your registration is approved or if additional information is required.
                  </p>
                </section>

                <section className="mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">3. Profile and Information Accuracy</h3>
                  <p className="text-gray-700 leading-relaxed mb-3">
                    You agree to:
                  </p>
                  <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                    <li>Provide accurate, current, and complete information during registration</li>
                    <li>Maintain and update your profile information to keep it accurate</li>
                    <li>Not misrepresent your qualifications, experience, or credentials</li>
                    <li>Upload genuine and unaltered documents</li>
                  </ul>
                </section>

                <section className="mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">4. Professional Conduct</h3>
                  <p className="text-gray-700 leading-relaxed mb-3">
                    As an SME on our platform, you agree to:
                  </p>
                  <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                    <li>Maintain professional standards in all engagements</li>
                    <li>Fulfill commitments made to Skills Development Providers (SDPs)</li>
                    <li>Respond to engagement requests in a timely manner</li>
                    <li>Deliver quality services as agreed upon</li>
                    <li>Respect confidentiality and intellectual property</li>
                  </ul>
                </section>

                <section className="mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">5. Payment and Fees</h3>
                  <p className="text-gray-700 leading-relaxed mb-3">
                    Scholarz operates on a subscription model with the following terms:
                  </p>
                  <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                    <li>Free Trial: 30 days with limited features</li>
                    <li>Monthly Subscription: R299/month, billed monthly</li>
                    <li>Annual Subscription: R2,399/year, billed annually</li>
                    <li>Platform fee: 10% commission on completed engagements</li>
                    <li>All fees are non-refundable except as required by law</li>
                  </ul>
                </section>

                <section className="mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">6. Account Suspension and Termination</h3>
                  <p className="text-gray-700 leading-relaxed mb-3">
                    Scholarz reserves the right to suspend or terminate your account if:
                  </p>
                  <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                    <li>You violate these Terms of Service</li>
                    <li>You provide false or misleading information</li>
                    <li>You engage in fraudulent activities</li>
                    <li>You receive multiple negative reviews or complaints</li>
                    <li>Your credentials cannot be verified</li>
                  </ul>
                </section>

                <section className="mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">7. Intellectual Property</h3>
                  <p className="text-gray-700 leading-relaxed mb-3">
                    You retain ownership of your training materials and intellectual property. By using the platform, you grant Scholarz 
                    a license to display your profile and materials for the purpose of connecting you with SDPs.
                  </p>
                </section>

                <section className="mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">8. Payment Protection & Escrow System</h3>
                  <p className="text-gray-700 leading-relaxed mb-3">
                    Scholarz is committed to creating a secure and fair environment for both SMEs and SDPs. 
                    We operate an <strong>escrow payment system</strong> to ensure satisfaction for all parties.
                  </p>
                  
                  <h4 className="text-md font-semibold text-gray-900 mt-4 mb-2">How Our Escrow System Works:</h4>
                  <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                    <li>SDPs make payments to Scholarz escrow account when engaging an SME</li>
                    <li>Funds are held securely until the engagement is completed</li>
                    <li>SMEs deliver their services, materials, or training as agreed</li>
                    <li>SDPs review and confirm satisfaction with the work provided</li>
                    <li>Upon SDP approval, payment is released to the SME</li>
                    <li>If issues arise, our dispute resolution process is initiated</li>
                  </ul>

                  <h4 className="text-md font-semibold text-gray-900 mt-4 mb-2">Our Commitment:</h4>
                  <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                    <li><strong>Quality Assurance:</strong> We facilitate communication and verification to ensure quality services</li>
                    <li><strong>Fair Dispute Resolution:</strong> We mediate disputes between SMEs and SDPs to reach fair outcomes</li>
                    <li><strong>Payment Security:</strong> All payments are processed through our secure escrow system</li>
                    <li><strong>Satisfaction Guarantee:</strong> Payments are only released when the receiving party confirms satisfaction</li>
                    <li><strong>Platform Protection:</strong> Both parties are protected from fraud and non-payment</li>
                  </ul>

                  <h4 className="text-md font-semibold text-gray-900 mt-4 mb-2">Dispute Resolution Process:</h4>
                  <p className="text-gray-700 leading-relaxed mb-2">
                    If either party is not satisfied with the engagement:
                  </p>
                  <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                    <li>The dissatisfied party submits a dispute through the platform</li>
                    <li>Both parties provide evidence and documentation</li>
                    <li>Scholarz reviews the case within 2-3 business days</li>
                    <li>We work with both parties to reach a fair resolution</li>
                    <li>Solutions may include: revisions, partial payments, or full refunds</li>
                    <li>All decisions are made based on evidence and platform terms</li>
                  </ul>

                  <h4 className="text-md font-semibold text-gray-900 mt-4 mb-2">Payment Release Conditions:</h4>
                  <p className="text-gray-700 leading-relaxed mb-2">
                    Payments are released to SMEs when:
                  </p>
                  <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                    <li>SDP confirms satisfaction with services/materials provided</li>
                    <li>SDP approves the work within the review period</li>
                    <li>No disputes are raised within 7 days of completion</li>
                    <li>Dispute resolution (if any) is successfully concluded</li>
                  </ul>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                    <p className="text-sm text-blue-900">
                      <strong>Important:</strong> All engagements and payments must be conducted through the Scholarz platform 
                      to be covered by our escrow protection and dispute resolution services. Payments made outside the platform 
                      are not protected and violate our Terms of Service.
                    </p>
                  </div>
                </section>

                <section className="mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">9. Privacy and Data Protection</h3>
                  <p className="text-gray-700 leading-relaxed mb-3">
                    Your personal information will be handled in accordance with South African data protection laws (POPIA). 
                    We will not share your personal information with third parties without your consent, except as required by law.
                  </p>
                </section>

                <section className="mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">10. Changes to Terms</h3>
                  <p className="text-gray-700 leading-relaxed mb-3">
                    Scholarz reserves the right to modify these terms at any time. You will be notified of significant changes 
                    via email. Continued use of the platform after changes constitutes acceptance of the new terms.
                  </p>
                </section>

                <section className="mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">11. Governing Law & Dispute Resolution</h3>
                  <p className="text-gray-700 leading-relaxed mb-3">
                    These Terms of Service are governed by the laws of South Africa.
                  </p>
                  
                  <h4 className="text-md font-semibold text-gray-900 mt-4 mb-2">Platform Dispute Resolution:</h4>
                  <p className="text-gray-700 leading-relaxed mb-3">
                    To ensure fairness and efficiency, <strong>all disputes must be resolved through the Scholarz platform</strong>{' '}
                    using our internal dispute resolution process described in Section 8.
                  </p>
                  
                  <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                    <li><strong>Step 1:</strong> Submit dispute through the platform dispute system</li>
                    <li><strong>Step 2:</strong> Both parties provide evidence and documentation</li>
                    <li><strong>Step 3:</strong> Scholarz mediation team reviews the case</li>
                    <li><strong>Step 4:</strong> Fair resolution is reached based on evidence and platform terms</li>
                    <li><strong>Step 5:</strong> Decision is implemented (payment release, refund, or revision)</li>
                  </ul>

                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
                    <p className="text-sm text-green-900">
                      <strong>Our Commitment to Fairness:</strong> By resolving all disputes within the platform, we ensure faster, 
                      more cost-effective, and fairer outcomes for both parties. Our mediation team has expertise in skills development 
                      engagements and can make informed decisions quickly. All parties agree to abide by the platform's dispute 
                      resolution decisions.
                    </p>
                  </div>
                </section>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                  <p className="text-sm text-blue-900">
                    <strong>Last Updated:</strong> January 2025
                  </p>
                  <p className="text-sm text-blue-900 mt-2">
                    By clicking "I Accept" or completing your registration, you acknowledge that you have read, understood, 
                    and agree to be bound by these Terms of Service.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
              <div className="flex justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setShowTermsModal(false)}
                >
                  Close
                </Button>
                <Button
                  onClick={() => setShowTermsModal(false)}
                >
                  I Accept
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}