import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  Users, 
  Calendar, 
  Search, 
  FileText, 
  Bell,
  Plus,
  TrendingUp,
  Award,
  DollarSign,
  Clock,
  Briefcase,
  Star,
  MapPin,
  Edit,
  Settings,
  Download,
  MessageSquare,
  Filter,
  Shield,
  FolderOpen,
  BarChart3,
  Upload,
  Eye,
  Send,
  CheckCircle,
  XCircle,
  AlertCircle,
  CreditCard,
  ArrowRight,
  ShoppingBag,
  Package,
  BookOpen,
  GraduationCap,
  ShoppingCart,
  Tag,
  Image,
  X,
  FileUp,
  CheckSquare,
  Trash2,
  FileSignature,
  PlayCircle,
  HelpCircle,
  ExternalLink,
  BookMarked,
  Target,
  Search as SearchIcon,
  Info
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { SDP, Engagement, SME, Project, ProjectApplication } from '../../types';
import { ProjectProgressModal } from './ProjectProgressModal';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc, 
  getDoc,
  getDocs,
  deleteDoc,
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, listAll, getMetadata } from 'firebase/storage';
import { db, storage, isFirebaseConfigured, isStorageConfigured } from '../../firebase/config';
import { createNotification } from '../../utils/notifications';

const formatDisplayDate = (value?: string | Date) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
};

const calculateRenewalDateLabel = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  date.setMonth(date.getMonth() + 3);
  return formatDisplayDate(date);
};

const formatDateRange = (start: Date, end?: Date) => {
  const endDate = end || start;
  return `${start.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })} - ${endDate.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })}`;
};

const currencyFormatter = new Intl.NumberFormat('en-ZA', {
  style: 'currency',
  currency: 'ZAR',
  minimumFractionDigits: 2
});

const formatCurrency = (value: number) => currencyFormatter.format(value);

const parseAmountValue = (value?: string | number) => {
  if (!value && value !== 0) return 0;
  if (typeof value === 'number') return value;
  const numeric = value.replace(/[^0-9.]/g, '');
  return Number(numeric) || 0;
};

const formatDateLabel = (value?: string) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
};

const toISODate = (value?: any) => {
  if (!value) return new Date().toISOString();
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (value?.seconds) return new Date(value.seconds * 1000).toISOString();
  return new Date().toISOString();
};

const maskAccountNumber = (value?: string) => {
  if (!value) return 'Not provided';
  const trimmed = value.replace(/\s+/g, '');
  if (trimmed.length <= 4) return trimmed;
  const visible = trimmed.slice(-4);
  return `•••• ${visible}`;
};

interface ReportDownloadPayload {
  title: string;
  dateRange: string;
  summary: string;
  stats: { label: string; value: string; detail?: string }[];
  footnote?: string;
}

interface InvoiceEntry {
  id: string;
  number: string;
  description: string;
  category: string;
  generatedAt: string;
  amount: number;
  status: string;
  reference?: string;
  payload: ReportDownloadPayload;
}

interface BillingProfile {
  companyName: string;
  contactEmail: string;
  phone: string;
  vatNumber: string;
  billingReference: string;
  address: string;
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  branchCode: string;
  accountType: string;
  paypalSubscriptionId?: string;
  paypalSubscriptionStatus?: string;
}

interface SDPDashboardProps {
  user: {
    profile: SDP;
    id: string;
    email: string;
    role: 'SDP';
    verified: boolean;
  };
}

type TabType = 'dashboard' | 'market' | 'find-smes' | 'engagements' | 'accreditation' | 'documents' | 'reports' | 'settings';

export function SDPDashboard({ user }: SDPDashboardProps) {
  const profilePhone = (user.profile as any)?.phone || '';
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allMarketProjects, setAllMarketProjects] = useState<Project[]>([]); // All open projects in market
  const [projectApplications, setProjectApplications] = useState<ProjectApplication[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [availableSMEs, setAvailableSMEs] = useState<SME[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [smeFilter, setSmeFilter] = useState('all');
  const [ratingModal, setRatingModal] = useState<{ open: boolean; smeId: string | null; smeName: string }>({
    open: false,
    smeId: null,
    smeName: ''
  });
  const [rating, setRating] = useState<number>(0);
  const [ratingComment, setRatingComment] = useState<string>('');
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [isSubmittingRating, setIsSubmittingRating] = useState<boolean>(false);
  const [ratingSuccess, setRatingSuccess] = useState<boolean>(false);
  const [isUpdatingExistingRating, setIsUpdatingExistingRating] = useState<boolean>(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  const [notificationSaving, setNotificationSaving] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [documents, setDocuments] = useState<Array<{
    id: string;
    name: string;
    type: string;
    size: string;
    date: string;
    url?: string;
    reviewStatus?: 'pending' | 'approved' | 'rejected';
    reviewComment?: string;
    reviewedBy?: string;
    reviewedAt?: Date;
    source?: 'registration' | 'manual';
    uploadedAt?: any;
  }>>([]);
  const [documentSearchQuery, setDocumentSearchQuery] = useState('');
  const [documentFilterStatus, setDocumentFilterStatus] = useState<string>('all');
  const [documentFilterType, setDocumentFilterType] = useState<string>('all');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [documentName, setDocumentName] = useState('');
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  
  // Accreditation tab state
  const [accreditationSearchQuery, setAccreditationSearchQuery] = useState('');
  const [accreditationCategory, setAccreditationCategory] = useState('all');
  const [showAssistanceModal, setShowAssistanceModal] = useState(false);
  const [assistanceForm, setAssistanceForm] = useState({
    qualificationName: '',
    qualificationCode: '',
    reason: '',
    timeline: '',
    additionalInfo: ''
  });
  const [qctoQualifications, setQctoQualifications] = useState<any[]>([]);
  const [loadingQualifications, setLoadingQualifications] = useState(true);
  const [showQCTOWebsite, setShowQCTOWebsite] = useState(false);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvLoading, setCsvLoading] = useState(true);
  const [showCsvUpload, setShowCsvUpload] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const defaultBillingProfile: BillingProfile = {
    companyName: user.profile.name || '',
    contactEmail: user.email,
    phone: profilePhone,
    vatNumber: '',
    billingReference: user.profile.planReference || '',
    address: user.profile.location || '',
    bankName: '',
    accountHolder: user.profile.name || '',
    accountNumber: '',
    branchCode: '',
    accountType: '',
    paypalSubscriptionId: undefined,
    paypalSubscriptionStatus: undefined
  };
  const [billingProfile, setBillingProfile] = useState<BillingProfile>(defaultBillingProfile);
  const [billingForm, setBillingForm] = useState<BillingProfile>(defaultBillingProfile);
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [billingSaving, setBillingSaving] = useState(false);
  
  // Chat and Profile Modal states
  const [showChatModal, setShowChatModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState<any>(null);
  const certificationDates = selectedSeller?.documentCertificationDates || {};
  const primaryCertificationDate =
    selectedSeller?.documentCertificationDate ||
    certificationDates.idDocuments ||
    '';
  const certificationDateLabel = primaryCertificationDate
    ? formatDisplayDate(primaryCertificationDate)
    : '';
  const certificationRenewalLabel = primaryCertificationDate
    ? calculateRenewalDateLabel(primaryCertificationDate)
    : '';
  const hasCertificationDates =
    Boolean(primaryCertificationDate) ||
    Boolean(certificationDates.qualificationCerts) ||
    Boolean(certificationDates.setaCertificates);
  const [sellerReviews, setSellerReviews] = useState<any[]>([]);
  const [chatMessage, setChatMessage] = useState('');
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  
  const planInfo = useMemo(() => {
    const planType = (user.profile.planType as 'free' | 'monthly' | 'annual') || 'free';
    const planCopy = {
      free: { label: 'Free Trial', amount: 0 },
      monthly: { label: 'Monthly', amount: 149 },
      annual: { label: 'Annual', amount: 2499 }
    };
    const statusMap: Record<string, string> = {
      trial_active: 'Trial Active',
      active: 'Active',
      pending: 'Pending',
      expired: 'Expired',
      cancelled: 'Cancelled',
      trial_expired: 'Trial Expired',
      payment_due: 'Payment Due'
    };
    const activatedAt = user.profile.planActivatedAt ? new Date(user.profile.planActivatedAt) : null;
    const expiresAt = user.profile.planExpiresAt ? new Date(user.profile.planExpiresAt) : null;
    const daysRemaining = expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86400000)) : null;
    const status = user.profile.planStatus || 'pending';
    const label = planCopy[planType].label;
    return {
      type: planType,
      label,
      amount: planCopy[planType].amount,
      status,
      statusLabel: statusMap[status] || 'Pending',
      activatedAt,
      expiresAt,
      daysRemaining,
      reference: user.profile.planReference || billingProfile.billingReference || ''
    };
  }, [
    user.profile.planType,
    user.profile.planStatus,
    user.profile.planActivatedAt,
    user.profile.planExpiresAt,
    user.profile.planReference,
    billingProfile.billingReference
  ]);

  const invoiceHistory = useMemo<InvoiceEntry[]>(() => {
    const invoices: InvoiceEntry[] = engagements.map((eng) => {
      const amount = parseAmountValue(eng.fee || '0');
      const generatedAtIso = toISODate((eng as any).endDate || (eng as any).startDate || (eng as any).createdAt);
      const generatedAt = formatDateLabel(generatedAtIso);
      const range = eng.startDate && eng.endDate
        ? formatDateRange(new Date(eng.startDate), new Date(eng.endDate))
        : formatDateRange(new Date(generatedAtIso));
      const engagementReference = (eng as any).projectId || eng.id;
      return {
        id: eng.id,
        number: eng.id.slice(-6).toUpperCase(),
        description: eng.projectName || eng.type || 'SME Engagement',
        category: 'Engagement',
        generatedAt: generatedAtIso,
        amount,
        status: eng.status || 'Pending',
        reference: engagementReference,
        payload: {
          title: `Invoice #${eng.id.slice(-6).toUpperCase()}`,
          dateRange: range,
          summary: `Invoice for ${eng.sme || 'SME'} (${eng.type || 'Service'})`,
          stats: [
            { label: 'SME', value: eng.sme || 'Not specified' },
            { label: 'Amount', value: formatCurrency(amount) },
            { label: 'Status', value: eng.status || 'Pending' },
            { label: 'Reference', value: engagementReference }
          ],
          footnote: 'Generated from Scholarz engagement billing history.'
        }
      };
    })
      .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())
      .slice(0, 5);

    if (!invoices.length) {
      invoices.push({
        id: planInfo.reference || `PLAN-${user.id.slice(-6)}`,
        number: planInfo.reference || `PLAN-${user.id.slice(-6).toUpperCase()}`,
        description: `${planInfo.label} Subscription`,
        category: 'Subscription',
        generatedAt: planInfo.activatedAt ? planInfo.activatedAt.toISOString() : new Date().toISOString(),
        amount: planInfo.amount,
        status: planInfo.statusLabel === 'Active' ? 'Paid' : 'Pending',
        reference: planInfo.reference,
        payload: {
          title: `${planInfo.label} Subscription Invoice`,
          dateRange: planInfo.activatedAt
            ? formatDateRange(planInfo.activatedAt, planInfo.expiresAt || planInfo.activatedAt)
            : formatDateRange(new Date(), new Date()),
          summary: `Invoice for the ${planInfo.label} plan on Scholarz.`,
          stats: [
            { label: 'Plan', value: planInfo.label },
            { label: 'Amount', value: formatCurrency(planInfo.amount) },
            { label: 'Status', value: planInfo.statusLabel },
            { label: 'Reference', value: planInfo.reference || 'Pending' }
          ],
        footnote: 'Subscription payments are processed securely via PayPal.'
        }
      });
    }

    return invoices;
  }, [engagements, planInfo, user.id]);
  useEffect(() => {
    let isMounted = true;
    const baseBillingProfile: BillingProfile = {
      companyName: user.profile.name || '',
      contactEmail: user.email,
      phone: profilePhone,
      vatNumber: '',
      billingReference: user.profile.planReference || '',
      address: user.profile.location || '',
      bankName: '',
      accountHolder: user.profile.name || '',
      accountNumber: '',
      branchCode: '',
      accountType: ''
    };
    setBillingProfile(baseBillingProfile);
    setBillingForm(baseBillingProfile);

    const loadSettings = async () => {
      if (!isFirebaseConfigured() || !user.id) return;
      try {
        const userDocRef = doc(db, 'users', user.id);
        const snapshot = await getDoc(userDocRef);
        if (snapshot.exists() && isMounted) {
          const data = snapshot.data() as any;
          const preferences = data.preferences || {};
          setEmailNotifications(preferences.emailNotifications ?? true);
          setSmsNotifications(preferences.smsNotifications ?? false);
          const storedBilling = data.billingProfile || {};
          const mergedBilling = { ...baseBillingProfile, ...storedBilling };
          setBillingProfile(mergedBilling);
          setBillingForm(mergedBilling);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };

    loadSettings();
    return () => {
      isMounted = false;
    };
  }, [
    user.id,
    user.email,
    user.profile.name,
    profilePhone,
    user.profile.planReference,
    user.profile.location
  ]);

  // Start Project Modal states
  const [showStartProjectModal, setShowStartProjectModal] = useState(false);
  const [selectedEngagement, setSelectedEngagement] = useState<Engagement | null>(null);
  const [projectForm, setProjectForm] = useState({
    projectName: '',
    projectType: '',
    startDate: '',
    endDate: '',
    budget: 'R2,500',
    description: '',
    deliverables: '',
    milestones: ''
  });
  
  // Create New Project states
  const [showCreateProjectPage, setShowCreateProjectPage] = useState(false);
  const [newProjectForm, setNewProjectForm] = useState({
    projectName: '',
    projectType: 'Consultation',
    startDate: '',
    endDate: '',
    budget: 'R2,500',
    description: '',
    deliverables: '',
    milestones: '',
    selectedSME: '',
    thumbnail: '' // URL to project thumbnail
  });
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  
  // Hire SME Modal states
  const [showHireSMEModal, setShowHireSMEModal] = useState(false);
  const [selectedSMEForHire, setSelectedSMEForHire] = useState<SME | null>(null);
  const [hireSMEForm, setHireSMEForm] = useState({
    projectName: '',
    projectType: 'Consultation',
    startDate: '',
    endDate: '',
    budget: 'R2,500',
    description: '',
    deliverables: '',
    milestones: '',
    thumbnail: ''
  });
  const [uploadingHireThumbnail, setUploadingHireThumbnail] = useState(false);
  
  // Edit Project states
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editProjectForm, setEditProjectForm] = useState({
    projectName: '',
    projectType: 'Consultation',
    startDate: '',
    endDate: '',
    budget: 'R2,500',
    description: '',
    deliverables: '',
    milestones: '',
    thumbnail: ''
  });
  const [uploadingEditThumbnail, setUploadingEditThumbnail] = useState(false);
  const [projectMilestones, setProjectMilestones] = useState<any[]>([]);
  const [newMilestone, setNewMilestone] = useState({ title: '', description: '', requiresDocument: false });
  
  // Project Progress Modal states
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [selectedProjectForProgress, setSelectedProjectForProgress] = useState<any>(null);
  const [stats, setStats] = useState({
    totalInvestment: 0,  // Money spent on hiring SMEs
    totalRevenue: 0,     // Money earned from selling products/services
    activeEngagements: 0,
    completedProjects: 0,
    availableSMEs: 0
  });

  // Market state (simplified - only showing projects now)
  const [marketView, setMarketView] = useState<'browse'>('browse');
  const [marketSearch, setMarketSearch] = useState('');
  const [marketCategory, setMarketCategory] = useState<string>('all');
  const [marketItems, setMarketItems] = useState<Array<{
    id: string;
    title: string;
    description: string;
    category: string;
    price: string;
    seller: string;
    sellerId?: string;
    sellerType: string;
    location: string;
    image: string;
    date: string;
    verified: boolean;
  }>>([]);
  const [wantItems, setWantItems] = useState<Array<{
    id: string;
    title: string;
    description: string;
    category: string;
    budget: string;
    buyer: string;
    buyerType: string;
    location: string;
    date: string;
  }>>([]);
  const [newItemForm, setNewItemForm] = useState({
    title: '',
    description: '',
    category: 'Course',
    price: '',
    location: user.profile.location,
    imageUrl: ''
  });
  const [newWantForm, setNewWantForm] = useState({
    title: '',
    description: '',
    category: 'Materials',
    budget: '',
    location: user.profile.location
  });

  const locations = [
    'Johannesburg, Gauteng',
    'Cape Town, Western Cape',
    'Durban, KwaZulu-Natal',
    'Pretoria, Gauteng',
    'Port Elizabeth, Eastern Cape',
    'Bloemfontein, Free State',
    'Polokwane, Limpopo',
    'Nelspruit, Mpumalanga',
    'Kimberley, Northern Cape'
  ];

  // Load SMEs from Firestore
  useEffect(() => {
    if (!isFirebaseConfigured()) {
      // Fallback to mock data if Firebase not configured
    fetch('/data/mock-data.json')
      .then(response => response.json())
      .then(data => {
          const smes = data.smes.map((sme: SME) => ({
            ...sme,
            rating: (sme.rating && sme.rating > 0) ? sme.rating : 0.0,
            reviews: sme.reviews || 0
          }));
          setAvailableSMEs(smes);
      })
      .catch(error => console.error('Error loading data:', error));
      return;
    }

    // Load SMEs from Firestore
    const smesQuery = query(
      collection(db, 'users'),
      where('role', '==', 'SME')
    );

    const unsubscribe = onSnapshot(smesQuery, (snapshot) => {
      const smesData: SME[] = [];

      snapshot.forEach((docSnap) => {
        const userData = docSnap.data();
        const profile = userData.profile || {};
        
        smesData.push({
          id: docSnap.id,
          name: profile.name || '',
          email: profile.email || userData.email || '',
          roles: profile.roles || (profile.role ? [profile.role] : []),
          specializations: profile.specializations || [],
          sectors: profile.sectors || [],
          location: profile.location || '',
          locations: profile.locations || (profile.location ? [profile.location] : []),
          experience: profile.experience || '',
          qualifications: profile.qualifications || [],
          rates: profile.rates || {},
          availability: profile.availability || 'Available',
          rating: profile.rating || 0.0,
          reviews: profile.reviews || 0,
          verified: profile.verified || false,
          profileImage: profile.profileImage || '/images/profile-1.jpg',
          aboutMe: profile.aboutMe || '',
          phone: profile.phone || (userData as any).phone || '',
          setaRegistration: profile.setaRegistration || (userData as any).setaRegistration || '',
          documentCertificationDate: profile.documentCertificationDate,
          documentsCertificationConfirmed: profile.documentsCertificationConfirmed,
          cv: profile.cv || undefined
        });
      });

      console.log('Loaded SMEs from Firebase:', smesData.map(sme => ({
        id: sme.id,
        name: sme.name,
        rating: sme.rating,
        reviews: sme.reviews
      })));

      setAvailableSMEs(smesData);
      setStats(prev => ({
        ...prev,
        availableSMEs: smesData.length
      }));
    }, (error) => {
      console.error('Error loading SMEs:', error);
    });

    return () => unsubscribe();
  }, []);

  // Load engagements from Firestore
  useEffect(() => {
    if (!user.id || !isFirebaseConfigured()) return;

    const engagementsQuery = query(
      collection(db, 'engagements'),
      where('sdpId', '==', user.id)
    );

    const unsubscribe = onSnapshot(engagementsQuery, (snapshot) => {
      const engagementsData: Engagement[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        engagementsData.push({
          id: docSnap.id,
          sme: data.sme || '',
          smeId: data.smeId || '',
          sdp: data.sdp || user.profile.name,
          sdpId: data.sdpId || user.id,
          type: data.type || '',
          status: data.status || 'Pending',
          startDate: data.startDate || '',
          endDate: data.endDate || '',
          fee: data.fee || 'R0',
          description: data.description || '',
          projectName: data.projectName,
          deliverables: data.deliverables,
          milestones: data.milestones,
          documents: data.documents,
          progressPercentage: data.progressPercentage,
          projectStartedAt: data.projectStartedAt,
          smeCompletedAt: data.smeCompletedAt,
          sdpConfirmedAt: data.sdpConfirmedAt,
          fundsReleasedAt: data.fundsReleasedAt
        });
      });

      setEngagements(engagementsData);
      
      // Calculate total investment (money spent on hiring SMEs)
      const totalInvestment = engagementsData.reduce((sum, engagement) => {
        const feeString = engagement.fee.replace(/[R,\s]/g, ''); // Remove R, commas, and spaces
        const feeNumber = parseFloat(feeString) || 0;
        return sum + feeNumber;
      }, 0);

      setStats(prev => ({
        ...prev,
        totalInvestment,
        activeEngagements: engagementsData.filter((e) => e.status === 'In Progress').length,
        completedProjects: engagementsData.filter((e) => e.status === 'Completed').length
      }));
    }, (error) => {
      console.error('Error loading engagements:', error);
    });

    return () => unsubscribe();
  }, [user.id]);

  // Load projects from Firestore (SDP's own projects)
  useEffect(() => {
    if (!user.id || !isFirebaseConfigured()) {
      console.log('⏭️ Skipping SDP projects load (Firebase not configured or no user ID)');
      return;
    }

    console.log('📋 Loading SDP\'s own projects...');

    // Try query with orderBy first
    const projectsQuery = query(
      collection(db, 'projects'),
      where('sdpId', '==', user.id),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(projectsQuery, (snapshot) => {
      const projectsData: Project[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        projectsData.push({
          id: docSnap.id,
          sdpId: data.sdpId || user.id,
          sdpName: data.sdpName || user.profile.name,
          projectName: data.projectName || '',
          projectType: data.projectType || '',
          description: data.description || '',
          deliverables: data.deliverables || '',
          milestones: data.milestones || [],
          budget: data.budget || 'R2,500',
          startDate: data.startDate || '',
          endDate: data.endDate || '',
          status: data.status || 'open',
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          applicationsCount: data.applicationsCount || 0
        });
      });

      console.log(`✅ Loaded ${projectsData.length} project(s) for SDP (user ID: ${user.id})`);
      setProjects(projectsData);
    }, (error: any) => {
      // Ignore AbortError (happens when component unmounts or listener is replaced)
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        return;
      }
      
      // If index is missing, try without orderBy
      if (error.code === 'failed-precondition') {
        console.log('ℹ️ Projects index missing. Using fallback query.');
        const fallbackQuery = query(
          collection(db, 'projects'),
          where('sdpId', '==', user.id)
        );

        const fallbackUnsubscribe = onSnapshot(fallbackQuery, (snapshot) => {
          const projectsData: Project[] = [];

          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            projectsData.push({
              id: docSnap.id,
              sdpId: data.sdpId || user.id,
              sdpName: data.sdpName || user.profile.name,
              projectName: data.projectName || '',
              projectType: data.projectType || '',
              description: data.description || '',
              deliverables: data.deliverables || '',
              milestones: data.milestones || [],
              budget: data.budget || 'R2,500',
              startDate: data.startDate || '',
              endDate: data.endDate || '',
              status: data.status || 'open',
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
              applicationsCount: data.applicationsCount || 0
            });
          });

          // Sort manually by createdAt
          projectsData.sort((a, b) => {
            const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
            const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
            return bTime - aTime; // Newest first
          });

          console.log(`✅ Loaded ${projectsData.length} project(s) for SDP (fallback, sorted manually)`);
          setProjects(projectsData);
        }, (fallbackError) => {
          // Ignore AbortError
          if (fallbackError.name === 'AbortError' || fallbackError.message?.includes('aborted')) {
            return;
          }
          console.error('❌ Error loading SDP projects (fallback also failed):', fallbackError);
          setProjects([]);
        });

        return () => fallbackUnsubscribe();
      } else {
        setProjects([]);
      }
    });

    return () => unsubscribe();
  }, [user.id]);

  // Load project applications from Firestore
  useEffect(() => {
    if (!user.id || !isFirebaseConfigured()) return;

    // Only subscribe if there are projects
    if (projects.length === 0) {
      setProjectApplications([]);
      return;
    }

    const projectIds = projects.map(p => p.id);
    
    // Query all applications and filter by projectId in memory
    // (Firestore 'in' operator has a limit of 10 items)
    const applicationsQuery = query(
      collection(db, 'projectApplications'),
      orderBy('appliedAt', 'desc')
    );

    const unsubscribe = onSnapshot(applicationsQuery, (snapshot) => {
      const applicationsData: ProjectApplication[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        // Filter to only include applications for this SDP's projects
        if (projectIds.includes(data.projectId)) {
          applicationsData.push({
            id: docSnap.id,
            projectId: data.projectId || '',
            projectName: data.projectName || '',
            smeId: data.smeId || '',
            smeName: data.smeName || '',
            smeEmail: data.smeEmail || '',
            coverLetter: data.coverLetter || '',
            cvUrl: data.cvUrl || '',
            applicationForm: data.applicationForm || {},
            status: data.status || 'pending',
            appliedAt: data.appliedAt,
            reviewedAt: data.reviewedAt,
            reviewedBy: data.reviewedBy,
            rejectionReason: data.rejectionReason
          });
        }
      });

      setProjectApplications(applicationsData);
    }, (error) => {
      console.error('Error loading project applications:', error);
    });

    return () => unsubscribe();
  }, [user.id, projects]);

  // Load market items from Firestore
  useEffect(() => {
    if (!isFirebaseConfigured()) {
      console.log('⏭️ Skipping market items load (demo mode or not authenticated)');
      return;
    }

    const marketItemsQuery = query(
      collection(db, 'marketItems'),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(marketItemsQuery, (snapshot) => {
      const items: any[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now());
        const daysAgo = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
        const dateText = daysAgo === 0 ? 'Just now' : daysAgo === 1 ? '1 day ago' : `${daysAgo} days ago`;

        items.push({
          id: docSnap.id,
          title: data.title || '',
          description: data.description || '',
          category: data.category || 'Other',
          price: data.price || 'R0',
          seller: data.sellerName || '',
          sellerId: data.sellerId || '',
          sellerType: data.sellerType || 'SME',
          location: data.location || '',
          image: data.imageUrl || '/images/collaboration.jpg',
          date: dateText,
          verified: data.verified || false
        });
      });
      setMarketItems(items);
    }, (error: any) => {
      // Ignore AbortError
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        return;
      }
      // If index is missing, try without orderBy
      if (error.code === 'failed-precondition') {
        console.log('ℹ️ Market items index missing. Using fallback query.');
        const fallbackQuery = query(
          collection(db, 'marketItems'),
          where('status', '==', 'active')
        );
        const fallbackUnsubscribe = onSnapshot(fallbackQuery, (snapshot) => {
          const items: any[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now());
            const daysAgo = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
            const dateText = daysAgo === 0 ? 'Just now' : daysAgo === 1 ? '1 day ago' : `${daysAgo} days ago`;

            items.push({
              id: docSnap.id,
              title: data.title || '',
              description: data.description || '',
              category: data.category || 'Materials',
              price: data.price || '',
              seller: data.sellerName || '',
              sellerType: data.sellerType || 'SME',
              location: data.location || '',
              image: data.imageUrl || '/images/collaboration.jpg',
              date: dateText,
              verified: data.verified || false
            });
          });
          // Sort manually by createdAt
          items.sort((a, b) => {
            const aTime = new Date(a.date).getTime();
            const bTime = new Date(b.date).getTime();
            return bTime - aTime;
          });
          setMarketItems(items);
        }, (fallbackError: any) => {
          if (fallbackError.name === 'AbortError' || fallbackError.message?.includes('aborted')) {
            return;
          }
          console.error('Error loading market items:', fallbackError);
        });
        return () => fallbackUnsubscribe();
      } else {
        console.error('Error loading market items:', error);
      }
    });

    return () => unsubscribe();
  }, []);

  // Load want items from Firestore
  useEffect(() => {
    if (!isFirebaseConfigured()) {
      return;
    }

    const wantItemsQuery = query(
      collection(db, 'wantItems'),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(wantItemsQuery, (snapshot) => {
      const items: any[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now());
        const daysAgo = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
        const dateText = daysAgo === 0 ? 'Just now' : daysAgo === 1 ? '1 day ago' : `${daysAgo} days ago`;

        items.push({
          id: docSnap.id,
          title: data.title || '',
          description: data.description || '',
          category: data.category || 'Materials',
          budget: data.budget || '',
          buyer: data.buyerName || '',
          buyerType: data.buyerType || 'SDP',
          location: data.location || '',
          date: dateText
        });
      });
      setWantItems(items);
    }, (error: any) => {
      // Ignore AbortError
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        return;
      }
      // If index is missing, try without orderBy
      if (error.code === 'failed-precondition') {
        console.log('ℹ️ Want items index missing. Using fallback query.');
        const fallbackQuery = query(
          collection(db, 'wantItems'),
          where('status', '==', 'active')
        );
        const fallbackUnsubscribe = onSnapshot(fallbackQuery, (snapshot) => {
          const items: any[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now());
            const daysAgo = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
            const dateText = daysAgo === 0 ? 'Just now' : daysAgo === 1 ? '1 day ago' : `${daysAgo} days ago`;

            items.push({
              id: docSnap.id,
              title: data.title || '',
              description: data.description || '',
              category: data.category || 'Materials',
              budget: data.budget || '',
              buyer: data.buyerName || '',
              buyerType: data.buyerType || 'SDP',
              location: data.location || '',
              date: dateText
            });
          });
          // Sort manually by createdAt
          items.sort((a, b) => {
            const aTime = new Date(a.date).getTime();
            const bTime = new Date(b.date).getTime();
            return bTime - aTime;
          });
          setWantItems(items);
        }, (fallbackError: any) => {
          if (fallbackError.name === 'AbortError' || fallbackError.message?.includes('aborted')) {
            return;
          }
          console.error('Error loading want items:', fallbackError);
        });
        return () => fallbackUnsubscribe();
      } else {
        console.error('Error loading want items:', error);
      }
    });

    return () => unsubscribe();
  }, []);

  // Load all open projects from market (for market tab)
  useEffect(() => {
    if (!isFirebaseConfigured()) {
      console.log('⏭️ Skipping market projects load (Firebase not configured)');
      return;
    }

    console.log('📋 Loading all open projects from market for SDP dashboard...');

    // Try query with orderBy first (requires index)
    const allProjectsQuery = query(
      collection(db, 'projects'),
      where('status', '==', 'open'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(allProjectsQuery, (snapshot) => {
      const projectsData: Project[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        projectsData.push({
          id: docSnap.id,
          sdpId: data.sdpId || '',
          sdpName: data.sdpName || '',
          projectName: data.projectName || '',
          projectType: data.projectType || '',
          description: data.description || '',
          deliverables: data.deliverables || '',
          milestones: data.milestones || [],
          budget: data.budget || 'R2,500',
          startDate: data.startDate || '',
          endDate: data.endDate || '',
          status: data.status || 'open',
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          applicationsCount: data.applicationsCount || 0
        });
      });

      console.log(`✅ Loaded ${projectsData.length} open project(s) in market (SDP view)`);
      setAllMarketProjects(projectsData);
    }, (error: any) => {
      // Ignore AbortError
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        return;
      }
      
      // If index is missing, try without orderBy
      if (error.code === 'failed-precondition') {
        console.log('ℹ️ Market projects index missing. Using fallback query.');
        const fallbackQuery = query(
          collection(db, 'projects'),
          where('status', '==', 'open')
        );

        const fallbackUnsubscribe = onSnapshot(fallbackQuery, (snapshot) => {
          const projectsData: Project[] = [];

          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            projectsData.push({
              id: docSnap.id,
              sdpId: data.sdpId || '',
              sdpName: data.sdpName || '',
              projectName: data.projectName || '',
              projectType: data.projectType || '',
              description: data.description || '',
              deliverables: data.deliverables || '',
              milestones: data.milestones || [],
              budget: data.budget || 'R2,500',
              startDate: data.startDate || '',
              endDate: data.endDate || '',
              status: data.status || 'open',
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
              applicationsCount: data.applicationsCount || 0
            });
          });

          // Sort manually by createdAt
          projectsData.sort((a, b) => {
            const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
            const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
            return bTime - aTime; // Newest first
          });

          console.log(`✅ Loaded ${projectsData.length} open project(s) in market (fallback, sorted manually)`);
          setAllMarketProjects(projectsData);
        }, (fallbackError: any) => {
          // Ignore AbortError
          if (fallbackError.name === 'AbortError' || fallbackError.message?.includes('aborted')) {
            return;
          }
          console.error('❌ Error loading market projects (fallback also failed):', fallbackError);
          setAllMarketProjects([]);
        });

        return () => fallbackUnsubscribe();
      } else {
        setAllMarketProjects([]);
      }
    });

    return () => unsubscribe();
  }, []);

  // Listen for edit project event from modal
  useEffect(() => {
    const handleEditProject = (event: any) => {
      const engagement = event.detail;
      console.log('Edit project event received:', engagement);
      handleOpenStartProject(engagement);
    };

    window.addEventListener('editProject', handleEditProject);
    return () => window.removeEventListener('editProject', handleEditProject);
  }, []);

  // Load sales revenue from marketplace transactions
  useEffect(() => {
    if (!user.id || !isFirebaseConfigured()) return;

    const salesQuery = query(
      collection(db, 'transactions'),
      where('sellerId', '==', user.id),
      where('status', '==', 'completed')
    );

    const unsubscribe = onSnapshot(salesQuery, (snapshot) => {
      let totalRevenue = 0;

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const amount = parseFloat(data.amount || '0');
        totalRevenue += amount;
      });

      setStats(prev => ({
        ...prev,
        totalRevenue
      }));
    }, (error) => {
      console.error('Error loading sales revenue:', error);
      // If transactions collection doesn't exist yet, it's ok
    });

    return () => unsubscribe();
  }, [user.id]);

  const handleExport = () => {
    const dataStr = JSON.stringify(engagements, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sdp-engagements-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    alert('Projects exported successfully!');
  };

  const handleHireSME = (smeId: string) => {
    const sme = availableSMEs.find(s => s.id === smeId);
    if (!sme) return;

    // Set selected SME and open modal
    setSelectedSMEForHire(sme);
    setHireSMEForm({
      projectName: '',
      projectType: 'Consultation',
      startDate: '',
      endDate: '',
      budget: 'R2,500',
      description: '',
      deliverables: '',
      milestones: '',
      thumbnail: ''
    });
    setShowHireSMEModal(true);
  };

  const handleHireThumbnailUpload = async (file: File) => {
    if (!isStorageConfigured()) {
      alert('Storage is not configured. Please contact support.');
      return;
    }

    setUploadingHireThumbnail(true);
    try {
      const storageRef = ref(storage, `project-thumbnails/${user.id}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      setHireSMEForm({ ...hireSMEForm, thumbnail: downloadURL });
    } catch (error) {
      console.error('Error uploading thumbnail:', error);
      alert('Failed to upload thumbnail. Please try again.');
    } finally {
      setUploadingHireThumbnail(false);
    }
  };

  const handleSubmitHireSME = async () => {
    if (!isFirebaseConfigured() || !selectedSMEForHire) return;

    // Validate form
    if (!hireSMEForm.projectName || !hireSMEForm.description) {
      alert('Please fill in all required fields (Project Name, Description)');
      return;
    }

    try {
      // Convert milestone text to structured milestones
      const milestonesArray = hireSMEForm.milestones
        .split('\n')
        .filter(line => line.trim())
        .map((line, index) => ({
          id: `milestone_${Date.now()}_${index}`,
          title: line.trim(),
          description: '',
          order: index + 1,
          status: 'pending',
          requiresDocument: false
        }));

      // Ensure budget defaults to R2,500 if not provided
      const budget = hireSMEForm.budget || 'R2,500';
      
      // Create project in market
      const projectData = {
        sdpId: user.id,
        sdpName: user.profile.name,
        projectName: hireSMEForm.projectName,
        projectType: hireSMEForm.projectType,
        description: hireSMEForm.description,
        deliverables: hireSMEForm.deliverables,
        milestones: milestonesArray,
        budget: budget,
        startDate: hireSMEForm.startDate,
        endDate: hireSMEForm.endDate,
        thumbnail: hireSMEForm.thumbnail || '',
        status: 'open',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        applicationsCount: 0
      };

      const docRef = await addDoc(collection(db, 'projects'), projectData);
      console.log('✅ Project created with ID:', docRef.id);

      // Create an invitation/application for the selected SME (status: 'invited')
      const invitationData = {
        projectId: docRef.id,
        projectName: hireSMEForm.projectName,
        smeId: selectedSMEForHire.id,
        smeName: selectedSMEForHire.name,
        smeEmail: selectedSMEForHire.email,
        coverLetter: '', // SME will fill this when they apply
        cvUrl: '', // SME will upload this when they apply
        applicationForm: {}, // SME will fill this when they apply
        status: 'invited', // Special status for invited applications
        invitedBy: user.id,
        invitedAt: Timestamp.now(),
        appliedAt: null // Will be set when SME actually applies
      };

      await addDoc(collection(db, 'projectApplications'), invitationData);
      console.log('✅ Invitation created for SME:', selectedSMEForHire.id);

      // Create notification for the selected SME
      await createNotification({
        userId: selectedSMEForHire.id,
        type: 'engagement',
        title: 'Project Invitation',
        message: `${user.profile.name} has invited you to apply for: "${hireSMEForm.projectName}"`,
        link: `/dashboard?tab=market`,
        metadata: { projectId: docRef.id, projectName: hireSMEForm.projectName, invitation: true }
      });

      alert(`Project "${hireSMEForm.projectName}" has been created and ${selectedSMEForHire.name} has been invited to apply!`);
      
      // Reset form and close modal
      setHireSMEForm({
        projectName: '',
        projectType: 'Consultation',
        startDate: '',
        endDate: '',
        budget: 'R2,500',
        description: '',
        deliverables: '',
        milestones: '',
        thumbnail: ''
      });
      setShowHireSMEModal(false);
      setSelectedSMEForHire(null);
      
      // Navigate to projects tab
      setActiveTab('engagements');
    } catch (error) {
      console.error('Error creating project:', error);
      alert('Failed to create project. Please try again.');
    }
  };

  const handleContactSME = async (smeId: string) => {
    const sme = availableSMEs.find(s => s.id === smeId);
    if (!sme) return;

    // Create a marketplace-like item for chat (communication only, no project)
    const chatItem = {
      id: smeId,
      seller: sme.name,
      sellerId: smeId,
      title: `Chat with ${sme.name}`,
      sellerType: 'SME',
      verified: sme.verified
    };

    // Use the existing chat handler
    handleContactSeller(chatItem);
  };

  const handleViewSMEProfile = async (smeId: string) => {
    const sme = availableSMEs.find(s => s.id === smeId);
    if (!sme) return;

    // Create a profile item for viewing with all registration data
    const profileItem = {
      id: smeId,
      seller: sme.name,
      sellerId: smeId,
      sellerType: 'SME',
      verified: sme.verified,
      location: sme.location,
      rating: sme.rating,
      reviews: sme.reviews,
      email: sme.email,
      roles: sme.roles || (sme.role ? [sme.role] : []),
      specializations: sme.specializations,
      sectors: sme.sectors,
      experience: sme.experience,
      qualifications: sme.qualifications || [],
      rates: sme.rates || {},
      phone: (sme as any).phone || '',
      setaRegistration: (sme as any).setaRegistration || '',
      aboutMe: sme.aboutMe || ''
    };

    // Use the existing profile view handler
    handleViewProfile(profileItem);
  };

  const handleOpenRatingModal = async (smeId: string) => {
    const sme = availableSMEs.find(s => s.id === smeId);
    if (sme) {
      setRatingModal({
        open: true,
        smeId: smeId,
        smeName: sme.name
      });
      setRating(0);
      setRatingComment('');
      setHoveredRating(0);
      setRatingSuccess(false);
      setIsSubmittingRating(false);
      setIsUpdatingExistingRating(false);

      // Check if user has already rated this SME and load their previous rating
      if (isFirebaseConfigured()) {
        try {
          const existingRatingQuery = query(
            collection(db, 'smeRatings'),
            where('smeId', '==', smeId),
            where('sdpId', '==', user.id)
          );
          const existingRatingSnapshot = await getDocs(existingRatingQuery);
          
          if (!existingRatingSnapshot.empty) {
            const existingRating = existingRatingSnapshot.docs[0].data();
            setRating(existingRating.rating || 0);
            setRatingComment(existingRating.comment || '');
            setIsUpdatingExistingRating(true);
            console.log('Loaded existing rating:', existingRating.rating);
          }
        } catch (error) {
          console.error('Error loading existing rating:', error);
        }
      }
    }
  };

  const handleSubmitRating = async () => {
    if (!ratingModal.smeId || !user.id || rating === 0) {
      alert('Please select a rating (1-5 stars)');
      return;
    }

    if (!isFirebaseConfigured()) {
      alert('Firebase not configured. Rating cannot be saved.');
      return;
    }

    setIsSubmittingRating(true);
    setRatingSuccess(false);

    try {
      // Check if user has already rated this SME
      const existingRatingQuery = query(
        collection(db, 'smeRatings'),
        where('smeId', '==', ratingModal.smeId),
        where('sdpId', '==', user.id)
      );
      const existingRatingSnapshot = await getDocs(existingRatingQuery);

      const ratingData = {
        smeId: ratingModal.smeId,
        sdpId: user.id,
        sdpName: user.profile.name,
        rating: rating,
        comment: ratingComment || '',
        updatedAt: Timestamp.now()
      };

      if (!existingRatingSnapshot.empty) {
        // Update existing rating
        const existingRatingDoc = existingRatingSnapshot.docs[0];
        await updateDoc(doc(db, 'smeRatings', existingRatingDoc.id), ratingData);
        console.log('Updated existing rating for SME:', ratingModal.smeId);
      } else {
        // Create new rating
        await addDoc(collection(db, 'smeRatings'), {
          ...ratingData,
          createdAt: Timestamp.now()
        });
        console.log('Created new rating for SME:', ratingModal.smeId);
      }

      // Update SME's average rating and review count
      await updateSMERating(ratingModal.smeId);

      // Create notification for SME
      await createNotification({
        userId: ratingModal.smeId,
        type: 'rating',
        title: 'New Rating Received',
        message: `${user.profile.name} gave you a ${rating} star rating${ratingComment ? ': ' + ratingComment.substring(0, 50) + (ratingComment.length > 50 ? '...' : '') : ''}`,
        link: `/dashboard?tab=profile`,
        metadata: { rating, sdpId: user.id, sdpName: user.profile.name }
      });

      // Reload SME data to reflect new rating
      await reloadSMEData(ratingModal.smeId);

      // Show success state
      setRatingSuccess(true);

      // Close modal after short delay to show success message
      setTimeout(() => {
        setRatingModal({ open: false, smeId: null, smeName: '' });
        setRating(0);
        setRatingComment('');
        setRatingSuccess(false);
        setIsSubmittingRating(false);
      }, 1500);

    } catch (error: any) {
      console.error('Error submitting rating:', error);
      alert('Error submitting rating: ' + error.message);
      setIsSubmittingRating(false);
      setRatingSuccess(false);
    }
  };

  const reloadSMEData = async (smeId: string) => {
    try {
      // Reload the specific SME data from Firestore
      const smeDocRef = doc(db, 'users', smeId);
      const smeDocSnap = await getDoc(smeDocRef);
      
      if (smeDocSnap.exists()) {
        const userData = smeDocSnap.data();
        const profile = userData.profile || {};
        
        const updatedSME: SME = {
          id: smeDocSnap.id,
          name: profile.name || '',
          email: profile.email || userData.email || '',
          roles: profile.roles || (profile.role ? [profile.role] : []),
          role: profile.role || (Array.isArray(profile.roles) ? profile.roles[0] : ''),
          specializations: profile.specializations || [],
          sectors: profile.sectors || [],
          location: profile.location || '',
          locations: profile.locations || (profile.location ? [profile.location] : []),
          experience: profile.experience || '',
          qualifications: profile.qualifications || [],
          rates: profile.rates || {},
          availability: profile.availability || 'Available',
          rating: profile.rating || 0.0,
          reviews: profile.reviews || 0,
          verified: profile.verified || false,
          profileImage: profile.profileImage || '/images/profile-1.jpg',
          aboutMe: profile.aboutMe || '',
          phone: profile.phone || userData.phone || '',
          setaRegistration: profile.setaRegistration || '',
          documentCertificationDate: profile.documentCertificationDate,
          documentsCertificationConfirmed: profile.documentsCertificationConfirmed,
          cv: profile.cv || undefined
        };

        // Update the local state
        setAvailableSMEs(prev => 
          prev.map(sme => sme.id === smeId ? updatedSME : sme)
        );

        console.log('SME data reloaded successfully:', updatedSME);
      }
    } catch (error) {
      console.error('Error reloading SME data:', error);
    }
  };

  const updateSMERating = async (smeId: string) => {
    try {
      // Get all ratings for this SME
      const ratingsQuery = query(
        collection(db, 'smeRatings'),
        where('smeId', '==', smeId)
      );
      const ratingsSnapshot = await getDocs(ratingsQuery);
      
      // Group ratings by user and find the LATEST one for each user
      const userRatingsMap = new Map<string, Array<{rating: number, updatedAt: any}>>();
      
      ratingsSnapshot.forEach((doc) => {
        const data = doc.data();
        const sdpId = data.sdpId;
        const rating = data.rating || 0;
        const updatedAt = data.updatedAt || data.createdAt || { seconds: 0 };
        
        if (!userRatingsMap.has(sdpId)) {
          userRatingsMap.set(sdpId, []);
        }
        userRatingsMap.get(sdpId)!.push({ rating, updatedAt });
      });

      // For each user, get their LATEST rating (most recent updatedAt)
      const latestRatings = new Map<string, number>();
      
      userRatingsMap.forEach((ratings, sdpId) => {
        // Sort by updatedAt timestamp (newest first)
        const sortedRatings = ratings.sort((a, b) => {
          const timeA = a.updatedAt.seconds || a.updatedAt._seconds || 0;
          const timeB = b.updatedAt.seconds || b.updatedAt._seconds || 0;
          return timeB - timeA; // Descending (newest first)
        });
        
        // Take the first one (latest)
        latestRatings.set(sdpId, sortedRatings[0].rating);
        
        if (sortedRatings.length > 1) {
          console.log(`Found ${sortedRatings.length} ratings for user ${sdpId}, using latest: ${sortedRatings[0].rating}`);
        }
      });

      // Calculate average from unique users' LATEST ratings only
      let totalRating = 0;
      latestRatings.forEach((rating) => {
        totalRating += rating;
      });

      const count = latestRatings.size; // Number of UNIQUE users who rated
      const averageRating = count > 0 ? Number((totalRating / count).toFixed(1)) : 0.0;

      console.log(`Updating SME ${smeId} rating: ${averageRating} (${count} unique users with latest ratings from ${ratingsSnapshot.size} total documents)`);

      // Update SME profile in Firestore - use the user document ID directly
      const smeDocRef = doc(db, 'users', smeId);
      const smeDocSnap = await getDoc(smeDocRef);
      
      if (smeDocSnap.exists()) {
        await updateDoc(smeDocRef, {
          'profile.rating': averageRating,
          'profile.reviews': count,
          updatedAt: Timestamp.now()
        });
        console.log('SME rating updated in Firestore');
      } else {
        console.warn('SME document not found:', smeId);
        // Fallback: search by profile ID
        const usersQuery = query(
          collection(db, 'users'),
          where('role', '==', 'SME')
        );
        const usersSnapshot = await getDocs(usersQuery);
        
        usersSnapshot.forEach((userDoc) => {
          const userData = userDoc.data();
          if (userData.profile?.id === smeId || userDoc.id === smeId) {
            updateDoc(doc(db, 'users', userDoc.id), {
              'profile.rating': averageRating,
              'profile.reviews': count,
              updatedAt: Timestamp.now()
            });
          }
        });
      }

      // Update local state if SME is in availableSMEs
      setAvailableSMEs(prevSMEs => 
        prevSMEs.map(sme => 
          sme.id === smeId 
            ? { ...sme, rating: averageRating, reviews: count }
            : sme
        )
      );
    } catch (error) {
      console.error('Error updating SME rating:', error);
    }
  };

  const handleManageEngagement = async (engagementId: string) => {
    const engagement = engagements.find(e => e.id === engagementId);
    if (!engagement || !engagement.smeId) {
      alert('Unable to open chat. SME information is missing.');
      return;
    }

    // Create a chat item for this engagement
    const chatItem = {
      id: engagement.smeId,
      seller: engagement.sme,
      sellerId: engagement.smeId,
      title: `Project with ${engagement.sme}`,
      sellerType: 'SME'
    };

    // Open chat modal using existing handler
    handleContactSeller(chatItem);
  };

  const handleOpenStartProject = (engagement: Engagement) => {
    setSelectedEngagement(engagement);
    // Use R2,500 as default budget if not set or if it's TBD
    const defaultBudget = (engagement.fee && engagement.fee !== 'TBD' && engagement.fee.trim() !== '') 
      ? engagement.fee 
      : 'R2,500';
    setProjectForm({
      projectName: '',
      projectType: engagement.type || 'Consultation',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      budget: defaultBudget,
      description: engagement.description || '',
      deliverables: '',
      milestones: ''
    });
    setShowStartProjectModal(true);
  };

  const handleSubmitProject = async () => {
    if (!selectedEngagement || !isFirebaseConfigured()) return;

    // Validate form
    if (!projectForm.projectName || !projectForm.startDate || !projectForm.description) {
      alert('Please fill in all required fields (Project Name, Start Date, Description)');
      return;
    }

    try {
      // Update engagement with project details and change status to "In Progress"
      // Ensure budget defaults to R2,500 if not provided
      const budget = projectForm.budget || 'R2,500';
      await updateDoc(doc(db, 'engagements', selectedEngagement.id), {
        type: projectForm.projectType,
        status: 'In Progress',
        startDate: projectForm.startDate,
        endDate: projectForm.endDate,
        fee: budget,
        description: projectForm.description,
        projectName: projectForm.projectName,
        deliverables: projectForm.deliverables,
        milestones: projectForm.milestones,
        projectStartedAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      alert('Project started successfully!');
      setShowStartProjectModal(false);
      setSelectedEngagement(null);
    } catch (error) {
      console.error('Error starting project:', error);
      alert('Failed to start project. Please try again.');
    }
  };

  // Handle thumbnail upload
  const handleThumbnailUpload = async (file: File) => {
    if (!isStorageConfigured()) {
      alert('File storage is not configured. Please contact support.');
      return;
    }

    setUploadingThumbnail(true);
    try {
      const fileRef = ref(storage, `project-thumbnails/${user.id}/${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      const downloadURL = await getDownloadURL(fileRef);
      setNewProjectForm({ ...newProjectForm, thumbnail: downloadURL });
      console.log('✅ Thumbnail uploaded successfully:', downloadURL);
    } catch (error: any) {
      console.error('Error uploading thumbnail:', error);
      alert('Failed to upload thumbnail: ' + error.message);
    } finally {
      setUploadingThumbnail(false);
    }
  };

  // Handle edit thumbnail upload
  const handleEditThumbnailUpload = async (file: File) => {
    if (!isStorageConfigured()) {
      alert('File storage is not configured. Please contact support.');
      return;
    }

    setUploadingEditThumbnail(true);
    try {
      const fileRef = ref(storage, `project-thumbnails/${user.id}/${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      const downloadURL = await getDownloadURL(fileRef);
      setEditProjectForm({ ...editProjectForm, thumbnail: downloadURL });
      console.log('✅ Edit thumbnail uploaded successfully:', downloadURL);
    } catch (error: any) {
      console.error('Error uploading edit thumbnail:', error);
      alert('Failed to upload thumbnail: ' + error.message);
    } finally {
      setUploadingEditThumbnail(false);
    }
  };

  // Handle update project
  const handleUpdateProject = async () => {
    if (!isFirebaseConfigured() || !editingProject) return;

    // Validate form
    if (!editProjectForm.projectName || !editProjectForm.description) {
      alert('Please fill in all required fields (Project Name, Description)');
      return;
    }

    try {
      // Convert milestone text to structured milestones
      const milestonesArray = editProjectForm.milestones
        .split('\n')
        .filter(line => line.trim())
        .map((line, index) => ({
          id: `milestone_${Date.now()}_${index}`,
          title: line.trim(),
          description: '',
          order: index + 1,
          status: 'pending',
          requiresDocument: false
        }));

      // Ensure budget defaults to R2,500 if not provided
      const budget = editProjectForm.budget || 'R2,500';
      
      // Update project in Firestore
      const projectRef = doc(db, 'projects', editingProject.id);
      await updateDoc(projectRef, {
        projectName: editProjectForm.projectName,
        projectType: editProjectForm.projectType,
        description: editProjectForm.description,
        deliverables: editProjectForm.deliverables,
        milestones: milestonesArray,
        budget: budget,
        startDate: editProjectForm.startDate,
        endDate: editProjectForm.endDate,
        thumbnail: editProjectForm.thumbnail || editingProject.thumbnail || '',
        updatedAt: Timestamp.now()
      });

      alert(`Project "${editProjectForm.projectName}" has been updated successfully!`);
      
      // Reset form and close modal
      setEditingProject(null);
      setEditProjectForm({
        projectName: '',
        projectType: 'Consultation',
        startDate: '',
        endDate: '',
        budget: 'R2,500',
        description: '',
        deliverables: '',
        milestones: '',
        thumbnail: ''
      });
    } catch (error) {
      console.error('Error updating project:', error);
      alert('Failed to update project. Please try again.');
    }
  };

  // Handle delete project
  const handleDeleteProject = async (project: Project) => {
    if (!isFirebaseConfigured()) return;

    // Confirm deletion
    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${project.projectName}"?\n\n` +
      `This action cannot be undone. All applications for this project will also be removed.`
    );

    if (!confirmDelete) return;

    try {
      // Delete all applications for this project first
      const applicationsQuery = query(
        collection(db, 'projectApplications'),
        where('projectId', '==', project.id)
      );
      const applicationsSnapshot = await getDocs(applicationsQuery);
      
      const deletePromises = applicationsSnapshot.docs.map(docSnap => 
        deleteDoc(doc(db, 'projectApplications', docSnap.id))
      );
      await Promise.all(deletePromises);

      // Delete the project
      const projectRef = doc(db, 'projects', project.id);
      await deleteDoc(projectRef);

      alert(`Project "${project.projectName}" has been deleted successfully!`);
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Failed to delete project. Please try again.');
    }
  };

  const handleCreateAndSendProject = async () => {
    if (!isFirebaseConfigured()) return;

    // Validate form - removed selectedSME requirement
    if (!newProjectForm.projectName || !newProjectForm.description) {
      alert('Please fill in all required fields (Project Name, Description)');
      return;
    }

    try {
      // Convert milestone text to structured milestones
      const milestonesArray = projectMilestones.length > 0 
        ? projectMilestones 
        : newProjectForm.milestones
            .split('\n')
            .filter(line => line.trim())
            .map((line, index) => ({
              id: `milestone_${Date.now()}_${index}`,
              title: line.trim(),
              description: '',
              order: index + 1,
              status: 'pending',
              requiresDocument: false
            }));

      // Ensure budget defaults to R2,500 if not provided
      const budget = newProjectForm.budget || 'R2,500';
      
      // Create project in market (not engagement yet)
      const projectData = {
        sdpId: user.id,
        sdpName: user.profile.name,
        projectName: newProjectForm.projectName,
        projectType: newProjectForm.projectType,
        description: newProjectForm.description,
        deliverables: newProjectForm.deliverables,
        milestones: milestonesArray,
        budget: budget,
        startDate: newProjectForm.startDate,
        endDate: newProjectForm.endDate,
        thumbnail: newProjectForm.thumbnail || '', // Project thumbnail URL
        status: 'open',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        applicationsCount: 0
      };

      const docRef = await addDoc(collection(db, 'projects'), projectData);
      console.log('✅ Project posted to market with ID:', docRef.id);
      console.log('📋 Project data:', projectData);
      console.log('🔍 Verifying project was created...');
      
      // Verify the project was created by reading it back
      try {
        const createdProject = await getDoc(doc(db, 'projects', docRef.id));
        if (createdProject.exists()) {
          console.log('✅ Project verified in database:', createdProject.data());
        } else {
          console.error('❌ Project was not found after creation!');
        }
      } catch (verifyError) {
        console.error('❌ Error verifying project:', verifyError);
      }

      alert(`Project "${newProjectForm.projectName}" has been posted to the market! SMEs can now apply.`);
      
      // Reset form and close page
      setNewProjectForm({
        projectName: '',
        projectType: 'Consultation',
        startDate: '',
        endDate: '',
        budget: 'R2,500',
        description: '',
        deliverables: '',
        milestones: '',
        selectedSME: '',
        thumbnail: ''
      });
      setProjectMilestones([]);
      setShowCreateProjectPage(false);
      
      // Navigate to projects tab
      setActiveTab('engagements');
    } catch (error) {
      console.error('Error creating project:', error);
      alert('Failed to create project. Please try again.');
    }
  };

  const handleAcceptApplication = async (application: ProjectApplication) => {
    if (!isFirebaseConfigured()) return;

    try {
      // Update application status
      const applicationRef = doc(db, 'projectApplications', application.id);
      await updateDoc(applicationRef, {
        status: 'accepted',
        reviewedAt: Timestamp.now(),
        reviewedBy: user.id
      });

      // Update project status to 'filled'
      const projectRef = doc(db, 'projects', application.projectId);
      await updateDoc(projectRef, {
        status: 'filled',
        updatedAt: Timestamp.now()
      });

      // Reject all other pending applications for this project
      const otherApplications = projectApplications.filter(
        app => app.projectId === application.projectId && 
               app.id !== application.id && 
               app.status === 'pending'
      );

      for (const otherApp of otherApplications) {
        const otherAppRef = doc(db, 'projectApplications', otherApp.id);
        await updateDoc(otherAppRef, {
          status: 'rejected',
          reviewedAt: Timestamp.now(),
          reviewedBy: user.id,
          rejectionReason: 'Another applicant was selected for this project.'
        });
      }

      // Get project details
      const project = projects.find(p => p.id === application.projectId);
      if (!project) return;

      // Create engagement from accepted application
      const engagementData = {
        smeId: application.smeId,
        sme: application.smeName,
        sdpId: user.id,
        sdp: user.profile.name,
        type: project.projectType,
        status: 'Pending',
        startDate: project.startDate,
        endDate: project.endDate,
        fee: project.budget,
        description: project.description,
        projectName: project.projectName,
        deliverables: project.deliverables,
        milestones: project.milestones,
        documents: [],
        progressPercentage: 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      const engagementRef = await addDoc(collection(db, 'engagements'), engagementData);

      // Create notification for SME
      await createNotification({
        userId: application.smeId,
        type: 'engagement',
        title: 'Application Accepted',
        message: `Your application for "${project.projectName}" has been accepted!`,
        link: `/dashboard?tab=engagements&engagement=${engagementRef.id}`,
        metadata: { engagementId: engagementRef.id, projectName: project.projectName }
      });

      alert(`Application accepted! Engagement created with ${application.smeName}.`);
    } catch (error) {
      console.error('Error accepting application:', error);
      alert('Failed to accept application. Please try again.');
    }
  };

  const handleRejectApplication = async (application: ProjectApplication, reason?: string) => {
    if (!isFirebaseConfigured()) return;

    const rejectionReason = reason || prompt('Please provide a reason for rejection (optional):') || 'Not selected for this project.';

    if (rejectionReason === null) return; // User cancelled

    try {
      const applicationRef = doc(db, 'projectApplications', application.id);
      await updateDoc(applicationRef, {
        status: 'rejected',
        reviewedAt: Timestamp.now(),
        reviewedBy: user.id,
        rejectionReason: rejectionReason
      });

      // Get project details
      const project = projects.find(p => p.id === application.projectId);
      if (project) {
        // Create notification for SME
        await createNotification({
          userId: application.smeId,
          type: 'engagement',
          title: 'Application Rejected',
          message: `Your application for "${project.projectName}" was not selected.`,
          link: `/dashboard?tab=market`,
          metadata: { projectId: application.projectId, projectName: project.projectName }
        });
      }

      alert('Application rejected.');
    } catch (error) {
      console.error('Error rejecting application:', error);
      alert('Failed to reject application. Please try again.');
    }
  };

  // Load documents from Firebase
  useEffect(() => {
    if (!user.id || !isFirebaseConfigured()) {
      // Load from localStorage if Firebase not configured
      const storageKey = `edulinker_documents_${user.id}`;
      const storedDocs = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const documentsData = storedDocs.map((doc: any) => {
        const uploadedDate = new Date(doc.uploadedAt || Date.now());
        const daysAgo = Math.floor((Date.now() - uploadedDate.getTime()) / (1000 * 60 * 60 * 24));
        const dateText = daysAgo === 0 ? 'Just now' : daysAgo === 1 ? '1 day ago' : `${daysAgo} days ago`;
        return {
          id: doc.id,
          name: doc.name || 'Document',
          type: doc.type || 'PDF',
          size: doc.size || 'Unknown',
          date: dateText,
          url: doc.url,
          reviewStatus: doc.reviewStatus || 'pending',
          reviewComment: doc.reviewComment,
          reviewedBy: doc.reviewedBy,
          reviewedAt: doc.reviewedAt,
          source: doc.source || 'manual',
          uploadedAt: doc.uploadedAt
        };
      });
      setDocuments(documentsData);
      return;
    }

    const loadDocuments = async () => {
      try {
        // Load from Firestore
        const documentsQuery = query(
          collection(db, 'users', user.id, 'documents'),
          orderBy('uploadedAt', 'desc')
        );

        const unsubscribe = onSnapshot(documentsQuery, async (snapshot) => {
          const documentsData: any[] = [];

          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const uploadedDate = data.uploadedAt?.toDate ? data.uploadedAt.toDate() : new Date(data.uploadedAt || Date.now());
            const daysAgo = Math.floor((Date.now() - uploadedDate.getTime()) / (1000 * 60 * 60 * 24));
            const dateText = daysAgo === 0 ? 'Just now' : daysAgo === 1 ? '1 day ago' : `${daysAgo} days ago`;

            documentsData.push({
              id: docSnap.id,
              name: data.name || 'Document',
              type: data.type || 'PDF',
              size: data.size || 'Unknown',
              date: dateText,
              url: data.url,
              reviewStatus: data.reviewStatus || 'pending',
              reviewComment: data.reviewComment,
              reviewedBy: data.reviewedBy,
              reviewedAt: data.reviewedAt?.toDate ? data.reviewedAt.toDate() : data.reviewedAt,
              source: data.source || 'manual',
              uploadedAt: data.uploadedAt
            });
          });

          // Also check Firebase Storage for documents uploaded during registration
          try {
            const storagePath = `users/${user.id}/documents`;
            const storageRef = ref(storage, storagePath);
            const storageList = await listAll(storageRef);

            for (const itemRef of storageList.items) {
              try {
                const downloadURL = await getDownloadURL(itemRef);
                const fileName = itemRef.name;

                // Check if this document already exists in Firestore by URL
                const existingDoc = documentsData.find(d => d.url === downloadURL);
                if (!existingDoc) {
                  // Extract document name from file path
                  const docName = fileName.replace(/^\d+_/, '').replace(/\.[^/.]+$/, '');
                  const metadata = await getMetadata(itemRef);
                  const fileSize = metadata.size ? `${(metadata.size / 1024).toFixed(0)} KB` : 'Unknown';
                  const fileType = metadata.contentType || 'application/pdf';

                  // Add to Firestore documents collection
                  await addDoc(collection(db, 'users', user.id, 'documents'), {
                    name: docName,
                    type: fileType.includes('pdf') ? 'PDF' : fileType.includes('image') ? 'Image' : 'Document',
                    size: fileSize,
                    url: downloadURL,
                    uploadedAt: metadata.timeCreated ? Timestamp.fromDate(new Date(metadata.timeCreated)) : Timestamp.now(),
                    reviewStatus: 'pending',
                    source: 'registration'
                  });
                }
              } catch (error) {
                console.error('Error processing storage file:', error);
              }
            }
          } catch (error: any) {
            // Storage path might not exist yet, which is fine
            if (error.code !== 'storage/object-not-found') {
              console.error('Error loading documents from storage:', error);
            }
          }

          setDocuments(documentsData);
        }, (error) => {
          console.error('Error loading documents:', error);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('Error setting up documents listener:', error);
      }
    };

    loadDocuments();
  }, [user.id]);

  const handleUploadDocument = () => {
    setShowUploadModal(true);
    setDocumentName('');
    setUploadingFile(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadingFile(file);
      // Auto-fill document name if empty
      if (!documentName.trim()) {
        const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        setDocumentName(fileNameWithoutExt);
      }
    }
  };

  const handleSubmitDocument = async () => {
    if (!user.id) {
      alert('User ID not found');
      return;
    }

    if (!uploadingFile) {
      alert('Please select a file to upload');
      return;
    }

    if (!documentName.trim()) {
      alert('Please enter a document name');
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (uploadingFile.size > maxSize) {
      alert(`File size exceeds maximum allowed size of 10MB. Your file is ${(uploadingFile.size / 1024 / 1024).toFixed(2)}MB`);
      return;
    }

    setUploadingDocument(true);

    // If Firebase is not configured, use localStorage fallback
    if (!isFirebaseConfigured() || !isStorageConfigured()) {
      try {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const base64Data = e.target?.result as string;
            const documentData = {
              id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              name: documentName.trim(),
              originalFileName: uploadingFile.name,
              type: uploadingFile.type || 'application/pdf',
              size: `${(uploadingFile.size / 1024).toFixed(0)} KB`,
              url: base64Data,
              uploadedAt: new Date().toISOString(),
              reviewStatus: 'pending' as const,
              uploadedBy: user.id,
              uploadedByName: user.profile.name,
              isLocalStorage: true
            };

            const storageKey = `edulinker_documents_${user.id}`;
            const existingDocs = JSON.parse(localStorage.getItem(storageKey) || '[]');
            existingDocs.push(documentData);
            localStorage.setItem(storageKey, JSON.stringify(existingDocs));

            alert(`Document "${documentName.trim()}" uploaded successfully! (Stored locally)`);
            setShowUploadModal(false);
            setDocumentName('');
            setUploadingFile(null);
            setUploadingDocument(false);
            window.location.reload();
          } catch (error: any) {
            console.error('Error saving document to localStorage:', error);
            alert('Error saving document: ' + error.message);
            setUploadingDocument(false);
          }
        };
        reader.readAsDataURL(uploadingFile);
        return;
      } catch (error: any) {
        console.error('Error in localStorage fallback:', error);
        alert('Error uploading document: ' + error.message);
        setUploadingDocument(false);
        return;
      }
    }

    // Firebase is configured - use Firebase Storage
    try {
      const fileRef = ref(storage, `users/${user.id}/documents/${Date.now()}_${uploadingFile.name}`);
      await uploadBytes(fileRef, uploadingFile);
      const downloadURL = await getDownloadURL(fileRef);

      const documentData = {
        name: documentName.trim(),
        originalFileName: uploadingFile.name,
        type: uploadingFile.type || 'application/pdf',
        size: `${(uploadingFile.size / 1024).toFixed(0)} KB`,
        url: downloadURL,
        uploadedAt: Timestamp.now(),
        reviewStatus: 'pending',
        uploadedBy: user.id,
        uploadedByName: user.profile.name,
        source: 'manual'
      };

      await addDoc(collection(db, 'users', user.id, 'documents'), documentData);
      
      // Also add to admin review queue
      await addDoc(collection(db, 'documentReviews'), {
        ...documentData,
        userId: user.id,
        userRole: user.role,
        userName: user.profile.name,
        userEmail: user.email,
        reviewStatus: 'pending'
      });

      alert(`Document "${documentName.trim()}" uploaded successfully! It is now pending admin review.`);
      setShowUploadModal(false);
      setDocumentName('');
      setUploadingFile(null);
      setUploadingDocument(false);
    } catch (error: any) {
      console.error('Error uploading document:', error);
      let errorMessage = 'Error uploading document: ';
      if (error.code === 'storage/unauthorized') {
        errorMessage += 'You do not have permission to upload files.';
      } else if (error.code === 'storage/canceled') {
        errorMessage += 'Upload was canceled.';
      } else {
        errorMessage += error.message || 'Unknown error occurred';
      }
      alert(errorMessage);
      setUploadingDocument(false);
    }
  };

  const handleNotificationToggle = async (channel: 'email' | 'sms') => {
    const nextEmail = channel === 'email' ? !emailNotifications : emailNotifications;
    const nextSms = channel === 'sms' ? !smsNotifications : smsNotifications;
    setEmailNotifications(nextEmail);
    setSmsNotifications(nextSms);

    if (!isFirebaseConfigured()) {
      setNotificationStatus({
        type: 'error',
        message: 'Connect Firebase to persist notification settings.'
      });
      return;
    }

    setNotificationSaving(true);
    setNotificationStatus(null);
    try {
      const userDocRef = doc(db, 'users', user.id);
      await updateDoc(userDocRef, {
        preferences: {
          emailNotifications: nextEmail,
          smsNotifications: nextSms
        }
      });
      setNotificationStatus({ type: 'success', message: 'Preferences saved.' });
    } catch (error) {
      console.error('Error saving notification preferences:', error);
      setNotificationStatus({ type: 'error', message: 'Could not save preferences. Please retry.' });
      setEmailNotifications(channel === 'email' ? !nextEmail : nextEmail);
      setSmsNotifications(channel === 'sms' ? !nextSms : nextSms);
    } finally {
      setNotificationSaving(false);
    }
  };

  const handleOpenBillingModal = () => {
    setBillingForm(billingProfile);
    setShowBillingModal(true);
  };

  const handleBillingFieldChange = (field: keyof BillingProfile, value: string) => {
    setBillingForm((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveBillingProfile = async () => {
    if (!billingForm.companyName.trim()) {
      alert('Company / billing name is required.');
      return;
    }
    setBillingSaving(true);
    try {
      if (isFirebaseConfigured()) {
        await updateDoc(doc(db, 'users', user.id), {
          billingProfile: billingForm
        });
      }
      setBillingProfile(billingForm);
      setShowBillingModal(false);
      alert('Billing information updated.');
    } catch (error) {
      console.error('Error saving billing profile:', error);
      alert('Unable to save billing information. Please try again.');
    } finally {
      setBillingSaving(false);
    }
  };

  const openReportWindow = (report: ReportDownloadPayload, autoPrint = true) => {
    const reportWindow = window.open('', '_blank', 'width=900,height=700');
    if (!reportWindow) {
      alert('Please allow pop-ups to download reports.');
      return;
    }

    const generatedAt = new Date().toLocaleString();
    const statsRows = report.stats
      .map(
        (stat) => `
          <tr>
            <td style="padding: 8px 12px; border: 1px solid #e5e7eb; font-weight: 600;">${stat.label}</td>
            <td style="padding: 8px 12px; border: 1px solid #e5e7eb; text-align: right;">${stat.value}</td>
          </tr>`
      )
      .join('');

    reportWindow.document.write(`
      <html>
        <head>
          <title>${report.title} - Scholarz</title>
          <style>
            body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 32px; color: #111827; }
            h1 { font-size: 28px; margin-bottom: 4px; }
            h2 { font-size: 18px; margin: 24px 0 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            .text-muted { color: #6b7280; }
            .summary { background: #f9fafb; padding: 16px; border-radius: 12px; }
          </style>
        </head>
        <body>
          <h1>${report.title}</h1>
          <p class="text-muted">${report.dateRange}</p>
          <div class="summary">
            <strong>Executive Summary</strong>
            <p>${report.summary}</p>
          </div>
          <h2>Key Metrics</h2>
          <table>
            <tbody>
              ${statsRows}
            </tbody>
          </table>
          ${
            report.footnote
              ? `<p style="margin-top: 16px; font-size: 12px; color: #6b7280;">${report.footnote}</p>`
              : ''
          }
          <p style="margin-top: 32px; font-size: 12px;" class="text-muted">
            Generated on ${generatedAt} • Scholarz – SDP Dashboard
          </p>
        </body>
      </html>
    `);
    reportWindow.document.close();

    if (autoPrint) {
      setTimeout(() => {
        reportWindow.focus();
        reportWindow.print();
      }, 150);
    }
  };

  const handleDownloadReport = (report: ReportDownloadPayload) => openReportWindow(report, true);
  const handlePreviewReport = (report: ReportDownloadPayload) => openReportWindow(report, false);
  const handleDownloadInvoice = (invoice: InvoiceEntry) => openReportWindow(invoice.payload, true);
  const handleDownloadInvoices = () => {
    if (!invoiceHistory.length) {
      alert('No invoices available yet.');
      return;
    }
    handleDownloadInvoice(invoiceHistory[0]);
  };

  const handleViewDocument = async (docId: string) => {
    const doc = documents.find(d => d.id === docId);
    if (!doc) {
      alert('Document not found');
      return;
    }

    if (!doc.url) {
      alert('Document URL not available.');
      return;
    }

    try {
      const docAny = doc as any;
      if (docAny.isLocalStorage && doc.url.startsWith('data:')) {
        window.open(doc.url, '_blank');
        return;
      }
      window.open(doc.url, '_blank');
    } catch (error: any) {
      console.error('Error viewing document:', error);
      alert('Error opening document: ' + error.message);
    }
  };

  const handleDownloadDocument = async (docId: string) => {
    const doc = documents.find(d => d.id === docId);
    if (!doc) {
      alert('Document not found');
      return;
    }

    if (!doc.url) {
      alert('Document URL not available.');
      return;
    }

    try {
      const docAny = doc as any;
      if (docAny.isLocalStorage && doc.url.startsWith('data:')) {
        const link = document.createElement('a');
        link.href = doc.url;
        link.download = doc.name || 'document';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }

      const response = await fetch(doc.url);
      if (!response.ok) {
        throw new Error('Failed to fetch document');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.name || 'document';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Error downloading document:', error);
      alert('Error downloading document: ' + (error.message || 'Unknown error occurred'));
    }
  };

  const handleNewEngagement = () => {
    setActiveTab('find-smes');
  };

  const tabs = [
    { id: 'dashboard' as TabType, label: 'Dashboard', icon: Building2 },
    { id: 'market' as TabType, label: 'Market', icon: ShoppingBag },
    { id: 'find-smes' as TabType, label: 'Find SMEs', icon: Search },
    { id: 'engagements' as TabType, label: 'Projects', icon: Calendar },
    { id: 'accreditation' as TabType, label: 'Accreditation', icon: Shield },
    { id: 'reports' as TabType, label: 'Reports', icon: BarChart3 },
    { id: 'settings' as TabType, label: 'Settings', icon: Settings },
  ];

  const StatCard = ({ icon, title, value, trend, trendColor = 'green' }: {
    icon: React.ReactNode;
    title: string;
    value: string | number;
    trend?: string;
    trendColor?: 'green' | 'red';
  }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-50 to-transparent rounded-full -mr-16 -mt-16 opacity-50 group-hover:opacity-75 transition-opacity"></div>
      <div className="relative">
      <div className="flex items-center justify-between mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
          {icon}
        </div>
        {trend && (
            <Badge variant={trendColor === 'green' ? 'success' : 'danger'} size="sm" className="shadow-sm">
            <TrendingUp className="w-3 h-3 mr-1" />
            {trend}
          </Badge>
        )}
      </div>
        <div className="text-3xl font-extrabold text-gray-900 mb-1">{value}</div>
        <div className="text-sm font-medium text-gray-600">{title}</div>
      </div>
    </div>
  );

  const SMECard = ({ sme }: { sme: SME }) => {
    // Debug: Log SME rating info
    console.log(`SME Card - ${sme.name}:`, {
      id: sme.id,
      rating: sme.rating,
      reviews: sme.reviews,
      rawData: sme
    });

    return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start space-x-4 mb-4">
        <img
          src={sme.profileImage}
          alt={sme.name}
          className="w-16 h-16 rounded-full object-cover border-4 border-blue-100"
        />
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <h3 className="text-lg font-semibold text-gray-900">{sme.name}</h3>
            {sme.verified && (
              <Badge variant="success" size="sm">
                <Award className="w-3 h-3 mr-1" />
                Verified
              </Badge>
            )}
          </div>
          <p className="text-gray-600 mb-2">{(sme.roles || (sme.role ? [sme.role] : [])).join(', ')}</p>
          <div className="flex items-center space-x-4 text-sm text-gray-500">
            <div className="flex items-center space-x-1">
              <Star className="w-4 h-4 text-yellow-400" />
              <span className="font-medium">{sme.rating > 0 ? sme.rating.toFixed(1) : '0.0'}</span>
              <span>({sme.reviews || 0} {sme.reviews === 1 ? 'review' : 'reviews'})</span>
            </div>
            <div className="flex items-center space-x-1">
              <Clock className="w-4 h-4" />
              <span className={`font-medium ${
                sme.availability === 'Available' ? 'text-green-600' :
                sme.availability === 'Busy' ? 'text-yellow-600' : 
                sme.availability === 'Offline' ? 'text-gray-600' : 'text-orange-600'
              }`}>
                {sme.availability}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            size="sm"
            onClick={() => handleHireSME(sme.id)}
            className="bg-green-600 hover:bg-green-700 hover:shadow-lg transition-shadow"
          >
            <Briefcase className="w-4 h-4 mr-1" />
            Hire SME
          </Button>
          <Button 
            size="sm"
            variant="outline"
            onClick={() => handleContactSME(sme.id)}
            className="hover:shadow-lg transition-shadow"
          >
            <MessageSquare className="w-4 h-4 mr-1" />
            Contact
          </Button>
        </div>
      </div>

      {/* Specializations */}
      <div className="mb-4">
        <p className="text-sm font-medium text-gray-700 mb-2">Specializations:</p>
        <div className="flex flex-wrap gap-2">
          {sme.specializations.slice(0, 3).map((spec, idx) => (
            <Badge key={idx} variant="info" size="sm">{spec}</Badge>
          ))}
        </div>
      </div>

      {/* Sectors */}
      <div className="mb-4">
        <p className="text-sm font-medium text-gray-700 mb-2">Sectors:</p>
        <div className="flex flex-wrap gap-2">
          {sme.sectors.slice(0, 3).map((sector, idx) => (
            <Badge key={idx} variant="default" size="sm">{sector}</Badge>
          ))}
        </div>
      </div>

      {/* Standard Project Fee */}
      <div className="p-4 bg-blue-50 rounded-lg">
        <div className="flex items-center justify-center space-x-2">
          <DollarSign className="w-5 h-5 text-blue-600" />
          <div className="text-center">
            <div className="text-xs text-gray-600 mb-1">Standard Project Fee</div>
            <div className="text-lg font-bold text-blue-600">R2,500</div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center space-x-1 text-sm text-gray-500">
          <MapPin className="w-4 h-4" />
          <span>{sme.location}</span>
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => handleOpenRatingModal(sme.id)}
            className="hover:bg-yellow-50 hover:border-yellow-300 hover:text-yellow-600 transition-colors"
          >
            <Star className="w-4 h-4 mr-1" />
            Rate SME
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => handleViewSMEProfile(sme.id)}
            className="hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors"
          >
            <Eye className="w-4 h-4 mr-1" />
            View Profile
        </Button>
        </div>
      </div>
    </div>
  );
  };

  const EngagementCard = ({ engagement }: { engagement: Engagement }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {engagement.type}
          </h3>
          <p className="text-gray-600 mb-2">SME: {engagement.sme}</p>
          <p className="text-sm text-gray-500">{engagement.description}</p>
        </div>
        <Badge 
          variant={
            engagement.status === 'Completed' ? 'success' :
            engagement.status === 'In Progress' ? 'info' :
            engagement.status === 'Disputed' ? 'danger' :
            engagement.status === 'Pending' ? 'warning' : 'default'
          }
        >
          {engagement.status}
        </Badge>
      </div>
      
      <div className="flex items-center justify-between text-sm text-gray-600">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1">
            <Calendar className="w-4 h-4" />
            <span>{engagement.startDate} - {engagement.endDate}</span>
          </div>
          <div className="flex items-center space-x-1">
            <DollarSign className="w-4 h-4" />
            <span>{engagement.fee}</span>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {engagement.status === 'Pending' && (
            <Button 
              size="sm" 
              onClick={() => handleOpenStartProject(engagement)}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              <Edit className="w-4 h-4 mr-1" />
              Edit Project
            </Button>
          )}
          {(engagement.status === 'In Progress' || engagement.status === 'Awaiting SDP Confirmation' || engagement.status === 'Disputed') && (
            <Button 
              size="sm" 
              onClick={() => {
                setSelectedProjectForProgress(engagement);
                setShowProgressModal(true);
              }}
              className={engagement.status === 'Disputed' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-purple-600 hover:bg-purple-700 text-white'}
            >
              <Eye className="w-4 h-4 mr-1" />
              View Project
            </Button>
          )}
          {engagement.status === 'Completed' && (
            <>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => {
                  setSelectedProjectForProgress(engagement);
                  setShowProgressModal(true);
                }}
                className="hover:bg-purple-50 hover:border-purple-300 hover:text-purple-600 transition-colors"
              >
                <BarChart3 className="w-4 h-4 mr-1" />
                View Details
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => {
                  const sme = availableSMEs.find(s => s.name === engagement.sme);
                  if (sme) {
                    handleOpenRatingModal(sme.id);
                  }
                }}
                className="hover:bg-yellow-50 hover:border-yellow-300 hover:text-yellow-600 transition-colors"
              >
                <Star className="w-4 h-4 mr-1" />
                Rate SME
              </Button>
            </>
          )}
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => handleManageEngagement(engagement.id)}
            className="hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors"
          >
            <MessageSquare className="w-4 h-4 mr-1" />
            Message
        </Button>
        </div>
      </div>
    </div>
  );

  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Enhanced Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Investment Card */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-lg hover:shadow-xl transition-all p-6 text-white group hover:scale-105">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
              <DollarSign className="w-6 h-6" />
            </div>
            {stats.activeEngagements > 0 && (
              <div className="flex items-center space-x-1 bg-white/20 backdrop-blur-sm rounded-full px-2 py-1">
                <TrendingUp className="w-3 h-3" />
                <span className="text-xs font-semibold">+{stats.activeEngagements}</span>
              </div>
            )}
          </div>
          <p className="text-purple-100 text-sm mb-1">Total Investment</p>
          <p className="text-3xl font-bold">R{stats.totalInvestment.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
        </div>

        {/* Revenue Card */}
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl shadow-lg hover:shadow-xl transition-all p-6 text-white group hover:scale-105">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
              <TrendingUp className="w-6 h-6" />
            </div>
            {stats.totalRevenue > 0 && (
              <div className="flex items-center space-x-1 bg-white/20 backdrop-blur-sm rounded-full px-2 py-1">
                <ArrowRight className="w-3 h-3" />
                <span className="text-xs font-semibold">Sales</span>
              </div>
            )}
          </div>
          <p className="text-emerald-100 text-sm mb-1">Sales Revenue</p>
          <p className="text-3xl font-bold">R{stats.totalRevenue.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
        </div>

        {/* Active Projects Card */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg hover:shadow-xl transition-all p-6 text-white group hover:scale-105">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
              <Calendar className="w-6 h-6" />
            </div>
            <Button 
              size="sm" 
              variant="outline" 
              className="text-xs bg-white/20 backdrop-blur-sm border-white/30 hover:bg-white/30 text-white"
              onClick={() => setActiveTab('engagements')}
            >
              View
            </Button>
          </div>
          <p className="text-blue-100 text-sm mb-1">Active Projects</p>
          <p className="text-3xl font-bold">{stats.activeEngagements}</p>
        </div>

        {/* Completed Projects Card */}
        <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-all p-6 border border-gray-200 group hover:border-blue-300">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-50 rounded-xl group-hover:bg-blue-100 transition-colors">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex items-center space-x-1 bg-blue-50 rounded-full px-2 py-1">
              <CheckCircle className="w-3 h-3 text-blue-600" />
              <span className="text-xs font-semibold text-blue-600">+12</span>
            </div>
          </div>
          <p className="text-gray-600 text-sm mb-1">Completed Projects</p>
          <p className="text-3xl font-bold text-gray-900">{stats.completedProjects}</p>
        </div>

        {/* Available SMEs Card */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl shadow-lg hover:shadow-xl transition-all p-6 text-white group hover:scale-105 cursor-pointer" onClick={() => setActiveTab('find-smes')}>
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
              <Users className="w-6 h-6" />
            </div>
            <Search className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </div>
          <p className="text-orange-100 text-sm mb-1">Available SMEs</p>
          <p className="text-3xl font-bold">{stats.availableSMEs}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Current Projects */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Current Projects</h2>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setActiveTab('engagements')}
              className="hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors"
            >
              View All
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
          
          <div className="space-y-4">
            {engagements.length > 0 ? (
              engagements.slice(0, 3).map(engagement => (
                <EngagementCard key={engagement.id} engagement={engagement} />
              ))
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No active engagements</h3>
                <p className="text-gray-600 mb-4">Start by finding and engaging qualified SMEs for your training needs.</p>
                <Button onClick={() => setActiveTab('find-smes')}>
                  <Search className="w-4 h-4 mr-2" />
                  Find SMEs
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full justify-start hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors" 
                onClick={() => setActiveTab('find-smes')}
              >
                <Plus className="w-4 h-4 mr-2" />
                Find New SME
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors"
                onClick={() => alert('Team management coming soon!')}
              >
                <Users className="w-4 h-4 mr-2" />
                Manage Team
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors" 
                onClick={() => setActiveTab('settings')}
              >
                <Building2 className="w-4 h-4 mr-2" />
                Update Profile
              </Button>
            </div>
          </div>

          {/* Recent Activities */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
            <div className="space-y-3 text-sm">
              {recentActivities.length > 0 ? (
                recentActivities.map((activity) => {
                  const getTimeAgo = (timestamp: any) => {
                    if (!timestamp) return 'Recently';
                    const now = new Date();
                    const time = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
                    const diffMs = now.getTime() - time.getTime();
                    const diffMins = Math.floor(diffMs / 60000);
                    const diffHours = Math.floor(diffMs / 3600000);
                    const diffDays = Math.floor(diffMs / 86400000);

                    if (diffMins < 1) return 'Just now';
                    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
                    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
                    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
                    return time.toLocaleDateString();
                  };

                  const colorClass = {
                    green: 'bg-green-500',
                    blue: 'bg-blue-500',
                    purple: 'bg-purple-500',
                    red: 'bg-red-500'
                  }[activity.color] || 'bg-gray-500';

                  return (
                    <div key={activity.id} className="flex items-start space-x-3">
                      <div className={`w-2 h-2 ${colorClass} rounded-full mt-2 flex-shrink-0`}></div>
                <div>
                        <p className="text-gray-900">{activity.message}</p>
                        <p className="text-gray-500">{getTimeAgo(activity.timestamp)}</p>
                </div>
              </div>
                  );
                })
              ) : (
                <div className="text-center py-4 text-gray-500">
                  <p className="text-sm">No recent activity</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderFindSMEs = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
          <h2 className="text-xl font-bold text-gray-900">Available SMEs</h2>
          <div className="flex items-center space-x-3">
              <div className="relative flex-1 md:flex-initial">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by name, specialization..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full md:w-64"
              />
            </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => alert('Filter options coming soon!')}
                className="hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors"
              >
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center space-x-2 mb-6 overflow-x-auto pb-2">
          {['all', 'Available', 'Verified', 'High Rating'].map((filter) => (
            <button
              key={filter}
              onClick={() => setSmeFilter(filter)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                smeFilter === filter
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {filter === 'all' ? 'All SMEs' : filter} ({filter === 'all' ? availableSMEs.length : availableSMEs.filter(s => {
                if (filter === 'Available') return s.availability === 'Available';
                if (filter === 'Verified') return s.verified;
                if (filter === 'High Rating') return s.rating >= 4.5;
                return true;
              }).length})
          </button>
          ))}
        </div>

        {/* SMEs Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {availableSMEs
            .filter(sme => {
              if (smeFilter === 'all') return true;
              if (smeFilter === 'Available') return sme.availability === 'Available';
              if (smeFilter === 'Verified') return sme.verified;
              if (smeFilter === 'High Rating') return sme.rating >= 4.5;
              return true;
            })
            .filter(sme => 
              sme.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              sme.specializations.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
            )
            .slice(0, 8).length > 0 ? (
            availableSMEs
              .filter(sme => {
                if (smeFilter === 'all') return true;
                if (smeFilter === 'Available') return sme.availability === 'Available';
                if (smeFilter === 'Verified') return sme.verified;
                if (smeFilter === 'High Rating') return sme.rating >= 4.5;
                return true;
              })
              .filter(sme => 
                sme.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                sme.specializations.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
              )
              .slice(0, 8).map(sme => (
              <SMECard key={sme.id} sme={sme} />
            ))
          ) : (
            <div className="col-span-2 text-center py-12 bg-gray-50 rounded-xl">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No SMEs found</h3>
              <p className="text-gray-600">Try adjusting your search or filter criteria</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderEngagements = () => {
    // Show Create Project Page if active
    if (showCreateProjectPage) {
      return (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            {/* Header */}
            <div className="border-b border-gray-200 pb-6 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Create New Project</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Fill in the project details and select an SME to send it to
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowCreateProjectPage(false)}
                >
                  <X className="w-4 h-4 mr-2" />
                Back to Projects
                </Button>
              </div>
            </div>

            {/* Form */}
            <div className="space-y-6 max-w-4xl">
              {/* Project Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newProjectForm.projectName}
                  onChange={(e) => setNewProjectForm({ ...newProjectForm, projectName: e.target.value })}
                  placeholder="e.g., Skills Development Training Program Q1 2025"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Info Message */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> This project will be posted to the market. SMEs can browse and apply to work on it. You'll be able to review applications and accept the best fit.
                </p>
              </div>

              {/* Project Type and Dates */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project Type
                  </label>
                  <select
                    value={newProjectForm.projectType}
                    onChange={(e) => setNewProjectForm({ ...newProjectForm, projectType: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Consultation">Consultation</option>
                    <option value="Training">Training</option>
                    <option value="Assessment">Assessment</option>
                    <option value="Moderation">Moderation</option>
                    <option value="Facilitation">Facilitation</option>
                    <option value="Mentorship">Mentorship</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={newProjectForm.startDate}
                    onChange={(e) => setNewProjectForm({ ...newProjectForm, startDate: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date (Est.)
                  </label>
                  <input
                    type="date"
                    value={newProjectForm.endDate}
                    onChange={(e) => setNewProjectForm({ ...newProjectForm, endDate: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Budget */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Budget
                </label>
                <input
                  type="text"
                  value={newProjectForm.budget}
                  onChange={(e) => setNewProjectForm({ ...newProjectForm, budget: e.target.value })}
                  placeholder="e.g., R 75,000"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Project Thumbnail */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Thumbnail (Optional)
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  {newProjectForm.thumbnail ? (
                    <div className="space-y-4">
                      <img 
                        src={newProjectForm.thumbnail} 
                        alt="Project thumbnail" 
                        className="max-h-48 mx-auto rounded-lg object-cover"
                      />
                      <div className="flex items-center justify-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setNewProjectForm({ ...newProjectForm, thumbnail: '' })}
                        >
                          <X className="w-4 h-4 mr-2" />
                          Remove
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.onchange = async (e: any) => {
                              const file = e.target.files[0];
                              if (file) {
                                await handleThumbnailUpload(file);
                              }
                            };
                            input.click();
                          }}
                          disabled={uploadingThumbnail}
                        >
                          {uploadingThumbnail ? 'Uploading...' : 'Change Image'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Image className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600 mb-2">Upload a thumbnail image for your project</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.onchange = async (e: any) => {
                            const file = e.target.files[0];
                            if (file) {
                              await handleThumbnailUpload(file);
                            }
                          };
                          input.click();
                        }}
                        disabled={uploadingThumbnail}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {uploadingThumbnail ? 'Uploading...' : 'Choose Image'}
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={newProjectForm.description}
                  onChange={(e) => setNewProjectForm({ ...newProjectForm, description: e.target.value })}
                  placeholder="Describe the project scope, objectives, and requirements..."
                  rows={5}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Deliverables */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expected Deliverables
                </label>
                <textarea
                  value={newProjectForm.deliverables}
                  onChange={(e) => setNewProjectForm({ ...newProjectForm, deliverables: e.target.value })}
                  placeholder="• Training materials&#10;• Assessment reports&#10;• Certificates of completion&#10;• Progress reports"
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Milestones */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Milestones & Timeline
                </label>
                <textarea
                  value={newProjectForm.milestones}
                  onChange={(e) => setNewProjectForm({ ...newProjectForm, milestones: e.target.value })}
                  placeholder="Week 1-2: Needs analysis and planning&#10;Week 3-5: Training delivery&#10;Week 6: Assessment and evaluation&#10;Week 7: Final reports and closure"
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateProjectPage(false);
                    setNewProjectForm({
                      projectName: '',
                      projectType: 'Consultation',
                      startDate: '',
                      endDate: '',
                      budget: '',
                      description: '',
                      deliverables: '',
                      milestones: '',
                      selectedSME: '',
                      thumbnail: ''
                    });
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateAndSendProject}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Post to Market
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Show normal engagements list
    return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">All Projects</h2>
          <div className="flex items-center space-x-3">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleExport}
              className="hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button 
              size="sm"
              onClick={() => setShowCreateProjectPage(true)}
              className="bg-green-600 hover:bg-green-700 text-white hover:shadow-lg transition-shadow"
            >
              <Briefcase className="w-4 h-4 mr-2" />
              Create Project
            </Button>
          </div>
        </div>

        {/* Projects and Active Engagements */}
        <div className="space-y-6">
          {/* Market Projects Section */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Market Projects</h3>
            {projects.length > 0 ? (
        <div className="space-y-4">
                {projects.map(project => {
                  const projectApps = projectApplications.filter(app => app.projectId === project.id);
                  const pendingApps = projectApps.filter(app => app.status === 'pending');
                  const acceptedApps = projectApps.filter(app => app.status === 'accepted');
                  
                  return (
                    <div key={project.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="text-lg font-semibold text-gray-900">{project.projectName}</h4>
                            <Badge variant={project.status === 'open' ? 'success' : project.status === 'filled' ? 'info' : 'default'}>
                              {project.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{project.description}</p>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span><strong>Type:</strong> {project.projectType}</span>
                            <span><strong>Budget:</strong> {project.budget}</span>
                            {project.startDate && <span><strong>Start:</strong> {new Date(project.startDate).toLocaleDateString()}</span>}
                          </div>
                        </div>
                        {project.status === 'open' && (
                          <div className="flex items-center gap-2 ml-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingProject(project);
                                setEditProjectForm({
                                  projectName: project.projectName,
                                  projectType: project.projectType,
                                  startDate: project.startDate || '',
                                  endDate: project.endDate || '',
                                  budget: project.budget || 'R2,500',
                                  description: project.description,
                                  deliverables: project.deliverables || '',
                                  milestones: Array.isArray(project.milestones) 
                                    ? project.milestones.map((m: any) => m.title || m).join('\n')
                                    : project.milestones || '',
                                  thumbnail: project.thumbnail || ''
                                });
                              }}
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteProject(project)}
                              className="border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Applications Section */}
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="font-medium text-gray-900">
                            Applications ({projectApps.length})
                            {pendingApps.length > 0 && (
                              <Badge variant="warning" className="ml-2">{pendingApps.length} pending</Badge>
                            )}
                          </h5>
                        </div>

                        {projectApps.length > 0 ? (
                          <div className="space-y-3">
                            {projectApps.map(app => (
                              <div key={app.id} className="bg-gray-50 rounded-lg p-4">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="font-medium text-gray-900">{app.smeName}</span>
                                      <Badge variant={
                                        app.status === 'accepted' ? 'success' : 
                                        app.status === 'rejected' ? 'danger' : 
                                        'warning'
                                      }>
                                        {app.status}
                                      </Badge>
                                    </div>
                                    {app.coverLetter && (
                                      <p className="text-sm text-gray-600 mb-2">{app.coverLetter}</p>
                                    )}
                                    <p className="text-xs text-gray-500">
                                      Applied: {app.appliedAt?.toDate ? app.appliedAt.toDate().toLocaleDateString() : 'N/A'}
                                    </p>
                                    {app.rejectionReason && (
                                      <p className="text-xs text-red-600 mt-1">Reason: {app.rejectionReason}</p>
                                    )}
                                  </div>
                                  {app.status === 'pending' && (
                                    <div className="flex items-center gap-2 ml-4">
                                      <Button
                                        size="sm"
                                        onClick={() => handleAcceptApplication(app)}
                                        className="bg-green-600 hover:bg-green-700"
                                      >
                                        <CheckCircle className="w-4 h-4 mr-1" />
                                        Accept
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleRejectApplication(app)}
                                        className="border-red-300 text-red-600 hover:bg-red-50"
                                      >
                                        <XCircle className="w-4 h-4 mr-1" />
                                        Reject
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">No applications yet</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <Briefcase className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">No projects posted to market yet</p>
              </div>
            )}
          </div>

          {/* Active Engagements Section */}
          {engagements.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Engagements</h3>
              <div className="space-y-4">
                {engagements.map(engagement => (
                  <EngagementCard key={engagement.id} engagement={engagement} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
  };

  // Load QCTO Qualifications from Firestore
  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setLoadingQualifications(false);
      return;
    }

    const loadQCTOQualifications = async () => {
      try {
        setLoadingQualifications(true);
        
        // Load qualifications from Firestore collection 'qctoQualifications'
        const qualificationsQuery = query(
          collection(db, 'qctoQualifications'),
          where('status', '==', 'active'),
          orderBy('name', 'asc')
        );

        const unsubscribe = onSnapshot(qualificationsQuery, (snapshot) => {
          const qualifications: any[] = [];
          
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            qualifications.push({
              id: docSnap.id,
              code: data.code || data.qualificationCode || '',
              name: data.name || data.qualificationName || '',
              level: data.level || data.nqfLevel || '',
              category: data.category || 'General',
              description: data.description || '',
              duration: data.duration || '',
              credits: data.credits || 0,
              qtcoLink: data.qtcoLink || `https://www.qcto.org.za/full---part-registered-qualifications.html`,
              saqaLink: data.saqaLink || ''
            });
          });

          // If no qualifications in Firestore, show message to visit QCTO website
          if (qualifications.length === 0) {
            console.log('No QCTO qualifications found in database. Please visit QCTO website to view all qualifications.');
          }

          setQctoQualifications(qualifications);
          setLoadingQualifications(false);
        }, (error: any) => {
          // Ignore AbortError
          if (error.name === 'AbortError' || error.message?.includes('aborted')) {
            return;
          }
          // If index is missing, try without orderBy
          if (error.code === 'failed-precondition') {
            console.log('ℹ️ QCTO qualifications index missing. Using fallback query.');
            const fallbackQuery = query(
              collection(db, 'qctoQualifications'),
              where('status', '==', 'active')
            );
            const fallbackUnsubscribe = onSnapshot(fallbackQuery, (snapshot) => {
              const qualifications: any[] = [];
              snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                qualifications.push({
                  id: docSnap.id,
                  code: data.code || '',
                  name: data.name || data.qualificationName || '',
                  level: data.level || data.nqfLevel || '',
                  category: data.category || 'General',
                  description: data.description || '',
                  duration: data.duration || '',
                  credits: data.credits || 0,
                  qtcoLink: data.qtcoLink || `https://www.qcto.org.za/full---part-registered-qualifications.html`,
                  saqaLink: data.saqaLink || ''
                });
              });
              // Sort manually by name
              qualifications.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
              setQctoQualifications(qualifications);
              setLoadingQualifications(false);
            }, (fallbackError: any) => {
              if (fallbackError.name === 'AbortError' || fallbackError.message?.includes('aborted')) {
                return;
              }
              console.error('Error loading QCTO qualifications:', fallbackError);
              setLoadingQualifications(false);
            });
            return () => fallbackUnsubscribe();
          } else {
            console.error('Error loading QCTO qualifications:', error);
            setLoadingQualifications(false);
          }
        });

        return () => unsubscribe();
      } catch (error: any) {
        console.error('Error setting up QCTO qualifications listener:', error);
        setLoadingQualifications(false);
      }
    };

    loadQCTOQualifications();
  }, []);

  // Load CSV Qualifications from public folder - Always load for all SDPs
  useEffect(() => {
    const loadCSVQualifications = async (retryCount = 0) => {
      try {
        setCsvLoading(true);
        const response = await fetch('/qcto-qualifications.csv', {
          cache: 'no-cache'
        });
        
        if (!response.ok) {
          // Retry up to 3 times if fetch fails
          if (retryCount < 3) {
            console.log(`Retrying CSV load (attempt ${retryCount + 1}/3)...`);
            setTimeout(() => loadCSVQualifications(retryCount + 1), 1000 * (retryCount + 1));
            return;
          }
          console.error('CSV file not found after retries');
          setCsvLoading(false);
          return;
        }
        
        const csvText = await response.text();
        
        if (!csvText || csvText.trim().length === 0) {
          console.error('CSV file is empty');
          setCsvLoading(false);
          return;
        }
        
        const parsed = parseCSV(csvText);
        
        if (!parsed || parsed.length === 0) {
          console.error('CSV parsing resulted in empty data');
          setCsvLoading(false);
          return;
        }
        
        // Convert CSV rows to qualification format
        const qualifications = parsed.map((row, index) => ({
          id: `csv-${index}`,
          name: row['QUALIFICATION TITLE'] || row.name || row.qualificationName || row['Qualification Name'] || row['Name'] || row['Qualification'] || '',
          code: row['SAQA Qual ID'] || row.code || row.qualificationCode || row['Qualification Code'] || row['Code'] || '',
          level: row['NQF LEVEL'] || row.level || row.nqfLevel || row['NQF Level'] || row['Level'] || row['NQF'] || '',
          category: row['QUALIFICATION TYPE'] || row['QUALITY PARTNER ']?.trim() || row['QUALITY PARTNER'] || row.category || row['Category'] || row['Sector'] || 'General',
          description: row.description || row['Description'] || row['QUALIFICATION TYPE'] || '',
          duration: row.duration || row['Duration'] || '',
          credits: row['CREDITS'] || row.credits || row['Credits'] || row['Credit'] || 0,
          qtcoLink: row.qtcoLink || row['QCTO Link'] || row['Link'] || `https://www.qcto.org.za/full---part-registered-qualifications.html`,
          saqaLink: row['SAQA LINK'] || row.saqaLink || row['SAQA Link'] || row['SAQA'] || ''
        })).filter(q => q.name && q.name.trim().length > 0); // Filter out empty rows

        if (qualifications.length > 0) {
          setCsvData(qualifications);
          setCsvLoading(false);
          console.log(`✅ Loaded ${qualifications.length} qualifications from CSV for SDP`);
        } else {
          console.warn('No valid qualifications found in CSV');
          setCsvLoading(false);
        }
      } catch (error) {
        console.error('Error loading CSV qualifications:', error);
        // Retry on error
        if (retryCount < 3) {
          console.log(`Retrying CSV load after error (attempt ${retryCount + 1}/3)...`);
          setTimeout(() => loadCSVQualifications(retryCount + 1), 2000 * (retryCount + 1));
        } else {
          setCsvLoading(false);
        }
      }
    };

    // Always load CSV qualifications for every SDP
    loadCSVQualifications();
  }, []);

  // Load Recent Activities for SDP
  useEffect(() => {
    if (!isFirebaseConfigured() || !user.id) return;

    const loadRecentActivities = async () => {
      try {
        const activities: any[] = [];

        // 1. Get recent engagements with status changes
        let engagementsSnapshot;
        try {
          const engagementsQuery = query(
            collection(db, 'engagements'),
            where('sdpId', '==', user.id),
            orderBy('updatedAt', 'desc'),
            limit(10)
          );
          engagementsSnapshot = await getDocs(engagementsQuery);
        } catch (queryError: any) {
          // Ignore AbortError
          if (queryError.name === 'AbortError' || queryError.message?.includes('aborted')) {
            return;
          }
          // If index is missing, use fallback query
          if (queryError.code === 'failed-precondition') {
            console.log('ℹ️ Recent activities index missing. Using fallback query.');
            const fallbackQuery = query(
              collection(db, 'engagements'),
              where('sdpId', '==', user.id),
              limit(10)
            );
            engagementsSnapshot = await getDocs(fallbackQuery);
          } else {
            throw queryError;
          }
        }
        engagementsSnapshot.forEach((docSnap) => {
          const engagement = docSnap.data() as any;
          const smeName = engagement.smeName || 'SME';
          
          if (engagement.status === 'Accepted') {
            activities.push({
              id: `engagement-${docSnap.id}`,
              type: 'engagement_accepted',
              message: `${smeName} accepted your engagement`,
              timestamp: engagement.updatedAt || engagement.createdAt,
              color: 'green',
              icon: 'check'
            });
          } else if (engagement.status === 'Rejected') {
            activities.push({
              id: `engagement-${docSnap.id}`,
              type: 'engagement_rejected',
              message: `${smeName} rejected your engagement`,
              timestamp: engagement.updatedAt || engagement.createdAt,
              color: 'red',
              icon: 'x'
            });
          } else if (engagement.status === 'In Progress' && engagement.projectStartedAt) {
            activities.push({
              id: `project-${docSnap.id}`,
              type: 'project_started',
              message: `Project started with ${smeName}`,
              timestamp: engagement.projectStartedAt,
              color: 'blue',
              icon: 'play'
            });
          } else if (engagement.status === 'Completed') {
            activities.push({
              id: `completed-${docSnap.id}`,
              type: 'project_completed',
              message: `Project completed with ${smeName}`,
              timestamp: engagement.completedAt || engagement.updatedAt,
              color: 'purple',
              icon: 'check-circle'
            });
          }
        });

        // 2. Get recent chat messages from SMEs
        let chatsSnapshot;
        try {
          const chatsQuery = query(
            collection(db, 'chats'),
            where('sdpId', '==', user.id),
            orderBy('lastMessageAt', 'desc'),
            limit(5)
          );
          chatsSnapshot = await getDocs(chatsQuery);
        } catch (queryError: any) {
          // Ignore AbortError
          if (queryError.name === 'AbortError' || queryError.message?.includes('aborted')) {
            chatsSnapshot = { docs: [] } as any;
          } else if (queryError.code === 'failed-precondition' || queryError.code === 'permission-denied') {
            // If index is missing or permission denied, use fallback query
            try {
              const fallbackQuery = query(
                collection(db, 'chats'),
                where('sdpId', '==', user.id),
                limit(5)
              );
              chatsSnapshot = await getDocs(fallbackQuery);
            } catch (fallbackError: any) {
              // Ignore AbortError in fallback
              if (fallbackError.name === 'AbortError' || fallbackError.message?.includes('aborted')) {
                chatsSnapshot = { docs: [] } as any;
              } else {
                // If fallback also fails, skip chats
                chatsSnapshot = { docs: [] } as any;
              }
            }
          } else {
            // Other errors, skip chats
            chatsSnapshot = { docs: [] } as any;
          }
        }
        for (const chatDoc of chatsSnapshot.docs) {
          const chat = chatDoc.data() as any;
          let messagesSnapshot;
          try {
            const messagesQuery = query(
              collection(db, 'chats', chatDoc.id, 'messages'),
              orderBy('timestamp', 'desc'),
              limit(1)
            );
            messagesSnapshot = await getDocs(messagesQuery);
          } catch (msgError: any) {
            // Ignore AbortError and permission errors for messages
            if (msgError.name === 'AbortError' || msgError.message?.includes('aborted') || msgError.code === 'permission-denied') {
              continue;
            }
            // Try fallback without orderBy
            try {
              const fallbackMsgQuery = query(
                collection(db, 'chats', chatDoc.id, 'messages'),
                limit(1)
              );
              messagesSnapshot = await getDocs(fallbackMsgQuery);
            } catch (fallbackMsgError: any) {
              if (fallbackMsgError.name === 'AbortError' || fallbackMsgError.message?.includes('aborted')) {
                continue;
              }
              continue;
            }
          }
          messagesSnapshot.forEach((msgDoc) => {
            const message = msgDoc.data() as any;
            if (message.senderId !== user.id) {
              activities.push({
                id: `message-${msgDoc.id}`,
                type: 'message',
                message: `New message from ${chat.smeName || 'SME'}`,
                timestamp: message.timestamp,
                color: 'blue',
                icon: 'message'
              });
            }
          });
        }

        // 3. Get recent document uploads in projects
        let projectsSnapshot;
        try {
          const projectsQuery = query(
            collection(db, 'engagements'),
            where('sdpId', '==', user.id),
            limit(10)
          );
          projectsSnapshot = await getDocs(projectsQuery);
        } catch (projectsError: any) {
          // Ignore AbortError and permission errors
          if (projectsError.name === 'AbortError' || projectsError.message?.includes('aborted') || projectsError.code === 'permission-denied') {
            projectsSnapshot = { docs: [] } as any;
          } else {
            projectsSnapshot = { docs: [] } as any;
          }
        }
        for (const projectDoc of projectsSnapshot.docs) {
          const engagement = projectDoc.data() as any;
          // Only check documents for in-progress or completed projects
          if ((engagement.status === 'In Progress' || engagement.status === 'Completed') && 
              engagement.documents && engagement.documents.length > 0) {
            const recentDoc = engagement.documents[engagement.documents.length - 1];
            if (recentDoc.uploadedAt) {
              activities.push({
                id: `doc-${projectDoc.id}-${recentDoc.id}`,
                type: 'document',
                message: `Document "${recentDoc.name}" uploaded for project`,
                timestamp: recentDoc.uploadedAt,
                color: 'blue',
                icon: 'file'
              });
            }
          }
        }

        // Sort by timestamp and limit to 5 most recent
        activities.sort((a, b) => {
          const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp?.getTime ? a.timestamp.getTime() : 0);
          const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp?.getTime ? b.timestamp.getTime() : 0);
          return timeB - timeA;
        });

        setRecentActivities(activities.slice(0, 5));
      } catch (error: any) {
        // Ignore AbortError
        if (error.name === 'AbortError' || error.message?.includes('aborted')) {
          return;
        }
        // If index is missing, try without orderBy
        if (error.code === 'failed-precondition') {
          console.log('ℹ️ Recent activities index missing. Using fallback query.');
          try {
            const fallbackQuery = query(
              collection(db, 'engagements'),
              where('sdpId', '==', user.id),
              limit(10)
            );
            const fallbackSnapshot = await getDocs(fallbackQuery);
            const activities: any[] = [];
            fallbackSnapshot.forEach((docSnap) => {
              const engagement = docSnap.data() as any;
              const smeName = engagement.smeName || 'SME';
              
              if (engagement.status === 'Accepted') {
                activities.push({
                  id: `engagement-${docSnap.id}`,
                  type: 'engagement_accepted',
                  message: `${smeName} accepted your engagement`,
                  timestamp: engagement.updatedAt || engagement.createdAt,
                  color: 'green',
                  icon: 'check'
                });
              } else if (engagement.status === 'Rejected') {
                activities.push({
                  id: `engagement-${docSnap.id}`,
                  type: 'engagement_rejected',
                  message: `${smeName} rejected your engagement`,
                  timestamp: engagement.updatedAt || engagement.createdAt,
                  color: 'red',
                  icon: 'x'
                });
              } else if (engagement.status === 'In Progress' && engagement.projectStartedAt) {
                activities.push({
                  id: `project-${docSnap.id}`,
                  type: 'project_started',
                  message: `Project started with ${smeName}`,
                  timestamp: engagement.projectStartedAt,
                  color: 'blue',
                  icon: 'play'
                });
              } else if (engagement.status === 'Completed') {
                activities.push({
                  id: `completed-${docSnap.id}`,
                  type: 'project_completed',
                  message: `Project completed with ${smeName}`,
                  timestamp: engagement.completedAt || engagement.updatedAt,
                  color: 'purple',
                  icon: 'check-circle'
                });
              }
            });
            // Sort manually by timestamp
            activities.sort((a, b) => {
              const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp?.getTime ? a.timestamp.getTime() : 0);
              const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp?.getTime ? b.timestamp.getTime() : 0);
              return timeB - timeA;
            });
            setRecentActivities(activities.slice(0, 5));
          } catch (fallbackError: any) {
            if (fallbackError.name !== 'AbortError' && !fallbackError.message?.includes('aborted')) {
              console.error('Error loading recent activities (fallback also failed):', fallbackError);
            }
          }
        } else {
          // Ignore AbortError
          if (error.name !== 'AbortError' && !error.message?.includes('aborted')) {
            console.error('Error loading recent activities:', error);
          }
        }
      }
    };

    loadRecentActivities();

    // Set up real-time listener for new activities
    let unsubscribe: (() => void) | null = null;
    try {
      unsubscribe = onSnapshot(
        query(
          collection(db, 'engagements'),
          where('sdpId', '==', user.id)
        ),
        () => {
          loadRecentActivities();
        },
        (error: any) => {
          // Ignore AbortError
          if (error.name === 'AbortError' || error.message?.includes('aborted')) {
            return;
          }
          console.error('Error in recent activities listener:', error);
        }
      );
    } catch (error: any) {
      // Ignore AbortError
      if (error.name !== 'AbortError' && !error.message?.includes('aborted')) {
        console.error('Error setting up recent activities listener:', error);
      }
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user.id]);

  // Extract unique categories from loaded qualifications (both CSV and Firestore)
  const accreditationCategories = React.useMemo(() => {
    const categories = new Set<string>(['all']);
    const allQualifications = csvData.length > 0 ? csvData : qctoQualifications;
    allQualifications.forEach(qual => {
      if (qual.category) {
        categories.add(qual.category);
      }
    });
    return Array.from(categories).sort();
  }, [qctoQualifications, csvData]);

  const handleRequestAssistance = async () => {
    if (!assistanceForm.qualificationName || !assistanceForm.reason) {
      alert('Please fill in the qualification name and reason for assistance.');
      return;
    }

    // Save assistance request to Firestore
    if (isFirebaseConfigured()) {
      try {
        await addDoc(collection(db, 'accreditationAssistance'), {
          sdpId: user.id,
          sdpName: user.profile.name,
          sdpEmail: user.email,
          qualificationName: assistanceForm.qualificationName,
          qualificationCode: assistanceForm.qualificationCode,
          reason: assistanceForm.reason,
          timeline: assistanceForm.timeline,
          additionalInfo: assistanceForm.additionalInfo,
          status: 'pending',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });

        alert('✅ Assistance request submitted successfully! Our team will contact you shortly.');
        setShowAssistanceModal(false);
        setAssistanceForm({
          qualificationName: '',
          qualificationCode: '',
          reason: '',
          timeline: '',
          additionalInfo: ''
        });
      } catch (error: any) {
        console.error('Error submitting assistance request:', error);
        alert(`❌ Failed to submit request: ${error.message || 'Please try again.'}`);
      }
    } else {
      alert('✅ Assistance request recorded! Our team will contact you shortly.');
      setShowAssistanceModal(false);
    }
  };

  // CSV Parsing Functions
  const parseCSV = (csvText: string): any[] => {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];

    // Parse header row
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    
    // Parse data rows
    const data: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values: string[] = [];
      let currentValue = '';
      let inQuotes = false;

      for (let j = 0; j < lines[i].length; j++) {
        const char = lines[i][j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(currentValue.trim());
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
      values.push(currentValue.trim()); // Add last value

      if (values.length === headers.length) {
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        data.push(row);
      }
    }

    return data;
  };

  const handleCsvFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCsvFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      
      // Convert CSV rows to qualification format
      const qualifications = parsed.map((row, index) => ({
        id: `csv-${index}`,
        name: row.name || row.qualificationName || row['Qualification Name'] || row['Name'] || '',
        code: row.code || row.qualificationCode || row['Qualification Code'] || row['Code'] || '',
        level: row.level || row.nqfLevel || row['NQF Level'] || row['Level'] || '',
        category: row.category || row['Category'] || 'General',
        description: row.description || row['Description'] || '',
        duration: row.duration || row['Duration'] || '',
        credits: row.credits || row['Credits'] || 0,
        qtcoLink: row.qtcoLink || row['QCTO Link'] || `https://www.qcto.org.za/full---part-registered-qualifications.html`,
        saqaLink: row.saqaLink || row['SAQA Link'] || ''
      })).filter(q => q.name); // Filter out empty rows

      setCsvData(qualifications);
      setShowCsvUpload(false);
    };
    reader.readAsText(file);
  };

  const handlePasteCsv = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    // This is handled by onKeyDown with Ctrl+Enter, but we can also trigger on paste
    setTimeout(() => {
      const textarea = event.currentTarget;
      const text = textarea.value;
      if (text && text.trim()) {
        const parsed = parseCSV(text);
        const qualifications = parsed.map((row, index) => ({
          id: `csv-${index}`,
          name: row.name || row.qualificationName || row['Qualification Name'] || row['Name'] || '',
          code: row.code || row.qualificationCode || row['Qualification Code'] || row['Code'] || '',
          level: row.level || row.nqfLevel || row['NQF Level'] || row['Level'] || '',
          category: row.category || row['Category'] || 'General',
          description: row.description || row['Description'] || '',
          duration: row.duration || row['Duration'] || '',
          credits: row.credits || row['Credits'] || 0,
          qtcoLink: row.qtcoLink || row['QCTO Link'] || `https://www.qcto.org.za/full---part-registered-qualifications.html`,
          saqaLink: row.saqaLink || row['SAQA Link'] || ''
        })).filter(q => q.name);

        if (qualifications.length > 0) {
          setCsvData(qualifications);
          setShowCsvUpload(false);
        }
      }
    }, 100);
  };

  const renderAccreditation = () => {
    // Use CSV data if available, otherwise use Firestore data
    const qualificationsToShow = csvData.length > 0 ? csvData : qctoQualifications;
    
    // Filter qualifications based on search and category
    const filteredQualifications = qualificationsToShow.filter(qual => {
      const matchesSearch = (qual.name || '').toLowerCase().includes(accreditationSearchQuery.toLowerCase()) ||
                           (qual.code || '').toLowerCase().includes(accreditationSearchQuery.toLowerCase()) ||
                           (qual.description || '').toLowerCase().includes(accreditationSearchQuery.toLowerCase());
      const matchesCategory = accreditationCategory === 'all' || (qual.category || 'General') === accreditationCategory;
      return matchesSearch && matchesCategory;
    });

    return (
    <div className="space-y-6">
        {/* Getting Accreditation Assistance Section */}
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 rounded-2xl shadow-xl p-8 text-white">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <HelpCircle className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Get Accreditation Assistance</h2>
                  <p className="text-blue-100 mt-1">We'll help you get accredited with any QCTO course</p>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 mb-4">
                <p className="text-sm mb-3 font-medium">Our accreditation assistance includes:</p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    <span>Guidance on QCTO qualification requirements</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    <span>Application process support</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    <span>Document preparation assistance</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    <span>Compliance and quality assurance</span>
                  </li>
                </ul>
              </div>
            </div>
            <div className="flex flex-col gap-3 items-stretch md:items-end">
              <Button
                onClick={() => setShowAssistanceModal(true)}
                className="bg-white text-blue-600 hover:bg-blue-50 shadow-lg hover:shadow-xl transition-all whitespace-nowrap"
                size="lg"
              >
                <Target className="w-5 h-5 mr-2" />
                Request Assistance
              </Button>
              <Button
                variant="outline"
                className="bg-white/10 text-white border-white/40 hover:bg-white/20 flex items-center justify-center gap-2"
                onClick={() => window.open('https://www.qcto.org.za/databases-of-sdps.html#', '_blank')}
              >
                <ExternalLink className="w-4 h-4" />
                Verify on QCTO Database
              </Button>
            </div>
          </div>
        </div>

        {/* Current Accreditation Status */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              <Shield className="w-6 h-6 mr-2 text-blue-600" />
              Current Accreditation Status
            </h2>
            <p className="text-sm text-gray-600 mt-1">Your SETA accreditation and verification status</p>
        </div>
        
          <div className="p-6">
            {(() => {
              const sdpProfile = user.profile as any;
              const isAccredited = sdpProfile.isAccredited === 'yes';
              const setaAccreditation = sdpProfile.setaAccreditation || '';
              const accreditationNumber = sdpProfile.accreditationNumber || '';
              const accreditationIssueDate = sdpProfile.accreditationIssueDate || '';
              const accreditationExpiryDate = sdpProfile.accreditationExpiryDate || '';
              const accountVerified = user.verified;

              return (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    {/* Primary Accreditation Status */}
                    <div className={`border-2 rounded-lg p-4 ${
                      isAccredited 
                        ? 'border-green-500 bg-green-50' 
                        : 'border-gray-300 bg-gray-50'
                    }`}>
              <div className="flex items-center justify-between mb-2">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          isAccredited ? 'bg-green-100' : 'bg-gray-100'
                        }`}>
                          {isAccredited ? (
                  <CheckCircle className="w-6 h-6 text-green-600" />
                          ) : (
                            <AlertCircle className="w-6 h-6 text-gray-600" />
                          )}
                </div>
                        <Badge 
                          variant={isAccredited ? 'success' : 'default'} 
                          size="sm"
                        >
                          {isAccredited ? 'Accredited' : 'Not Accredited'}
                        </Badge>
              </div>
              <h3 className="font-semibold text-gray-900">Primary Accreditation</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {setaAccreditation || 'No SETA specified'}
                      </p>
            </div>
            
                    {/* Account Verification Status */}
                    <div className={`border-2 rounded-lg p-4 ${
                      accountVerified 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-yellow-500 bg-yellow-50'
                    }`}>
              <div className="flex items-center justify-between mb-2">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          accountVerified ? 'bg-blue-100' : 'bg-yellow-100'
                        }`}>
                          {accountVerified ? (
                            <CheckCircle className="w-6 h-6 text-blue-600" />
                          ) : (
                  <AlertCircle className="w-6 h-6 text-yellow-600" />
                          )}
                </div>
                        <Badge 
                          variant={accountVerified ? 'success' : 'warning'} 
                          size="sm"
                        >
                          {accountVerified ? 'Verified' : 'Pending'}
                        </Badge>
              </div>
                      <h3 className="font-semibold text-gray-900">Account Verification</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {accountVerified ? 'Account Verified' : 'Under Review'}
                      </p>
            </div>
            
                    {/* SETA Alignment Status */}
                    <div className={`border-2 rounded-lg p-4 ${
                      isAccredited && setaAccreditation
                        ? 'border-purple-500 bg-purple-50' 
                        : 'border-gray-300 bg-gray-50'
                    }`}>
              <div className="flex items-center justify-between mb-2">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          isAccredited && setaAccreditation ? 'bg-purple-100' : 'bg-gray-100'
                        }`}>
                          <Shield className={`w-6 h-6 ${
                            isAccredited && setaAccreditation ? 'text-purple-600' : 'text-gray-600'
                          }`} />
                </div>
                        <Badge 
                          variant={isAccredited && setaAccreditation ? 'info' : 'default'} 
                          size="sm"
                        >
                          {isAccredited && setaAccreditation ? 'Aligned' : 'Not Set'}
                        </Badge>
              </div>
              <h3 className="font-semibold text-gray-900">SETA Alignment</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {setaAccreditation || 'No SETA alignment'}
                      </p>
            </div>
          </div>

          {/* Accreditation Details */}
                  <div className="border rounded-lg p-6 bg-gray-50">
            <h3 className="font-semibold text-gray-900 mb-4">Accreditation Details</h3>
                    {isAccredited && (accreditationNumber || setaAccreditation) ? (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {accreditationNumber && (
                          <div>
                            <span className="text-sm text-gray-600">Accreditation Number</span>
                            <p className="font-medium text-gray-900 mt-1">{accreditationNumber}</p>
              </div>
                        )}
                        {setaAccreditation && (
                          <div>
                            <span className="text-sm text-gray-600">SETA</span>
                            <p className="font-medium text-gray-900 mt-1">{setaAccreditation}</p>
              </div>
                        )}
                        {accreditationIssueDate && (
                          <div>
                            <span className="text-sm text-gray-600">Issue Date</span>
                            <p className="font-medium text-gray-900 mt-1">
                              {(() => {
                                try {
                                  const date = accreditationIssueDate?.toDate 
                                    ? accreditationIssueDate.toDate() 
                                    : new Date(accreditationIssueDate);
                                  return date.toLocaleDateString('en-ZA', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                  });
                                } catch {
                                  return accreditationIssueDate;
                                }
                              })()}
                            </p>
              </div>
                        )}
                        {accreditationExpiryDate && (
                          <div>
                            <span className="text-sm text-gray-600">Expiry Date</span>
                            <p className="font-medium text-gray-900 mt-1">
                              {(() => {
                                try {
                                  const date = accreditationExpiryDate?.toDate 
                                    ? accreditationExpiryDate.toDate() 
                                    : new Date(accreditationExpiryDate);
                                  return date.toLocaleDateString('en-ZA', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                  });
                                } catch {
                                  return accreditationExpiryDate;
                                }
                              })()}
                            </p>
                          </div>
                        )}
                        {!accreditationIssueDate && !accreditationExpiryDate && (
                          <div>
                            <span className="text-sm text-gray-600">Status</span>
                            <div className="mt-1">
                <Badge variant="success" size="sm">Active</Badge>
              </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-600 mb-2">No accreditation information available</p>
                        <p className="text-sm text-gray-500 mb-4">
                          {sdpProfile.isAccredited === 'no' 
                            ? 'You indicated you are not yet accredited during registration.' 
                            : 'Accreditation details were not provided during registration.'}
                        </p>
                        <Button
                          onClick={() => setShowAssistanceModal(true)}
                          variant="outline"
                          className="hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600"
                        >
                          <Target className="w-4 h-4 mr-2" />
                          Get Accreditation Assistance
                        </Button>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
            </div>
          </div>

        {/* Available QCTO Qualifications */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center">
                  <BookMarked className="w-6 h-6 mr-2 text-blue-600" />
                  Available QCTO Qualifications
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {csvData.length > 0 
                    ? `Browse ${csvData.length} QCTO-accredited qualifications from QCTO database`
                    : 'Browse and register for QCTO-accredited courses'
                  }
                </p>
              </div>
              <div className="flex items-center space-x-3 flex-wrap">
                {csvData.length > 0 && (
                  <Badge variant="success" size="sm" className="mr-2">
                    {csvData.length} Qualifications Loaded
                  </Badge>
                )}
                <Button
                  variant="outline"
                  onClick={() => setShowQCTOWebsite(!showQCTOWebsite)}
                  className={showQCTOWebsite 
                    ? "bg-blue-50 border-blue-300 text-blue-600 hover:bg-blue-100" 
                    : "hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600"
                  }
                >
                  {showQCTOWebsite ? (
                    <>
                      <BookMarked className="w-4 h-4 mr-2" />
                      View Local List
                    </>
                  ) : (
                    <>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View QCTO Website
                    </>
                  )}
          </Button>
                <a
                  href="https://www.qcto.org.za/full---part-registered-qualifications.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 font-medium"
                >
                  <span>Open in New Tab</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
        </div>
      </div>

            {/* Search and Filter - Only show when viewing local list */}
            {!showQCTOWebsite && (
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search qualifications by name, code, or description..."
                    value={accreditationSearchQuery}
                    onChange={(e) => setAccreditationSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <select
                  value={accreditationCategory}
                  onChange={(e) => setAccreditationCategory(e.target.value)}
                  className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {accreditationCategories.map(cat => (
                    <option key={cat} value={cat}>
                      {cat === 'all' ? 'All Categories' : cat}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className={showQCTOWebsite ? "p-0" : "p-6"}>
            {showQCTOWebsite ? (
              <div className="w-full h-[800px] border-t border-gray-200">
                <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ExternalLink className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-gray-700">
                      QCTO Qualifications Database
                    </span>
                  </div>
                  <a
                    href="https://www.qcto.org.za/full---part-registered-qualifications.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:text-blue-700 flex items-center space-x-1"
                  >
                    <span>Open in new tab</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <iframe
                  src="https://www.qcto.org.za/full---part-registered-qualifications.html"
                  className="w-full h-full border-0"
                  title="QCTO Qualifications"
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
                  onLoad={(e) => {
                    // Check if iframe loaded successfully
                    try {
                      const iframe = e.target as HTMLIFrameElement;
                      // If X-Frame-Options blocks, show fallback
                      if (iframe.contentWindow === null) {
                        console.log('Iframe may be blocked by X-Frame-Options');
                      }
                    } catch (error) {
                      console.log('Cannot access iframe content (expected due to CORS)');
                    }
                  }}
                />
                <div className="bg-gray-50 border-t border-gray-200 px-4 py-2 text-xs text-gray-600">
                  <p>
                    If the QCTO website doesn't load here due to security restrictions, 
                    please use the "Open in New Tab" button above or click{" "}
                    <a 
                      href="https://www.qcto.org.za/full---part-registered-qualifications.html" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 underline"
                    >
                      here
                    </a>
                    .
                  </p>
                </div>
              </div>
            ) : (
              <>
            {csvLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading QCTO qualifications...</p>
              </div>
            ) : csvData.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Qualifications ({filteredQualifications.length} shown)</h3>
                      <p className="text-sm text-gray-600 mt-1">Scrollable table view of all qualifications</p>
                    </div>
                    <Badge variant="success" size="sm">
                      {csvData.length} Total
                    </Badge>
                  </div>
                </div>
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b border-gray-200">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b border-gray-200">Code</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b border-gray-200">Level</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b border-gray-200">Category</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b border-gray-200">Duration</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b border-gray-200">Credits</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b border-gray-200">Description</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider border-b border-gray-200">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredQualifications.map((qual, index) => (
                        <tr key={qual.id || index} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                            {qual.name || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                            {qual.code || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                            {qual.level || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                            <Badge variant="default" size="sm">
                              {qual.category || 'General'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                            {qual.duration || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                            {qual.credits || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 max-w-xs">
                            <div className="truncate" title={qual.description || ''}>
                              {qual.description || '-'}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-center whitespace-nowrap">
                            <div className="flex items-center justify-center space-x-2">
                              {(qual.qtcoLink || qual.saqaLink) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const url = qual.qtcoLink || qual.saqaLink || 'https://www.qcto.org.za/full---part-registered-qualifications.html';
                                    window.open(url, '_blank');
                                  }}
                                  className="hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setAssistanceForm({
                                    ...assistanceForm,
                                    qualificationName: qual.name,
                                    qualificationCode: qual.code || ''
                                  });
                                  setShowAssistanceModal(true);
                                }}
                                className="hover:bg-purple-50 hover:border-purple-300 hover:text-purple-600"
                              >
                                <Target className="w-3 h-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : loadingQualifications ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading QCTO qualifications...</p>
              </div>
            ) : filteredQualifications.length > 0 ? (
              <div className="space-y-4">
                {filteredQualifications.map((qual) => (
                  <div
                    key={qual.id}
                    className="border-2 border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-md transition-all group"
                  >
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center space-x-2 mb-2">
                              <h3 className="text-lg font-bold text-gray-900">{qual.name}</h3>
                              {qual.category && <Badge variant="default" size="sm">{qual.category}</Badge>}
                            </div>
                            {qual.code && (
                              <p className="text-sm font-medium text-gray-600 mb-1">
                                Qualification Code: <span className="text-gray-900">{qual.code}</span>
                              </p>
                            )}
                            {qual.description && (
                              <p className="text-sm text-gray-600 mb-2">{qual.description}</p>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-200">
                          {qual.level && (
                            <div>
                              <p className="text-xs font-medium text-gray-500 mb-1">NQF Level</p>
                              <p className="text-sm font-semibold text-gray-900">{qual.level}</p>
                            </div>
                          )}
                          {qual.duration && (
                            <div>
                              <p className="text-xs font-medium text-gray-500 mb-1">Duration</p>
                              <p className="text-sm font-semibold text-gray-900">{qual.duration}</p>
                            </div>
                          )}
                          {qual.credits && (
                            <div>
                              <p className="text-xs font-medium text-gray-500 mb-1">Credits</p>
                              <p className="text-sm font-semibold text-gray-900">{qual.credits}</p>
                            </div>
                          )}
                          {qual.category && (
                            <div>
                              <p className="text-xs font-medium text-gray-500 mb-1">Category</p>
                              <p className="text-sm font-semibold text-gray-900">{qual.category}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col space-y-2 md:min-w-[200px]">
                        <Button
                          variant="outline"
                          onClick={() => {
                            const qctoUrl = qual.qtcoLink || qual.saqaLink || 'https://www.qcto.org.za/full---part-registered-qualifications.html';
                            window.open(qctoUrl, '_blank');
                          }}
                          className="w-full hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          View on QCTO
                        </Button>
                        {qual.saqaLink && (
                          <Button
                            variant="outline"
                            onClick={() => window.open(qual.saqaLink, '_blank')}
                            className="w-full hover:bg-green-50 hover:border-green-300 hover:text-green-600 transition-colors"
                          >
                            <ExternalLink className="w-4 h-4 mr-2" />
                            View on SAQA
                          </Button>
                        )}
                        <Button
                          onClick={() => {
                            setAssistanceForm({
                              ...assistanceForm,
                              qualificationName: qual.name,
                              qualificationCode: qual.code || ''
                            });
                            setShowAssistanceModal(true);
                          }}
                          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                        >
                          <Target className="w-4 h-4 mr-2" />
                          Get Assistance
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : qctoQualifications.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
                <BookMarked className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Qualifications Available</h3>
                <p className="text-gray-600 mb-4">
                  Qualifications are being loaded from QCTO. Please visit the QCTO website to view all registered qualifications.
                </p>
                <a
                  href="https://www.qcto.org.za/full---part-registered-qualifications.html"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Visit QCTO Website
                  </Button>
                </a>
              </div>
            ) : (
              <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
                <BookMarked className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Qualifications Found</h3>
                <p className="text-gray-600 mb-4">Try adjusting your search or filter criteria</p>
                <div className="flex items-center justify-center space-x-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setAccreditationSearchQuery('');
                      setAccreditationCategory('all');
                    }}
                  >
                    Clear Filters
                  </Button>
                  <a
                    href="https://www.qcto.org.za/full---part-registered-qualifications.html"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View All on QCTO
                    </Button>
                  </a>
                </div>
              </div>
            )}
              </>
            )}
          </div>
        </div>

        {/* Assistance Request Modal */}
        {showAssistanceModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
              <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                      <HelpCircle className="w-6 h-6 mr-2 text-blue-600" />
                      Request Accreditation Assistance
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">We'll help you get accredited with your chosen qualification</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAssistanceModal(false)}
                    className="hover:bg-gray-100"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-blue-900 mb-1">How We Help</p>
                        <p className="text-xs text-blue-800">
                          Our accreditation specialists will guide you through the entire process, from application to compliance, 
                          ensuring you meet all QCTO requirements for your chosen qualification.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Qualification Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={assistanceForm.qualificationName}
                      onChange={(e) => setAssistanceForm({ ...assistanceForm, qualificationName: e.target.value })}
                      placeholder="e.g., National Certificate (Vocational): Business Studies"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Qualification Code
                    </label>
                    <input
                      type="text"
                      value={assistanceForm.qualificationCode}
                      onChange={(e) => setAssistanceForm({ ...assistanceForm, qualificationCode: e.target.value })}
                      placeholder="e.g., NCV: Business Studies"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reason for Assistance <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={assistanceForm.reason}
                      onChange={(e) => setAssistanceForm({ ...assistanceForm, reason: e.target.value })}
                      placeholder="Tell us why you need accreditation assistance..."
                      rows={4}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Preferred Timeline
                    </label>
                    <select
                      value={assistanceForm.timeline}
                      onChange={(e) => setAssistanceForm({ ...assistanceForm, timeline: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select timeline</option>
                      <option value="asap">As soon as possible</option>
                      <option value="1-3months">1-3 months</option>
                      <option value="3-6months">3-6 months</option>
                      <option value="6-12months">6-12 months</option>
                      <option value="flexible">Flexible</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Additional Information
                    </label>
                    <textarea
                      value={assistanceForm.additionalInfo}
                      onChange={(e) => setAssistanceForm({ ...assistanceForm, additionalInfo: e.target.value })}
                      placeholder="Any additional details or specific requirements..."
                      rows={3}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    Required fields are marked with <span className="text-red-500">*</span>
                  </p>
                  <div className="flex items-center space-x-3">
                    <Button
                      variant="outline"
                      onClick={() => setShowAssistanceModal(false)}
                      className="hover:bg-gray-100"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleRequestAssistance}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Submit Request
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CSV Upload Modal */}
        {showCsvUpload && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
              <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-green-50 to-blue-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                      <Upload className="w-6 h-6 mr-2 text-green-600" />
                      Upload CSV Qualifications
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">Upload or paste CSV data to display qualifications in a scrollable table</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCsvUpload(false)}
                    className="hover:bg-gray-100"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-6">
                  {/* Instructions */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <BookMarked className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-blue-900 mb-1">CSV Format</p>
                        <p className="text-xs text-blue-800 mb-2">
                          Your CSV should include columns like: Name, Code, Level, Category, Description, Duration, Credits, etc.
                        </p>
                        <p className="text-xs text-blue-800">
                          The parser will automatically detect column names and map them to the qualification fields.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* File Upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Upload CSV File
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-green-400 transition-colors">
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleCsvFileUpload}
                        className="hidden"
                        id="csv-upload"
                      />
                      <label
                        htmlFor="csv-upload"
                        className="cursor-pointer flex flex-col items-center"
                      >
                        <Upload className="w-12 h-12 text-gray-400 mb-3" />
                        <p className="text-sm font-medium text-gray-700 mb-1">
                          Click to upload or drag and drop
                        </p>
                        <p className="text-xs text-gray-500">CSV file only</p>
                      </label>
                      {csvFile && (
                        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                          <p className="text-sm font-medium text-green-900">
                            ✓ {csvFile.name}
                          </p>
                          <p className="text-xs text-green-700">
                            {(csvFile.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* OR Divider */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white text-gray-500">OR</span>
                    </div>
                  </div>

                  {/* Paste CSV */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Paste CSV Data
                    </label>
                    <textarea
                      placeholder="Paste your CSV data here (including header row)..."
                      onPaste={handlePasteCsv}
                      className="w-full h-48 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.ctrlKey) {
                          const text = (e.target as HTMLTextAreaElement).value;
                          if (text) {
                            const parsed = parseCSV(text);
                            const qualifications = parsed.map((row, index) => ({
                              id: `csv-${index}`,
                              name: row.name || row.qualificationName || row['Qualification Name'] || row['Name'] || '',
                              code: row.code || row.qualificationCode || row['Qualification Code'] || row['Code'] || '',
                              level: row.level || row.nqfLevel || row['NQF Level'] || row['Level'] || '',
                              category: row.category || row['Category'] || 'General',
                              description: row.description || row['Description'] || '',
                              duration: row.duration || row['Duration'] || '',
                              credits: row.credits || row['Credits'] || 0,
                              qtcoLink: row.qtcoLink || row['QCTO Link'] || `https://www.qcto.org.za/full---part-registered-qualifications.html`,
                              saqaLink: row.saqaLink || row['SAQA Link'] || ''
                            })).filter(q => q.name);
                            setCsvData(qualifications);
                            setShowCsvUpload(false);
                          }
                        }
                      }}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Press Ctrl+Enter to process pasted CSV data
                    </p>
                  </div>

                  {/* Preview */}
                  {csvData.length > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center space-x-2 mb-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <p className="text-sm font-semibold text-green-900">
                          CSV Loaded Successfully!
                        </p>
                      </div>
                      <p className="text-xs text-green-800">
                        {csvData.length} qualifications found and ready to display in scrollable table.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    CSV data will be displayed in a scrollable table format
                  </p>
                  <div className="flex items-center space-x-3">
                    <Button
                      variant="outline"
                      onClick={() => setShowCsvUpload(false)}
                      className="hover:bg-gray-100"
                    >
                      Close
                    </Button>
                    {csvData.length > 0 && (
                      <Button
                        onClick={() => setShowCsvUpload(false)}
                        className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        View Table
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
  };

  const renderDocuments = () => {
    // Filter documents
    const filteredDocuments = documents
      .filter((doc) => {
        // Status filter
        if (documentFilterStatus !== 'all') {
          if (documentFilterStatus === 'pending' && doc.reviewStatus !== 'pending') return false;
          if (documentFilterStatus === 'approved' && doc.reviewStatus !== 'approved') return false;
          if (documentFilterStatus === 'rejected' && doc.reviewStatus !== 'rejected') return false;
        }
        // Type filter
        if (documentFilterType !== 'all') {
          if (documentFilterType === 'registration' && doc.source !== 'registration') return false;
          if (documentFilterType === 'manual' && doc.source !== 'manual') return false;
        }
        // Search filter
        if (documentSearchQuery) {
          const query = documentSearchQuery.toLowerCase();
          if (!doc.name.toLowerCase().includes(query) && 
              !doc.type.toLowerCase().includes(query)) {
            return false;
          }
        }
        return true;
      });

    // Calculate stats
    const pendingCount = documents.filter(d => d.reviewStatus === 'pending').length;
    const approvedCount = documents.filter(d => d.reviewStatus === 'approved').length;
    const rejectedCount = documents.filter(d => d.reviewStatus === 'rejected').length;
    const registrationCount = documents.filter(d => d.source === 'registration').length;
    const manualCount = documents.filter(d => d.source === 'manual').length;

    return (
    <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{documents.length}</div>
            <div className="text-sm text-gray-600">Total Documents</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{pendingCount}</div>
            <div className="text-sm text-gray-600">Pending Review</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{approvedCount}</div>
            <div className="text-sm text-gray-600">Approved</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{rejectedCount}</div>
            <div className="text-sm text-gray-600">Rejected</div>
          </div>
        </div>

        {/* Main Documents Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Documents</h2>
            <p className="text-sm text-gray-600 mt-1">Manage your company documents and files</p>
          </div>
              <Button 
                onClick={handleUploadDocument}
                className="hover:shadow-lg transition-shadow"
              >
            <Upload className="w-4 h-4 mr-2" />
            Upload Document
          </Button>
            </div>

            {/* Search and Filters */}
            <div className="mt-6 flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search documents..."
                  value={documentSearchQuery}
                  onChange={(e) => setDocumentSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-center space-x-2">
                <select
                  value={documentFilterStatus}
                  onChange={(e) => setDocumentFilterStatus(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
                <select
                  value={documentFilterType}
                  onChange={(e) => setDocumentFilterType(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Types</option>
                  <option value="registration">Registration</option>
                  <option value="manual">Manual Upload</option>
                </select>
              </div>
            </div>
        </div>
        
        <div className="p-6">
            {filteredDocuments.length > 0 ? (
          <div className="space-y-3">
                {filteredDocuments.map((doc) => {
                  const statusColors = {
                    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
                    approved: 'bg-green-100 text-green-800 border-green-200',
                    rejected: 'bg-red-100 text-red-800 border-red-200'
                  };
                  const statusIcons = {
                    pending: Clock,
                    approved: CheckCircle,
                    rejected: XCircle
                  };
                  const StatusIcon = statusIcons[doc.reviewStatus || 'pending'];

                  return (
                    <div 
                      key={doc.id} 
                      className={`flex items-center justify-between p-5 border-2 rounded-xl hover:shadow-md transition-all group ${
                        doc.reviewStatus === 'approved' ? 'border-green-200 bg-green-50/30' :
                        doc.reviewStatus === 'rejected' ? 'border-red-200 bg-red-50/30' :
                        'border-yellow-200 bg-yellow-50/30'
                      }`}
                    >
                      <div className="flex items-center space-x-4 flex-1">
                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center transition-colors ${
                          doc.reviewStatus === 'approved' ? 'bg-green-100' :
                          doc.reviewStatus === 'rejected' ? 'bg-red-100' :
                          'bg-yellow-100'
                        }`}>
                          <FileText className={`w-7 h-7 ${
                            doc.reviewStatus === 'approved' ? 'text-green-600' :
                            doc.reviewStatus === 'rejected' ? 'text-red-600' :
                            'text-yellow-600'
                          }`} />
                </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-1">
                            <h3 className="font-semibold text-gray-900">{doc.name}</h3>
                            <Badge 
                              variant={doc.reviewStatus === 'approved' ? 'success' : 
                                      doc.reviewStatus === 'rejected' ? 'danger' : 'warning'}
                              size="sm"
                              className="flex items-center space-x-1"
                            >
                              <StatusIcon className="w-3 h-3" />
                              <span className="capitalize">{doc.reviewStatus || 'pending'}</span>
                            </Badge>
                            {doc.source && (
                              <Badge variant="info" size="sm">
                                {doc.source === 'registration' ? 'Registration' : 'Manual'}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-gray-600">
                            <span className="flex items-center space-x-1">
                              <FileText className="w-4 h-4" />
                              <span>{doc.type}</span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <Info className="w-4 h-4" />
                              <span>{doc.size}</span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <Clock className="w-4 h-4" />
                              <span>{doc.date}</span>
                            </span>
                          </div>
                          {doc.reviewComment && (
                            <div className="mt-2 text-xs text-gray-600 bg-gray-50 rounded-lg p-2">
                              <strong>Review Comment:</strong> {doc.reviewComment}
                            </div>
                          )}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleViewDocument(doc.id)}
                          className="hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors"
                        >
                  <Eye className="w-4 h-4 mr-1" />
                  View
                </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDownloadDocument(doc.id)}
                          className="hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors"
                        >
                  <Download className="w-4 h-4" />
                </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
                <FolderOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2 font-medium">
                  {documentSearchQuery || documentFilterStatus !== 'all' || documentFilterType !== 'all' 
                    ? 'No documents match your filters' 
                    : 'No documents uploaded yet'}
                </p>
                {!documentSearchQuery && documentFilterStatus === 'all' && documentFilterType === 'all' && (
                  <Button onClick={handleUploadDocument} className="mt-4">
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Your First Document
                  </Button>
                )}
              </div>
            )}
              </div>
            </div>
            
        {/* Upload Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">Upload Document</h2>
                  <button
                    onClick={() => {
                      setShowUploadModal(false);
                      setDocumentName('');
                      setUploadingFile(null);
                    }}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Document Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={documentName}
                    onChange={(e) => setDocumentName(e.target.value)}
                    placeholder="e.g., Company Registration Certificate"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select File <span className="text-red-500">*</span>
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                    {uploadingFile ? (
                      <div className="space-y-2">
                        <FileText className="w-12 h-12 text-blue-600 mx-auto" />
                        <p className="text-sm font-medium text-gray-900">{uploadingFile.name}</p>
                        <p className="text-xs text-gray-500">{(uploadingFile.size / 1024).toFixed(0)} KB</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setUploadingFile(null)}
                          className="mt-2"
                        >
                          Change File
                </Button>
              </div>
                    ) : (
                      <div>
                        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600 mb-2">Click to select a file</p>
                        <input
                          type="file"
                          onChange={handleFileSelect}
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          className="hidden"
                          id="document-upload"
                        />
                        <label
                          htmlFor="document-upload"
                          className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors"
                        >
                          Choose File
                        </label>
                        <p className="text-xs text-gray-500 mt-2">Max size: 10MB</p>
            </div>
                    )}
          </div>
        </div>
      </div>

              <div className="p-6 border-t border-gray-200 bg-gray-50 flex items-center justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowUploadModal(false);
                    setDocumentName('');
                    setUploadingFile(null);
                  }}
                  disabled={uploadingDocument}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitDocument}
                  disabled={!uploadingFile || !documentName.trim() || uploadingDocument}
                  className="disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploadingDocument ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
  };

  const renderReports = () => {
    const now = new Date();
    const formatRange = (start: Date, end: Date) =>
      `${start.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })} - ${end.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const quarterEnd = new Date(quarterStart.getFullYear(), quarterStart.getMonth() + 3, 0);
    const quarterLabel = `Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}`;
    const pendingDocuments = documents.filter(d => d.reviewStatus === 'pending').length;
    const setaCount = user.profile.sectorAccreditations ? Object.keys(user.profile.sectorAccreditations).length : 0;

    const formatGeneratedDate = (date: Date) =>
      date.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
    const formatReportSize = (base: number) => `${Math.max(1.2, base).toFixed(1)} MB`;

    const reportCards = [
      {
        id: 'monthly',
        title: 'Monthly Performance',
        description: 'Projects completed, SME utilisation, and engagement health.',
        icon: BarChart3,
        accent: 'bg-blue-100 text-blue-600',
        dateRange: formatRange(monthStart, monthEnd),
        stats: [
          { label: 'Completed Projects', value: `${stats.completedProjects}` },
          { label: 'Active Projects', value: `${stats.activeEngagements}` },
          { label: 'Available SMEs', value: `${stats.availableSMEs}` }
        ],
        tags: ['Projects', 'Utilisation', 'Quality'],
        payload: {
          title: 'Monthly Performance Report',
          dateRange: formatRange(monthStart, monthEnd),
          summary: `Overview of ${user.profile.name}'s projects, SME performance, and utilisation for the current month.`,
          stats: [
            { label: 'Completed Projects', value: `${stats.completedProjects}` },
            { label: 'Projects In Progress', value: `${stats.activeEngagements}` },
            { label: 'Available SMEs', value: `${stats.availableSMEs}` },
            { label: 'Total Engagement Value', value: stats.totalInvestment ? `R${stats.totalInvestment.toLocaleString()}` : 'R0' }
          ],
          footnote: 'Figures include all engagements logged on Scholarz within the selected month.'
        }
      },
      {
        id: 'financial',
        title: 'Financial Summary',
        description: 'Revenue, platform fees, and outstanding invoices.',
        icon: DollarSign,
        accent: 'bg-purple-100 text-purple-600',
        dateRange: formatRange(quarterStart, quarterEnd),
        stats: [
          { label: 'Revenue', value: stats.totalRevenue ? `R${stats.totalRevenue.toLocaleString()}` : 'R0' },
          { label: 'Investment', value: stats.totalInvestment ? `R${stats.totalInvestment.toLocaleString()}` : 'R0' },
          { label: 'Platform Fee (10%)', value: stats.totalRevenue ? `R${(stats.totalRevenue * 0.1).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : 'R0' }
        ],
        tags: ['Finance', 'Escrow', 'Fees'],
        payload: {
          title: 'Financial Performance Report',
          dateRange: formatRange(quarterStart, quarterEnd),
          summary: 'Quarter-to-date financial overview, including engagement revenue and platform deductions.',
          stats: [
            { label: 'Total Revenue', value: stats.totalRevenue ? `R${stats.totalRevenue.toLocaleString()}` : 'R0' },
            { label: 'Platform Fees (10%)', value: stats.totalRevenue ? `R${(stats.totalRevenue * 0.1).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : 'R0' },
            { label: 'Investment in SMEs', value: stats.totalInvestment ? `R${stats.totalInvestment.toLocaleString()}` : 'R0' },
            { label: 'Net Payout to SMEs', value: stats.totalRevenue ? `R${(stats.totalRevenue * 0.9).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : 'R0' }
          ],
          footnote: 'Financial data is calculated from confirmed engagements processed via Scholarz.'
        }
      },
      {
        id: 'compliance',
        title: 'Compliance & Accreditation',
        description: 'Document renewals, SETA numbers, and QCTO readiness.',
        icon: Shield,
        accent: 'bg-green-100 text-green-600',
        dateRange: 'Rolling 90 days',
        stats: [
          { label: 'Certified Documents', value: `${documents.length}` },
          { label: 'Pending Renewals', value: documents.filter(d => d.reviewStatus === 'pending').length.toString() },
          { label: 'Active SETA Sectors', value: (user.profile.sectorAccreditations ? Object.keys(user.profile.sectorAccreditations).length : 0).toString() }
        ],
        tags: ['Compliance', 'QCTO', 'SETA'],
        payload: {
          title: 'Compliance & Accreditation Report',
          dateRange: 'Rolling 90 days',
          summary: 'Checklist of uploaded compliance documents, certification dates, and SETA/QCTO accreditation numbers.',
          stats: [
            { label: 'Documents on File', value: `${documents.length}` },
            { label: 'Pending Admin Review', value: `${documents.filter(d => d.reviewStatus === 'pending').length}` },
            { label: 'Approved Documents', value: `${documents.filter(d => d.reviewStatus === 'approved').length}` },
            { label: 'SETA Registrations', value: user.profile.sectorAccreditations ? Object.keys(user.profile.sectorAccreditations).join(', ') : 'None supplied' }
          ],
          footnote: 'Include this PDF when submitting evidence for QCTO or SETA audits.'
        }
      }
    ];

    const recentReports = [
      {
        id: 'finance',
        title: `${quarterLabel} Financial Summary`,
        type: 'Finance',
        size: formatReportSize((stats.totalRevenue || 0) / 1000 + 1.2),
        generated: formatGeneratedDate(now),
        status: 'Ready',
        payload: reportCards[1].payload
      },
      {
        id: 'engagements',
        title: 'SME Engagement Log',
        type: 'Operations',
        size: formatReportSize(engagements.length * 0.2 + 1),
        generated: formatGeneratedDate(new Date(now.getTime() - 1000 * 60 * 60 * 24 * 7)),
        status: 'Ready',
        payload: reportCards[0].payload
      },
      {
        id: 'compliance',
        title: 'Compliance Pack (QCTO)',
        type: 'Compliance',
        size: formatReportSize(documents.length * 0.25 + 1.5),
        generated: formatGeneratedDate(new Date(now.getTime() - 1000 * 60 * 60 * 24 * 25)),
        status: pendingDocuments > 0 ? 'Requires Update' : 'Ready',
        payload: reportCards[2].payload
      }
    ];

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 rounded-2xl shadow-xl p-8 text-white flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <p className="text-sm uppercase tracking-widest text-white/70 mb-1">Reports</p>
            <h2 className="text-3xl font-bold mb-2">Download-ready intelligence</h2>
            <p className="text-white/80 max-w-2xl">
              Export polished PDF summaries for board packs, QCTO submissions, or client presentations. Each download opens a printable PDF view you can save directly.
            </p>
          </div>
          <Button
            className="bg-white text-blue-700 hover:bg-blue-50 shadow-lg"
            onClick={() => handleDownloadReport(reportCards[0].payload)}
          >
            <Download className="w-4 h-4 mr-2" />
            Latest Monthly PDF
          </Button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {reportCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg transition-shadow p-6 flex flex-col h-full">
                <div className="flex items-start justify-between">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${card.accent}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-semibold text-gray-500">{card.dateRange}</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mt-4">{card.title}</h3>
                <p className="text-sm text-gray-600 mt-2 flex-1">{card.description}</p>
                <div className="mt-4 space-y-2">
                  {card.stats.map((stat) => (
                    <div key={stat.label} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                      <span className="text-gray-600">{stat.label}</span>
                      <span className="font-semibold text-gray-900">{stat.value}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {card.tags.map((tag) => (
                    <Badge key={tag} variant="info" size="sm" className="bg-gray-100 text-gray-700 border border-gray-200">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <Button
                  className="mt-6 w-full"
                  variant="outline"
                  onClick={() => handleDownloadReport(card.payload)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            );
          })}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
          <div className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-100">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Recent Exports</h3>
              <p className="text-sm text-gray-600">Auto-generated packs ready for download.</p>
            </div>
            <Button variant="outline" onClick={() => handleDownloadReport(reportCards[1].payload)}>
              Download All as PDF
            </Button>
          </div>
          <div className="divide-y divide-gray-100">
            {recentReports.map((report) => (
              <div key={report.id} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-gray-500" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{report.title}</p>
                    <p className="text-xs text-gray-500">{report.type} • {report.size}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <div>
                    Generated <span className="font-medium text-gray-900">{report.generated}</span>
                  </div>
                  <Badge
                    variant={report.status === 'Ready' ? 'success' : 'warning'}
                    size="sm"
                  >
                    {report.status}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => handlePreviewReport(report.payload)}>
                      <Eye className="w-4 h-4 mr-1" />
                      Preview
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDownloadReport(report.payload)}>
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const handlePostItem = async () => {
    if (!newItemForm.title || !newItemForm.price) {
      alert('Please fill in all required fields');
      return;
    }

    if (!isFirebaseConfigured()) {
      alert('Firebase is not configured. Cannot post item.');
      return;
    }

    try {
      const marketItemData = {
        title: newItemForm.title,
        description: newItemForm.description,
        category: newItemForm.category,
        price: newItemForm.price,
        sellerId: user.id,
        sellerName: user.profile.name,
        sellerType: 'SDP',
        location: newItemForm.location,
        imageUrl: newItemForm.imageUrl || '/images/collaboration.jpg',
        verified: user.profile.verified || false,
        status: 'active',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      await addDoc(collection(db, 'marketItems'), marketItemData);
      
      setNewItemForm({ title: '', description: '', category: 'Course', price: '', location: user.profile.location, imageUrl: '' });
      setMarketView('browse');
      alert('Item posted successfully!');
    } catch (error: any) {
      console.error('Error posting item:', error);
      alert('Error posting item: ' + error.message);
    }
  };

  const handlePostWant = async () => {
    if (!newWantForm.title || !newWantForm.budget) {
      alert('Please fill in all required fields');
      return;
    }

    if (!isFirebaseConfigured()) {
      alert('Firebase is not configured. Cannot post want ad.');
      return;
    }

    try {
      const wantItemData = {
        title: newWantForm.title,
        description: newWantForm.description,
        category: newWantForm.category,
        budget: newWantForm.budget,
        buyerId: user.id,
        buyerName: user.profile.name,
        buyerType: 'SDP',
        location: newWantForm.location,
        status: 'active',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      await addDoc(collection(db, 'wantItems'), wantItemData);
      
      setNewWantForm({ title: '', description: '', category: 'Materials', budget: '', location: user.profile.location });
      setMarketView('browse');
      alert('Want ad posted successfully!');
    } catch (error: any) {
      console.error('Error posting want ad:', error);
      alert('Error posting want ad: ' + error.message);
    }
  };

  // Handle opening chat with seller
  const handleContactSeller = async (item: any) => {
    setSelectedSeller(item);
    setShowChatModal(true);
    
    // Load existing chat messages from Firebase
    if (isFirebaseConfigured()) {
      try {
        const chatId = [user.id, item.sellerId].sort().join('_');
        const messagesQuery = query(
          collection(db, 'chats', chatId, 'messages'),
          orderBy('timestamp', 'asc')
        );
        
        const snapshot = await getDocs(messagesQuery);
        const messages: any[] = [];
        snapshot.forEach((doc) => {
          messages.push({ id: doc.id, ...doc.data() });
        });
        setChatMessages(messages);
      } catch (error) {
        console.error('Error loading chat messages:', error);
        setChatMessages([]);
      }
    }
  };

  // Handle sending chat message
  const handleSendMessage = async () => {
    if (!chatMessage.trim() || !selectedSeller) return;

    const messageText = chatMessage.trim();
    const newMessage = {
      senderId: user.id,
      senderName: user.profile.name,
      receiverId: selectedSeller.sellerId,
      receiverName: selectedSeller.seller,
      message: messageText,
      timestamp: new Date().toISOString(),
      read: false
    };

    // Add to local state immediately
    setChatMessages([...chatMessages, newMessage]);
    setChatMessage('');

    // Save to Firebase
    if (isFirebaseConfigured()) {
      try {
        const chatId = [user.id, selectedSeller.sellerId].sort().join('_');
        
        // Save message
        await addDoc(collection(db, 'chats', chatId, 'messages'), {
          ...newMessage,
          timestamp: Timestamp.now()
        });

        // Create or update engagement to make it active
        await ensureEngagementExists(selectedSeller.sellerId, selectedSeller.seller);

        // Create notification for receiver
        await createNotification({
          userId: selectedSeller.sellerId,
          type: 'message',
          title: 'New Message',
          message: `${user.profile.name}: ${messageText.substring(0, 50)}${messageText.length > 50 ? '...' : ''}`,
          link: `/dashboard?tab=engagements&chat=${chatId}`,
          metadata: { chatId, senderId: user.id }
        });
        
      } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message. Please try again.');
      }
    }
  };

  // Ensure engagement exists when messaging starts
  const ensureEngagementExists = async (smeId: string, smeName: string) => {
    if (!isFirebaseConfigured()) return;

    try {
      // Check if engagement already exists
      const engagementsQuery = query(
        collection(db, 'engagements'),
        where('sdpId', '==', user.id),
        where('smeId', '==', smeId)
      );
      
      const snapshot = await getDocs(engagementsQuery);
      
      if (snapshot.empty) {
        // Create new engagement with Pending status
        const engagementData = {
          smeId: smeId,
          sme: smeName,
          sdpId: user.id,
          sdp: user.profile.name,
          type: 'Consultation',
          status: 'Pending',
          startDate: '',
          endDate: '',
          fee: 'R2,500',
          description: 'Awaiting project details',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        };
        
        console.log('Creating new engagement:', engagementData);
        const docRef = await addDoc(collection(db, 'engagements'), engagementData);
        console.log('Engagement created with ID:', docRef.id);
      } else {
        console.log('Engagement already exists');
      }
    } catch (error) {
      console.error('Error ensuring engagement exists:', error);
    }
  };

  // Handle viewing seller profile
  const handleViewProfile = async (item: any) => {
    setSelectedSeller(item);
    setSellerReviews([]); // Reset reviews
    setShowProfileModal(true);
    
    // Load seller details and ratings from Firebase
    if (isFirebaseConfigured() && item.sellerId) {
      try {
        // Get seller profile
        const sellerDoc = await getDoc(doc(db, 'users', item.sellerId));
        if (sellerDoc.exists()) {
          const sellerData = sellerDoc.data();
          const profile = sellerData.profile || {};
          setSelectedSeller({
            ...item,
            ...profile,
            email: sellerData.email || profile.email || item.email,
            phone: profile.phone || (sellerData as any).phone || item.phone || '',
            roles: profile.roles || (profile.role ? [profile.role] : []) || item.roles || [],
            qualifications: profile.qualifications || item.qualifications || [],
            rates: profile.rates || item.rates || {},
            setaRegistration: profile.setaRegistration || (sellerData as any).setaRegistration || item.setaRegistration || '',
            documentCertificationDate:
              profile.documentCertificationDate ||
              (sellerData as any).documentCertificationDate ||
              item.documentCertificationDate ||
              '',
            documentCertificationDates:
              profile.documentCertificationDates ||
              (sellerData as any).documentCertificationDates ||
              item.documentCertificationDates ||
              {},
            location: profile.location || item.location || '',
            experience: profile.experience || item.experience || '',
            specializations: profile.specializations || item.specializations || [],
            sectors: profile.sectors || item.sectors || [],
            aboutMe: profile.aboutMe || item.aboutMe || ''
          });
        }

        // Load real reviews from smeRatings collection
        const ratingsQuery = query(
          collection(db, 'smeRatings'),
          where('smeId', '==', item.sellerId),
          orderBy('updatedAt', 'desc')
        );
        
        const ratingsSnapshot = await getDocs(ratingsQuery);
        const reviews = ratingsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            client: data.sdpName || 'Anonymous',
            rating: data.rating || 0,
            comment: data.comment || '',
            date: data.updatedAt ? new Date(data.updatedAt.seconds * 1000).toLocaleDateString() : 'N/A'
          };
        });
        
        setSellerReviews(reviews);
      } catch (error) {
        console.error('Error loading seller profile:', error);
      }
    }
  };

  const renderMarket = () => {
    const projectTypes = ['all', 'Consultation', 'Training', 'Assessment', 'Moderation', 'Facilitation', 'Mentorship', 'Other'];
    const filteredProjects = allMarketProjects.filter(project => {
      const matchesSearch = project.projectName.toLowerCase().includes(marketSearch.toLowerCase()) ||
        project.description.toLowerCase().includes(marketSearch.toLowerCase()) ||
        project.sdpName.toLowerCase().includes(marketSearch.toLowerCase());
      const matchesCategory = marketCategory === 'all' || project.projectType === marketCategory;
      return matchesSearch && matchesCategory;
    });

    return (
      <div className="space-y-6">
        {/* Market Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl shadow-lg p-6 text-white">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2 flex items-center">
                <Briefcase className="w-6 h-6 mr-2" />
                Project Marketplace
              </h2>
              <p className="text-blue-100">Browse all open projects where SMEs can apply for work</p>
            </div>
            <div className="flex items-center space-x-2 mt-4 md:mt-0">
              <Button 
                variant="outline" 
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                onClick={() => setActiveTab('engagements')}
              >
                <Briefcase className="w-4 h-4 mr-2" />
                My Projects
              </Button>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search projects..."
                value={marketSearch}
                onChange={(e) => setMarketSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={marketCategory}
              onChange={(e) => setMarketCategory(e.target.value)}
              className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {projectTypes.map(type => (
                <option key={type} value={type}>{type === 'all' ? 'All Project Types' : type}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredProjects.map(project => {
            const isMyProject = project.sdpId === user.id;
            const projectApps = projectApplications.filter(app => app.projectId === project.id);
            
            return (
              <div key={project.id} className={`border rounded-lg p-6 hover:shadow-md transition-shadow ${isMyProject ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'}`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{project.projectName}</h3>
                      {isMyProject && (
                        <Badge variant="info" size="sm">My Project</Badge>
                      )}
                      <Badge variant="success" size="sm">{project.status}</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{project.description}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-2">
                      <span><strong>Type:</strong> {project.projectType}</span>
                      <span><strong>Budget:</strong> {project.budget}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <MapPin className="w-4 h-4" />
                      <span>Posted by: {project.sdpName}</span>
                    </div>
                    {project.startDate && (
                      <div className="text-xs text-gray-500 mt-2">
                        <Clock className="w-3 h-3 inline mr-1" />
                        Start: {new Date(project.startDate).toLocaleDateString()}
                      </div>
                    )}
                    {isMyProject && projectApps.length > 0 && (
                      <div className="mt-3 p-2 bg-white rounded border border-blue-200">
                        <p className="text-xs font-medium text-blue-900">
                          Applications: {projectApps.length} ({projectApps.filter(a => a.status === 'pending').length} pending)
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                {isMyProject && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setActiveTab('engagements');
                      }}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Applications
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {filteredProjects.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <Briefcase className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No projects found</h3>
            <p className="text-gray-600 mb-4">Try adjusting your search or filter criteria, or post a new project.</p>
            <Button onClick={() => setActiveTab('engagements')}>
              <Plus className="w-4 h-4 mr-2" />
              Create Project
            </Button>
          </div>
        )}
      </div>
    );
  };

  const renderSettings = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Notification Settings</h3>
            <p className="text-sm text-gray-500">Pick how you want Scholarz to keep you posted.</p>
          </div>
          {notificationStatus && (
            <span
              className={`text-sm ${
                notificationStatus.type === 'success' ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {notificationStatus.message}
            </span>
          )}
        </div>
        <div className="space-y-4">
          {[
            {
              key: 'email',
              title: 'Email Notifications',
              description: 'Receive updates about engagements, payments, and reviews.',
              enabled: emailNotifications
            },
            {
              key: 'sms',
              title: 'SMS Notifications',
              description: 'Get instant alerts via SMS for urgent activity.',
              enabled: smsNotifications
            }
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{item.title}</p>
                <p className="text-sm text-gray-500">{item.description}</p>
              </div>
              <button
                onClick={() => handleNotificationToggle(item.key === 'email' ? 'email' : 'sms')}
                disabled={notificationSaving}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  item.enabled ? 'bg-blue-600' : 'bg-gray-300'
                } ${notificationSaving ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                    item.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                ></span>
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Current Plan</p>
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-2xl font-bold text-gray-900">Scholarz {planInfo.label}</h3>
              <Badge
                variant={
                  planInfo.statusLabel === 'Active' || planInfo.statusLabel === 'Trial Active'
                    ? 'success'
                    : planInfo.statusLabel === 'Pending'
                    ? 'warning'
                    : 'danger'
                }
                size="sm"
                className="px-3"
              >
                {planInfo.statusLabel}
              </Badge>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Billing reference: <span className="font-medium text-gray-900">{planInfo.reference || 'Pending'}</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <p className="text-xs uppercase text-gray-500 mb-1">Activated</p>
                <p className="font-semibold text-gray-900">
                  {planInfo.activatedAt ? formatDateLabel(planInfo.activatedAt.toISOString()) : 'TBC'}
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <p className="text-xs uppercase text-gray-500 mb-1">Renewal</p>
                <p className="font-semibold text-gray-900">
                  {planInfo.expiresAt ? formatDateLabel(planInfo.expiresAt.toISOString()) : 'N/A'}
                </p>
                {planInfo.daysRemaining !== null && (
                  <p className="text-xs text-gray-500">{planInfo.daysRemaining} days remaining</p>
                )}
              </div>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <p className="text-xs uppercase text-gray-500 mb-1">Billing Amount</p>
                <p className="font-semibold text-gray-900">
                  {planInfo.amount === 0 ? 'R0 (Trial)' : formatCurrency(planInfo.amount)}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-2xl border border-gray-100 p-5 w-full lg:max-w-sm">
            <h4 className="font-semibold text-gray-900 mb-2">Payment Method</h4>
            <p className="text-sm text-gray-600">PayPal • Secured Card / EFT</p>
            <p className="text-xs text-gray-500 mt-1">
              Billing contact: <span className="font-semibold text-gray-800">{billingProfile.contactEmail}</span>
            </p>
            <p className="text-xs text-gray-500">
              VAT number: <span className="font-semibold text-gray-800">{billingProfile.vatNumber || 'Not provided'}</span>
            </p>
            <div className="mt-3 text-xs text-gray-500 space-y-1">
              <p>
                Bank: <span className="font-semibold text-gray-800">{billingProfile.bankName || 'Not provided'}</span>
              </p>
              <p>
                Account Holder:{' '}
                <span className="font-semibold text-gray-800">{billingProfile.accountHolder || 'Not provided'}</span>
              </p>
              <p>
                Account Type:{' '}
                <span className="font-semibold text-gray-800">{billingProfile.accountType || 'Not provided'}</span>
              </p>
              <p>
                Account Number:{' '}
                <span className="font-semibold text-gray-800">{maskAccountNumber(billingProfile.accountNumber)}</span>
              </p>
              <p>
                Branch Code:{' '}
                <span className="font-semibold text-gray-800">{billingProfile.branchCode || 'Not provided'}</span>
              </p>
              {billingProfile.paypalSubscriptionStatus && (
                <p>
                  PayPal Subscription:{' '}
                  <span className="font-semibold text-gray-800">
                    {billingProfile.paypalSubscriptionStatus}
                    {billingProfile.paypalSubscriptionId ? ` • ${billingProfile.paypalSubscriptionId}` : ''}
                  </span>
                </p>
              )}
            </div>
            <div className="mt-4 space-y-2">
              <Button className="w-full" onClick={handleOpenBillingModal}>
                <CreditCard className="w-4 h-4 mr-2" />
                Manage Billing Profile
              </Button>
              <Button variant="ghost" className="w-full" onClick={handleDownloadInvoices}>
                <Download className="w-4 h-4 mr-2" />
                Download Latest Invoice
              </Button>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-lg font-semibold text-gray-900">Invoice History</h4>
              <p className="text-sm text-gray-500">Auto-generated statements ready for auditing.</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleDownloadInvoices}>
              <Download className="w-4 h-4 mr-2" />
              Download All
            </Button>
          </div>
          <div className="space-y-3">
            {invoiceHistory.map((invoice) => (
              <div
                key={invoice.id}
                className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border border-gray-100 rounded-2xl px-4 py-3 hover:border-blue-200 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 font-semibold flex items-center justify-center">
                    {invoice.category.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{invoice.description}</p>
                    <p className="text-xs text-gray-500">
                      Invoice #{invoice.number} • {invoice.category} • {formatDateLabel(invoice.generatedAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{formatCurrency(invoice.amount)}</p>
                    <p className="text-xs text-gray-500">{invoice.reference || 'No reference'}</p>
                  </div>
                  <Badge
                    variant={
                      invoice.status.toLowerCase().includes('paid') || invoice.status.toLowerCase().includes('active')
                        ? 'success'
                        : invoice.status.toLowerCase().includes('pending')
                        ? 'warning'
                        : 'default'
                    }
                    size="sm"
                  >
                    {invoice.status}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handlePreviewReport(invoice.payload)}>
                      <Eye className="w-4 h-4 mr-1" />
                      Preview
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDownloadReport(invoice.payload)}>
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50/30 to-blue-50/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Profile Banner Card */}
        <div className="bg-gradient-to-r from-purple-600 via-purple-700 to-blue-600 rounded-2xl shadow-xl mb-6 overflow-hidden">
          <div className="p-6 md:p-8 relative">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
          </div>
            
            <div className="relative flex flex-col md:flex-row md:items-center md:justify-between">
              <div className="flex items-center space-x-5 mb-4 md:mb-0">
                <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center ring-4 ring-white/30">
                  <Building2 className="w-10 h-10 text-white" />
                </div>
                <div className="text-white">
                  <div className="flex items-center space-x-3 mb-2">
                    <h2 className="text-2xl md:text-3xl font-bold">Welcome back, {user.profile.name.split(' ')[0]}!</h2>
              {user.profile.verified && (
                      <div className="bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 flex items-center space-x-1">
                        <Award className="w-4 h-4" />
                        <span className="text-xs font-semibold">Verified</span>
                      </div>
                    )}
                  </div>
                  <p className="text-purple-100 text-sm mb-2">{user.profile.type} • {user.profile.location}</p>
                  <div className="flex items-center space-x-4">
              {user.profile.assessmentCentre && (
                      <Badge variant="info" size="sm" className="bg-white/20 backdrop-blur-sm border-white/30 text-white shadow-lg">
                  Assessment Centre
                </Badge>
              )}
                    <div className="bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-semibold">
                      {user.profile.accreditation}
            </div>
                  </div>
          </div>
        </div>
        
              <Button 
                onClick={() => setActiveTab('settings')}
                className="bg-white text-purple-600 hover:bg-purple-50 shadow-lg hover:shadow-xl transition-all"
              >
                <Settings className="w-4 h-4 mr-2" />
                Settings
          </Button>
            </div>
        </div>
      </div>

        {/* Modern Tab Navigation */}
        <div className="mb-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-1">
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
                const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                    className={`flex flex-col items-center justify-center px-4 py-3 rounded-xl font-medium text-xs transition-all ${
                      isActive
                        ? 'bg-gradient-to-br from-purple-600 to-blue-600 text-white shadow-md scale-105'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className={`w-5 h-5 mb-1 ${isActive ? '' : 'opacity-70'}`} />
                    <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
            </div>
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'market' && renderMarket()}
        {activeTab === 'find-smes' && renderFindSMEs()}
        {activeTab === 'engagements' && renderEngagements()}
        {activeTab === 'accreditation' && renderAccreditation()}
        {activeTab === 'reports' && renderReports()}
        {activeTab === 'settings' && renderSettings()}
      </div>

      {showBillingModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Manage Billing Profile</h3>
                <p className="text-sm text-gray-500">This information appears on your invoices and receipts.</p>
              </div>
              <button
                onClick={() => setShowBillingModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company / Billing Name</label>
                  <input
                    type="text"
                    value={billingForm.companyName}
                    onChange={(e) => handleBillingFieldChange('companyName', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Scholarz Training (Pty) Ltd"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
                  <input
                    type="email"
                    value={billingForm.contactEmail}
                    onChange={(e) => handleBillingFieldChange('contactEmail', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="[email protected]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={billingForm.phone}
                    onChange={(e) => handleBillingFieldChange('phone', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="+27 11 000 0000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">VAT Number</label>
                  <input
                    type="text"
                    value={billingForm.vatNumber}
                    onChange={(e) => handleBillingFieldChange('vatNumber', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Billing Address</label>
                <textarea
                  value={billingForm.address}
                  onChange={(e) => handleBillingFieldChange('address', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Street, City, Province, Postal Code"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Billing Reference</label>
                <input
                  type="text"
                  value={billingForm.billingReference}
                  onChange={(e) => handleBillingFieldChange('billingReference', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., PF-123456"
                />
              </div>
              <div className="pt-4 border-t border-gray-200">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Banking Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                    <input
                      type="text"
                      value={billingForm.bankName}
                      onChange={(e) => handleBillingFieldChange('bankName', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., FNB, Nedbank"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Account Holder</label>
                    <input
                      type="text"
                      value={billingForm.accountHolder}
                      onChange={(e) => handleBillingFieldChange('accountHolder', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Legal entity name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                    <input
                      type="text"
                      value={billingForm.accountNumber}
                      onChange={(e) => handleBillingFieldChange('accountNumber', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter bank account number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Branch Code</label>
                    <input
                      type="text"
                      value={billingForm.branchCode}
                      onChange={(e) => handleBillingFieldChange('branchCode', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Branch code"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
                    <select
                      value={billingForm.accountType}
                      onChange={(e) => handleBillingFieldChange('accountType', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select account type</option>
                      <option value="Cheque">Cheque / Current</option>
                      <option value="Savings">Savings</option>
                      <option value="Business">Business</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4 bg-gray-50 rounded-b-2xl">
              <Button
                variant="ghost"
                onClick={() => setShowBillingModal(false)}
                disabled={billingSaving}
                className="px-5"
              >
                Cancel
              </Button>
              <Button onClick={handleSaveBillingProfile} disabled={billingSaving} className="px-5">
                {billingSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Rating Modal */}
      {ratingModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Rate SME</h2>
              <button
                onClick={() => setRatingModal({ open: false, smeId: null, smeName: '' })}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-gray-700 font-medium mb-2">Rating for: {ratingModal.smeName}</p>
              
              {/* Info message if updating existing rating */}
              {isUpdatingExistingRating && (
                <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start space-x-2">
                  <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium">Updating Your Rating</p>
                    <p className="text-blue-700">You've already rated this SME. Your new rating will replace the previous one.</p>
                  </div>
                </div>
              )}
              
              {/* Star Rating */}
              <div className="flex items-center space-x-2 mb-4">
                <span className="text-sm text-gray-600 mr-2">Rating:</span>
                <div className="flex items-center space-x-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoveredRating(star)}
                      onMouseLeave={() => setHoveredRating(0)}
                      className="focus:outline-none"
                    >
                      <Star
                        className={`w-8 h-8 transition-colors ${
                          star <= (hoveredRating || rating)
                            ? 'text-yellow-400 fill-yellow-400'
                            : 'text-gray-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                {rating > 0 && (
                  <span className="text-sm font-medium text-gray-700 ml-2">
                    {rating} {rating === 1 ? 'star' : 'stars'}
                  </span>
                )}
              </div>

              {/* Comment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Comment (Optional)
                </label>
                <textarea
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Share your experience with this SME..."
                />
              </div>
            </div>

            {/* Success Message */}
            {ratingSuccess && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <p className="text-green-800 font-medium">Rating submitted successfully! ✅</p>
              </div>
            )}

            <div className="flex items-center justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => {
                  setRatingModal({ open: false, smeId: null, smeName: '' });
                  setRating(0);
                  setRatingComment('');
                  setRatingSuccess(false);
                }}
                disabled={isSubmittingRating}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitRating}
                disabled={rating === 0 || isSubmittingRating}
                className={rating === 0 || isSubmittingRating ? 'opacity-50 cursor-not-allowed' : ''}
              >
                {isSubmittingRating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Submitting...
                  </>
                ) : (
                  <>
                    <Star className="w-4 h-4 mr-2" />
                    Submit Rating
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Chat Modal */}
      {showChatModal && selectedSeller && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            {/* Chat Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{selectedSeller.seller}</h3>
                    <p className="text-blue-100 text-sm">About: {selectedSeller.title}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowChatModal(false);
                    setSelectedSeller(null);
                    setChatMessages([]);
                  }}
                  className="text-white/80 hover:text-white hover:bg-white/10 p-2 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
              {chatMessages.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No messages yet. Start the conversation!</p>
                </div>
              ) : (
                chatMessages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex ${msg.senderId === user.id ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                        msg.senderId === user.id
                          ? 'bg-blue-600 text-white rounded-br-sm'
                          : 'bg-white border border-gray-200 text-gray-900 rounded-bl-sm'
                      }`}
                    >
                      <p className="text-sm font-medium mb-1 opacity-80">{msg.senderName}</p>
                      <p>{msg.message}</p>
                      <p className="text-xs mt-1 opacity-70">
                        {(() => {
                          try {
                            if (msg.timestamp?.seconds) {
                              return new Date(msg.timestamp.seconds * 1000).toLocaleTimeString('en-ZA', {
                                hour: '2-digit',
                                minute: '2-digit'
                              });
                            } else if (msg.timestamp) {
                              return new Date(msg.timestamp).toLocaleTimeString('en-ZA', {
                                hour: '2-digit',
                                minute: '2-digit'
                              });
                            }
                            return 'Just now';
                          } catch {
                            return 'Just now';
                          }
                        })()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Chat Input */}
            <div className="p-4 border-t border-gray-200 bg-white rounded-b-2xl">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type your message..."
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!chatMessage.trim()}
                  className="px-6 py-3 disabled:opacity-50"
                >
                  <Send className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {showProfileModal && selectedSeller && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            {/* Profile Header */}
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6 rounded-t-2xl relative">
              <button
                onClick={() => {
                  setShowProfileModal(false);
                  setSelectedSeller(null);
                }}
                className="absolute top-4 right-4 text-white/80 hover:text-white hover:bg-white/10 p-2 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="flex items-start space-x-4">
                <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center text-3xl font-bold">
                  {selectedSeller.seller?.charAt(0) || 'U'}
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold mb-2">{selectedSeller.seller}</h3>
                  <div className="flex items-center space-x-2 mb-2">
                    <Badge variant="info" size="sm" className="bg-white/20 border-white/30">
                      {selectedSeller.sellerType}
                    </Badge>
                    {selectedSeller.verified && (
                      <Badge variant="success" size="sm" className="bg-white/20 border-white/30">
                        <Shield className="w-3 h-3 mr-1" />
                        Verified
                      </Badge>
                    )}
                  </div>
                  {selectedSeller.location && (
                    <div className="flex items-center text-white/90 text-sm">
                      <MapPin className="w-4 h-4 mr-1" />
                      {selectedSeller.location}
                    </div>
                  )}
                  {selectedSeller.locations && selectedSeller.locations.length > 1 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedSeller.locations.map((loc: string, idx: number) => (
                        <Badge key={idx} variant="outline" size="sm" className="bg-white/20 border-white/30 text-white">
                          {loc}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Profile Content */}
            <div className="p-6 space-y-6">
              {/* Rating */}
              <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-4">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                  <Star className="w-5 h-5 mr-2 text-yellow-600" />
                  Seller Rating
                </h4>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-6 h-6 ${
                          star <= (selectedSeller.rating ?? 0)
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {Number(selectedSeller.rating ?? 0).toFixed(1)}
                    </p>
                    <p className="text-sm text-gray-600">
                      {selectedSeller.reviews ?? 0} reviews
                    </p>
                  </div>
                </div>
              </div>

              {/* SME-Specific Info */}
              {selectedSeller.sellerType === 'SME' && (
                <>
                  {/* Professional Details */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Professional Details</h4>
                    <div className="space-y-2">
                      {/* Roles */}
                      {selectedSeller.roles && selectedSeller.roles.length > 0 && (
                        <div>
                          <span className="text-sm font-medium text-gray-700">Roles:</span>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {selectedSeller.roles.map((role: string, idx: number) => (
                              <Badge key={idx} variant="info" size="sm">{role}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Experience */}
                      {selectedSeller.experience && (
                        <div>
                          <span className="text-sm font-medium text-gray-700">Experience:</span>
                          <span className="text-sm text-gray-900 ml-2">{selectedSeller.experience}</span>
                        </div>
                      )}
                      {/* Location */}
                      {selectedSeller.locations && selectedSeller.locations.length > 0 ? (
                        <div>
                          <span className="text-sm font-medium text-gray-700">Service Areas:</span>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {selectedSeller.locations.map((loc: string, idx: number) => (
                              <Badge
                                key={idx}
                                variant="outline"
                                size="sm"
                                className="text-gray-700 border-gray-300"
                              >
                                {loc}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ) : selectedSeller.location ? (
                        <div>
                          <span className="text-sm font-medium text-gray-700">Location:</span>
                          <span className="text-sm text-gray-900 ml-2">{selectedSeller.location}</span>
                        </div>
                      ) : null}
                      {/* SETA Registration */}
                      {selectedSeller.setaRegistration && (
                        <div>
                          <span className="text-sm font-medium text-gray-700">SETA Registration:</span>
                          <span className="text-sm text-gray-900 ml-2">{selectedSeller.setaRegistration}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Qualifications */}
                  {selectedSeller.qualifications && selectedSeller.qualifications.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3">Qualifications</h4>
                      <div className="space-y-2">
                        {selectedSeller.qualifications.map((qual: string, idx: number) => (
                          <div key={idx} className="flex items-center space-x-2">
                            <Award className="w-4 h-4 text-blue-600" />
                            <span className="text-sm text-gray-700">{qual}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Rates */}
                  {selectedSeller.rates && Object.keys(selectedSeller.rates).length > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 mb-3">Service Rates</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {selectedSeller.rates.facilitation && (
                          <div>
                            <span className="text-sm font-medium text-gray-700">Facilitation:</span>
                            <span className="text-sm text-gray-900 ml-2 font-semibold">{selectedSeller.rates.facilitation}</span>
                          </div>
                        )}
                        {selectedSeller.rates.assessment && (
                          <div>
                            <span className="text-sm font-medium text-gray-700">Assessment:</span>
                            <span className="text-sm text-gray-900 ml-2 font-semibold">{selectedSeller.rates.assessment}</span>
                          </div>
                        )}
                        {selectedSeller.rates.consultation && (
                          <div>
                            <span className="text-sm font-medium text-gray-700">Consultation:</span>
                            <span className="text-sm text-gray-900 ml-2 font-semibold">{selectedSeller.rates.consultation}</span>
                          </div>
                        )}
                        {selectedSeller.rates.moderation && (
                          <div>
                            <span className="text-sm font-medium text-gray-700">Moderation:</span>
                            <span className="text-sm text-gray-900 ml-2 font-semibold">{selectedSeller.rates.moderation}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Specializations */}
                  {selectedSeller.specializations && selectedSeller.specializations.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3">Specializations</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedSeller.specializations.map((spec: string, idx: number) => (
                          <Badge key={idx} variant="info" size="sm">{spec}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sectors */}
                  {selectedSeller.sectors && selectedSeller.sectors.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3">Sectors</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedSeller.sectors.map((sector: string, idx: number) => (
                          <Badge key={idx} variant="default" size="sm">{sector}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Document Certification */}
                  {hasCertificationDates && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 mb-2">Document Certification</h4>
                      <div className="space-y-1 text-sm text-gray-700">
                        {(selectedSeller.documentCertificationDate || certificationDates.idDocuments) && (
                          <p>
                            ID Documents:{' '}
                            <span className="font-medium">
                              {formatDisplayDate(selectedSeller.documentCertificationDate || certificationDates.idDocuments)}
                            </span>
                          </p>
                        )}
                        {certificationDates.qualificationCerts && (
                          <p>
                            Qualification Certificates:{' '}
                            <span className="font-medium">
                              {formatDisplayDate(certificationDates.qualificationCerts)}
                            </span>
                          </p>
                        )}
                        {certificationDates.setaCertificates && (
                          <p>
                            SETA Certificates:{' '}
                            <span className="font-medium">
                              {formatDisplayDate(certificationDates.setaCertificates)}
                            </span>
                          </p>
                        )}
                      </div>
                      {certificationRenewalLabel && (
                        <p className="text-xs text-gray-500 mt-2">
                          Reminder: renew certification before {certificationRenewalLabel}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Professional Summary */}
                  {(selectedSeller.cv?.professionalSummary || selectedSeller.aboutMe) && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3">Professional Summary</h4>
                      <p className="text-sm text-gray-700 leading-relaxed">
                        {selectedSeller.cv?.professionalSummary || selectedSeller.aboutMe}
                      </p>
                    </div>
                  )}

                  {/* Work Experience */}
                  {selectedSeller.cv?.workExperience && selectedSeller.cv.workExperience.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 mb-3">Work Experience</h4>
                      <div className="space-y-3">
                        {selectedSeller.cv.workExperience.map((exp: any, idx: number) => (
                          <div key={exp.id || idx} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{exp.position}</p>
                                <p className="text-xs text-gray-600">{exp.company}</p>
                              </div>
                              <p className="text-xs text-gray-500">
                                {formatDisplayDate(exp.startDate)} – {exp.current ? 'Present' : formatDisplayDate(exp.endDate)}
                              </p>
                            </div>
                            {exp.description && (
                              <p className="text-sm text-gray-600 mt-2">{exp.description}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Languages */}
                  {selectedSeller.cv?.languages && selectedSeller.cv.languages.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3">Languages</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedSeller.cv.languages.map((lang: any, idx: number) => (
                          <Badge key={idx} variant="info" size="sm">
                            {lang.language} ({lang.proficiency})
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* References */}
                  {selectedSeller.cv?.references && selectedSeller.cv.references.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 mb-3">Professional References</h4>
                      <div className="space-y-3">
                        {selectedSeller.cv.references.map((ref: any, idx: number) => (
                          <div key={ref.id || idx} className="border border-gray-100 rounded-lg p-3">
                            <p className="text-sm font-semibold text-gray-900">{ref.name}</p>
                            {(ref.position || ref.company) && (
                              <p className="text-xs text-gray-600">
                                {[ref.position, ref.company].filter(Boolean).join(' at ')}
                              </p>
                            )}
                            <p className="text-xs text-gray-600 mt-1">{ref.email}</p>
                            <p className="text-xs text-gray-600">{ref.phone}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Past Projects & Reviews */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                  <Briefcase className="w-5 h-5 mr-2 text-blue-600" />
                  Past Projects & Reviews
                </h4>
                <div className="space-y-3">
                  {sellerReviews.length > 0 ? (
                    sellerReviews.map((review) => (
                      <div key={review.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-medium text-gray-900">{review.client}</p>
                            <div className="flex items-center space-x-1 mt-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`w-4 h-4 ${
                                    star <= review.rating
                                      ? 'fill-yellow-400 text-yellow-400'
                                      : 'text-gray-300'
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                          <span className="text-xs text-gray-500">{review.date}</span>
                        </div>
                        {review.comment && (
                          <p className="text-sm text-gray-700">{review.comment}</p>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                      <p className="text-sm text-gray-500">No reviews yet</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Contact Info */}
              {(selectedSeller.email || selectedSeller.phone) && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Contact Information</h4>
                  <div className="space-y-1">
                    {selectedSeller.email && (
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">Email:</span> {selectedSeller.email}
                      </p>
                    )}
                    {selectedSeller.phone && (
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">Phone:</span> {selectedSeller.phone}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Action Button */}
              <Button
                onClick={() => {
                  setShowProfileModal(false);
                  handleContactSeller(selectedSeller);
                }}
                className="w-full"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Contact Seller
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Start Project Modal */}
      {showStartProjectModal && selectedEngagement && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white p-6 border-b border-gray-200 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Start New Project</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    With {selectedEngagement.sme}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowStartProjectModal(false);
                    setSelectedEngagement(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Form */}
            <div className="p-6 space-y-6">
              {/* Project Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={projectForm.projectName}
                  onChange={(e) => setProjectForm({ ...projectForm, projectName: e.target.value })}
                  placeholder="e.g., Skills Development Training Program"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Project Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Type
                </label>
                <select
                  value={projectForm.projectType}
                  onChange={(e) => setProjectForm({ ...projectForm, projectType: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="Consultation">Consultation</option>
                  <option value="Training">Training</option>
                  <option value="Assessment">Assessment</option>
                  <option value="Moderation">Moderation</option>
                  <option value="Facilitation">Facilitation</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={projectForm.startDate}
                    onChange={(e) => setProjectForm({ ...projectForm, startDate: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date (Estimated)
                  </label>
                  <input
                    type="date"
                    value={projectForm.endDate}
                    onChange={(e) => setProjectForm({ ...projectForm, endDate: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Budget */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Budget
                </label>
                <input
                  type="text"
                  value={projectForm.budget}
                  onChange={(e) => setProjectForm({ ...projectForm, budget: e.target.value })}
                  placeholder="e.g., R 50,000"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={projectForm.description}
                  onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                  placeholder="Describe what needs to be done in this project..."
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Deliverables */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expected Deliverables
                </label>
                <textarea
                  value={projectForm.deliverables}
                  onChange={(e) => setProjectForm({ ...projectForm, deliverables: e.target.value })}
                  placeholder="e.g., Training materials, Assessment reports, Certificates..."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Milestones */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Milestones
                </label>
                <textarea
                  value={projectForm.milestones}
                  onChange={(e) => setProjectForm({ ...projectForm, milestones: e.target.value })}
                  placeholder="e.g., Week 1: Planning, Week 2-3: Training delivery, Week 4: Assessment..."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200 rounded-b-2xl flex items-center justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowStartProjectModal(false);
                  setSelectedEngagement(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitProject}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Start Project
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Project Progress Modal */}
      {showProgressModal && selectedProjectForProgress && (
        <ProjectProgressModal
          engagement={selectedProjectForProgress}
          userRole="SDP"
          userId={user.id}
          userName={user.profile.name}
          onClose={() => {
            setShowProgressModal(false);
            setSelectedProjectForProgress(null);
          }}
          onUpdate={() => {
            // Refresh engagements data
            setShowProgressModal(false);
            setSelectedProjectForProgress(null);
          }}
        />
      )}

      {/* Edit Project Modal */}
      {editingProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white p-6 border-b border-gray-200 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Edit Project</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Update project details while it's open in the market
                  </p>
                </div>
                <button
                  onClick={() => {
                    setEditingProject(null);
                    setEditProjectForm({
                      projectName: '',
                      projectType: 'Consultation',
                      startDate: '',
                      endDate: '',
                      budget: 'R2,500',
                      description: '',
                      deliverables: '',
                      milestones: '',
                      thumbnail: ''
                    });
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Form */}
            <div className="p-6 space-y-6">
              {/* Project Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editProjectForm.projectName}
                  onChange={(e) => setEditProjectForm({ ...editProjectForm, projectName: e.target.value })}
                  placeholder="e.g., Skills Development Training Program Q1 2025"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Project Type and Dates */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project Type
                  </label>
                  <select
                    value={editProjectForm.projectType}
                    onChange={(e) => setEditProjectForm({ ...editProjectForm, projectType: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Consultation">Consultation</option>
                    <option value="Training">Training</option>
                    <option value="Assessment">Assessment</option>
                    <option value="Moderation">Moderation</option>
                    <option value="Facilitation">Facilitation</option>
                    <option value="Mentorship">Mentorship</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={editProjectForm.startDate}
                    onChange={(e) => setEditProjectForm({ ...editProjectForm, startDate: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date (Est.)
                  </label>
                  <input
                    type="date"
                    value={editProjectForm.endDate}
                    onChange={(e) => setEditProjectForm({ ...editProjectForm, endDate: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Budget */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Budget
                </label>
                <input
                  type="text"
                  value={editProjectForm.budget}
                  onChange={(e) => setEditProjectForm({ ...editProjectForm, budget: e.target.value })}
                  placeholder="e.g., R 75,000"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Project Thumbnail */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Thumbnail (Optional)
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  {editProjectForm.thumbnail ? (
                    <div className="space-y-4">
                      <img 
                        src={editProjectForm.thumbnail} 
                        alt="Project thumbnail" 
                        className="max-h-48 mx-auto rounded-lg object-cover"
                      />
                      <div className="flex items-center justify-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditProjectForm({ ...editProjectForm, thumbnail: '' })}
                        >
                          <X className="w-4 h-4 mr-2" />
                          Remove
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.onchange = async (e: any) => {
                              const file = e.target.files[0];
                              if (file) {
                                await handleEditThumbnailUpload(file);
                              }
                            };
                            input.click();
                          }}
                          disabled={uploadingEditThumbnail}
                        >
                          {uploadingEditThumbnail ? 'Uploading...' : 'Change Image'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Image className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600 mb-2">Upload a thumbnail image for your project</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.onchange = async (e: any) => {
                            const file = e.target.files[0];
                            if (file) {
                              await handleEditThumbnailUpload(file);
                            }
                          };
                          input.click();
                        }}
                        disabled={uploadingEditThumbnail}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {uploadingEditThumbnail ? 'Uploading...' : 'Choose Image'}
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={editProjectForm.description}
                  onChange={(e) => setEditProjectForm({ ...editProjectForm, description: e.target.value })}
                  placeholder="Describe the project scope, objectives, and requirements..."
                  rows={5}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Deliverables */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expected Deliverables
                </label>
                <textarea
                  value={editProjectForm.deliverables}
                  onChange={(e) => setEditProjectForm({ ...editProjectForm, deliverables: e.target.value })}
                  placeholder="• Training materials&#10;• Assessment reports&#10;• Certificates of completion&#10;• Progress reports"
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Milestones */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Milestones & Timeline
                </label>
                <textarea
                  value={editProjectForm.milestones}
                  onChange={(e) => setEditProjectForm({ ...editProjectForm, milestones: e.target.value })}
                  placeholder="Week 1-2: Needs analysis and planning&#10;Week 3-5: Training delivery&#10;Week 6: Assessment and evaluation&#10;Week 7: Final reports and closure"
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200 rounded-b-2xl flex items-center justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => {
                  setEditingProject(null);
                  setEditProjectForm({
                    projectName: '',
                    projectType: 'Consultation',
                    startDate: '',
                    endDate: '',
                    budget: 'R2,500',
                    description: '',
                    deliverables: '',
                    milestones: '',
                    thumbnail: ''
                  });
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateProject}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Update Project
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Hire SME Modal */}
      {showHireSMEModal && selectedSMEForHire && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Hire {selectedSMEForHire.name}</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Create a project for {selectedSMEForHire.name} to apply to
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setShowHireSMEModal(false);
                  setSelectedSMEForHire(null);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-6 space-y-6">
              {/* SME Info Card */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                    <Users className="w-8 h-8 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{selectedSMEForHire.name}</h3>
                    <p className="text-sm text-gray-600">{selectedSMEForHire.specializations?.join(', ') || 'No specializations listed'}</p>
                    <p className="text-xs text-gray-500 mt-1">Location: {selectedSMEForHire.location || 'Not specified'}</p>
                  </div>
                </div>
              </div>

              {/* Info Message */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800">
                  <strong>Note:</strong> This project will be created and {selectedSMEForHire.name} will be invited to apply. They will receive a notification with the project details.
                </p>
              </div>

              {/* Project Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={hireSMEForm.projectName}
                  onChange={(e) => setHireSMEForm({ ...hireSMEForm, projectName: e.target.value })}
                  placeholder="e.g., Skills Development Training Program Q1 2025"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Project Type and Dates */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project Type
                  </label>
                  <select
                    value={hireSMEForm.projectType}
                    onChange={(e) => setHireSMEForm({ ...hireSMEForm, projectType: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Consultation">Consultation</option>
                    <option value="Training">Training</option>
                    <option value="Assessment">Assessment</option>
                    <option value="Moderation">Moderation</option>
                    <option value="Facilitation">Facilitation</option>
                    <option value="Mentorship">Mentorship</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={hireSMEForm.startDate}
                    onChange={(e) => setHireSMEForm({ ...hireSMEForm, startDate: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date (Est.)
                  </label>
                  <input
                    type="date"
                    value={hireSMEForm.endDate}
                    onChange={(e) => setHireSMEForm({ ...hireSMEForm, endDate: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Budget */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Budget
                </label>
                <input
                  type="text"
                  value={hireSMEForm.budget}
                  onChange={(e) => setHireSMEForm({ ...hireSMEForm, budget: e.target.value })}
                  placeholder="e.g., R 75,000"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Project Thumbnail */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Thumbnail (Optional)
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  {hireSMEForm.thumbnail ? (
                    <div className="space-y-4">
                      <img 
                        src={hireSMEForm.thumbnail} 
                        alt="Project thumbnail" 
                        className="max-h-48 mx-auto rounded-lg object-cover"
                      />
                      <div className="flex items-center justify-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setHireSMEForm({ ...hireSMEForm, thumbnail: '' })}
                        >
                          <X className="w-4 h-4 mr-2" />
                          Remove
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.onchange = async (e: any) => {
                              const file = e.target.files[0];
                              if (file) {
                                await handleHireThumbnailUpload(file);
                              }
                            };
                            input.click();
                          }}
                          disabled={uploadingHireThumbnail}
                        >
                          {uploadingHireThumbnail ? 'Uploading...' : 'Change Image'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Image className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600 mb-2">Upload a thumbnail image for your project</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.onchange = async (e: any) => {
                            const file = e.target.files[0];
                            if (file) {
                              await handleHireThumbnailUpload(file);
                            }
                          };
                          input.click();
                        }}
                        disabled={uploadingHireThumbnail}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {uploadingHireThumbnail ? 'Uploading...' : 'Choose Image'}
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={hireSMEForm.description}
                  onChange={(e) => setHireSMEForm({ ...hireSMEForm, description: e.target.value })}
                  placeholder="Describe the project scope, objectives, and requirements..."
                  rows={5}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Deliverables */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expected Deliverables
                </label>
                <textarea
                  value={hireSMEForm.deliverables}
                  onChange={(e) => setHireSMEForm({ ...hireSMEForm, deliverables: e.target.value })}
                  placeholder="• Training materials&#10;• Assessment reports&#10;• Certificates of completion&#10;• Progress reports"
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Milestones */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Milestones & Timeline
                </label>
                <textarea
                  value={hireSMEForm.milestones}
                  onChange={(e) => setHireSMEForm({ ...hireSMEForm, milestones: e.target.value })}
                  placeholder="Week 1-2: Needs analysis and planning&#10;Week 3-5: Training delivery&#10;Week 6: Assessment and evaluation&#10;Week 7: Final reports and closure"
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowHireSMEModal(false);
                    setSelectedSMEForHire(null);
                    setHireSMEForm({
                      projectName: '',
                      projectType: 'Consultation',
                      startDate: '',
                      endDate: '',
                      budget: 'R2,500',
                      description: '',
                      deliverables: '',
                      milestones: '',
                      thumbnail: ''
                    });
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitHireSME}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Create Project & Invite SME
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
