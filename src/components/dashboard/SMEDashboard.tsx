import React, { useState, useEffect } from 'react';
import { 
  User, 
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
  ShoppingBag,
  Package,
  BookOpen,
  ShoppingCart,
  Tag,
  Image,
  Save,
  ArrowRight,
  X,
  ChevronDown,
  Mail
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
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, listAll, getMetadata } from 'firebase/storage';
import { db, storage, auth, isFirebaseConfigured, isStorageConfigured } from '../../firebase/config';
import { createNotification } from '../../utils/notifications';

interface SMEDashboardProps {
  user: {
    profile: SME;
    id: string;
    email: string;
    role: 'SME';
    verified: boolean;
  };
}

type TabType = 'dashboard' | 'market' | 'engagements' | 'profile' | 'documents' | 'reports' | 'settings';

export function SMEDashboard({ user }: SMEDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  
  // Predefined options matching registration form
  const roles = [
    'Facilitator',
    'Assessor',
    'Moderator',
    'Consultant',
    'Skills Development Coordinator',
    'Training Manager',
    'Other'
  ];

  // Extract firstName and lastName from name (assuming format "FirstName LastName")
  const nameParts = user.profile.name.split(' ');
  const defaultFirstName = nameParts[0] || '';
  const defaultLastName = nameParts.slice(1).join(' ') || '';

  const [profileData, setProfileData] = useState({
    firstName: defaultFirstName,
    lastName: defaultLastName,
    email: user.profile.email,
    phone: (user.profile as any).phone || '',
    idNumber: (user.profile as any).idNumber || '',
    roles: user.profile.roles || (user.profile.role ? [user.profile.role] : []),
    otherRole: (user.profile.roles && user.profile.roles.some((r: string) => !roles.includes(r))) 
      ? user.profile.roles.find((r: string) => !roles.includes(r)) || ''
      : '',
    location: user.profile.location,
    experience: user.profile.experience,
    specializations: user.profile.specializations || [],
    sectors: user.profile.sectors || [],
    qualifications: user.profile.qualifications || [],
    setaRegistration: (user.profile as any).setaRegistration || '',
    rates: user.profile.rates || {
      facilitation: '',
      assessment: '',
      consultation: '',
      moderation: ''
    },
    availability: user.profile.availability,
    aboutMe: user.profile.aboutMe || '',
    profileImage: user.profile.profileImage || '',
    otherSpecialization: (user.profile as any).otherSpecialization || '',
    otherSector: (user.profile as any).otherSector || '',
    otherQualification: (user.profile as any).otherQualification || ''
  });

  const [newSpecialization, setNewSpecialization] = useState('');
  const [newSector, setNewSector] = useState('');
  const [newQualification, setNewQualification] = useState('');
  
  // Chat state
  const [showChatModal, setShowChatModal] = useState(false);
  const [selectedEngagement, setSelectedEngagement] = useState<any>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  
  // Project view modal state
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [viewingProject, setViewingProject] = useState<any>(null);
  
  // Project Progress Modal states
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [selectedProjectForProgress, setSelectedProjectForProgress] = useState<any>(null);
  
  // Availability popout state
  const [showAvailabilityPopout, setShowAvailabilityPopout] = useState(false);

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
    'Manufacturing',
    'Services',
    'Mining',
    'Healthcare',
    'Education',
    'Technology',
    'Finance',
    'Government',
    'Agriculture',
    'Construction'
  ];

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

  const experienceOptions = [
    '1-2 years',
    '3-5 years',
    '6-10 years',
    '10+ years',
    '15+ years'
  ];

  const qualificationsList = [
    'Bachelor\'s Degree',
    'Honours Degree',
    'Master\'s Degree',
    'PhD',
    'ETDP SETA Registration',
    'Assessor Registration',
    'Moderator Registration',
    'Facilitator Registration',
    'Industry Certification'
  ];
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
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
    source?: string;
  }>>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [documentName, setDocumentName] = useState('');
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [documentFilter, setDocumentFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [recoveringDocuments, setRecoveringDocuments] = useState(false);
  const [showTransactionsModal, setShowTransactionsModal] = useState(false);
  const [showMonthlyReportModal, setShowMonthlyReportModal] = useState(false);
  const [showEngagementHistoryModal, setShowEngagementHistoryModal] = useState(false);
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [billingInfo, setBillingInfo] = useState({
    bankName: '',
    accountHolderName: '',
    accountNumber: '',
    accountType: 'Cheque', // Cheque, Savings, Current
    branchCode: '',
    email: '',
    phone: ''
  });
  // Calculate initial rating - ensure it's 0.0 if no reviews (ALWAYS check reviews first)
  const getInitialRating = () => {
    // Return the rating directly from Firebase
    if (user.profile && user.role === 'SME') {
      const smeProfile = user.profile as any;
      return smeProfile.rating || 0.0;
    }
    return 0.0;
  };

  const [stats, setStats] = useState({
    totalEarnings: 'R0',
    totalEarningsThisWeek: 'R0',
    totalPaid: 'R0',
    totalPaidThisWeek: 'R0',
    activeEngagements: 0,
    completedProjects: 0,
    averageRating: getInitialRating()
  });
  const [loading, setLoading] = useState(true);

  // Projects state
  const [availableProjects, setAvailableProjects] = useState<Project[]>([]);
  const [invitedProjects, setInvitedProjects] = useState<Array<{ project: Project; invitation: ProjectApplication }>>([]);
  const [myApplications, setMyApplications] = useState<ProjectApplication[]>([]);
  const [selectedProjectForApplication, setSelectedProjectForApplication] = useState<Project | null>(null);
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [applicationCoverLetter, setApplicationCoverLetter] = useState('');
  const [applicationCV, setApplicationCV] = useState<File | null>(null);
  const [applicationCVUrl, setApplicationCVUrl] = useState('');
  const [uploadingCV, setUploadingCV] = useState(false);
  const [applicationForm, setApplicationForm] = useState({
    experience: '',
    qualifications: '',
    availability: '',
    whyInterested: '',
    relevantSkills: ''
  });

  // Market state
  const [marketView, setMarketView] = useState<'browse' | 'sell' | 'want' | 'want-form' | 'projects'>('projects');
  const [marketSearch, setMarketSearch] = useState('');
  const [marketCategory, setMarketCategory] = useState<string>('all');
  const [marketItems, setMarketItems] = useState<Array<{
    id: string;
    title: string;
    description: string;
    category: string;
    price: string;
    seller: string;
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

  // Load engagements from Firestore
  useEffect(() => {
    // Skip if Firebase not configured, not authenticated, or in demo mode
    if (!user.id || !isFirebaseConfigured() || !auth.currentUser || import.meta.env.VITE_SKIP_FIREBASE_LOGIN === 'true') {
      console.log('⏭️ Skipping engagements load (demo mode or not authenticated)');
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // Set up real-time listener for engagements
    // Note: orderBy removed to avoid composite index requirement
    const engagementsQuery = query(
      collection(db, 'engagements'),
      where('smeId', '==', user.id)
    );

    const unsubscribe = onSnapshot(engagementsQuery, (snapshot) => {
      const engagementsData: Engagement[] = [];
      let totalEarnings = 0;
      let totalEarningsThisWeek = 0;
      let totalPaid = 0;
      let totalPaidThisWeek = 0;

      // Calculate date for one week ago
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      console.log(`SME (${user.id}) loading engagements. Found ${snapshot.size} documents`);

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        console.log('Engagement data:', { id: docSnap.id, ...data });
        
        const engagement: Engagement = {
          id: docSnap.id,
          sme: data.sme || user.profile.name,
          smeId: data.smeId || user.id,
          sdp: data.sdp || '',
          sdpId: data.sdpId || '',
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
          fundsReleasedAt: data.fundsReleasedAt,
          paymentConfirmedByAdmin: data.paymentConfirmedByAdmin || false,
          paymentConfirmedAt: data.paymentConfirmedAt,
          paymentConfirmedBy: data.paymentConfirmedBy,
          paymentConfirmationComment: data.paymentConfirmationComment
        };
        
        engagementsData.push(engagement);
        
        // Parse fee value
        const feeValue = engagement.fee ? parseFloat(engagement.fee.replace(/[^0-9.]/g, '')) : 0;
        
        // Calculate earnings from completed engagements (marked complete by SME)
        if (engagement.status === 'Completed' && !isNaN(feeValue)) {
          totalEarnings += feeValue;
          
          // Check if completed this week
          if (engagement.smeCompletedAt) {
            const completedDate = engagement.smeCompletedAt.seconds 
              ? new Date(engagement.smeCompletedAt.seconds * 1000)
              : new Date(engagement.smeCompletedAt);
            
            if (completedDate >= oneWeekAgo) {
              totalEarningsThisWeek += feeValue;
            }
          }
        }
        
        // Calculate paid amounts (funds released by SDP AND confirmed paid by Admin)
        if (engagement.status === 'Completed' && engagement.fundsReleasedAt && (engagement as any).paymentConfirmedByAdmin && !isNaN(feeValue)) {
          totalPaid += feeValue;
          
          // Check if payment confirmed this week
          const paidDate = (engagement as any).paymentConfirmedAt
            ? ((engagement as any).paymentConfirmedAt.seconds
              ? new Date((engagement as any).paymentConfirmedAt.seconds * 1000)
              : new Date((engagement as any).paymentConfirmedAt))
            : (engagement.fundsReleasedAt.seconds
              ? new Date(engagement.fundsReleasedAt.seconds * 1000)
              : new Date(engagement.fundsReleasedAt));
          
          if (paidDate >= oneWeekAgo) {
            totalPaidThisWeek += feeValue;
          }
        }
      });

      // Sort engagements by date (most recent first)
      engagementsData.sort((a, b) => {
        const dateA = new Date(a.startDate || 0).getTime();
        const dateB = new Date(b.startDate || 0).getTime();
        return dateB - dateA;
      });

      setEngagements(engagementsData);
      
      // Calculate stats from real data
      // Display rating directly from Firebase
      const smeProfile = user.profile as any;
      const displayRating = smeProfile.rating || 0.0;
      
      setStats({
        totalEarnings: `R${totalEarnings.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        totalEarningsThisWeek: `R${totalEarningsThisWeek.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        totalPaid: `R${totalPaid.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        totalPaidThisWeek: `R${totalPaidThisWeek.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        activeEngagements: engagementsData.filter((e) => e.status === 'In Progress').length,
        completedProjects: engagementsData.filter((e) => e.status === 'Completed').length,
        averageRating: displayRating
      });
      
      setLoading(false);
    }, (error) => {
      console.error('Error loading engagements:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user.id, user.profile.name, user.profile.rating]);

  // Real-time listener for user verification status updates
  useEffect(() => {
    if (!user.id || !isFirebaseConfigured() || !auth.currentUser || import.meta.env.VITE_SKIP_FIREBASE_LOGIN === 'true') {
      return;
    }

    const userDocRef = doc(db, 'users', user.id);
    
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const userData = docSnap.data();
        const profile = userData.profile || {};
        
        // Update local storage with latest verification status
        const cached = localStorage.getItem('edulinker_user');
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed && parsed.profile) {
              parsed.profile.verified = profile.verified || false;
              parsed.profile.rejected = profile.rejected || userData.rejected || false;
              parsed.verified = userData.verified || profile.verified || false;
              parsed.rejected = userData.rejected || profile.rejected || false;
              localStorage.setItem('edulinker_user', JSON.stringify(parsed));
              
              // Dispatch custom event to notify App.tsx of user data change
              window.dispatchEvent(new CustomEvent('userDataChanged', { detail: parsed }));
            }
          } catch (error) {
            console.error('Error updating cached user data:', error);
          }
        }
      }
    }, (error) => {
      console.error('Error listening to user document:', error);
    });

    return () => unsubscribe();
  }, [user.id]);

  // Load documents from Firestore or localStorage
  useEffect(() => {
    if (!user.id) return;

    // If Firebase is not configured OR we're in demo/skip-auth mode OR not signed in, load from localStorage
    const skipFirebaseLogin = import.meta.env.VITE_SKIP_FIREBASE_LOGIN === 'true';
    const notSignedIn = !auth?.currentUser;

    if (!isFirebaseConfigured() || skipFirebaseLogin || notSignedIn) {
      try {
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
            size: doc.size || '0 KB',
            date: dateText,
            url: doc.url || '',
            reviewStatus: doc.reviewStatus || 'pending',
            reviewComment: doc.reviewComment || '',
            reviewedBy: doc.reviewedBy || '',
            reviewedAt: doc.reviewedAt ? new Date(doc.reviewedAt) : undefined,
            source: doc.source || 'manual',
            isLocalStorage: true
          };
        });
        
        setDocuments(documentsData);
      } catch (error) {
        console.error('Error loading documents from localStorage:', error);
      }
      return;
    }

    // Firebase is configured and user is signed in - load from Firestore
    const documentsQuery = query(
      collection(db, 'users', user.id, 'documents'),
      orderBy('uploadedAt', 'desc')
    );

    const unsubscribe = onSnapshot(documentsQuery, async (snapshot) => {
      const documentsData: Array<{
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
        source?: string;
      }> = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const uploadedDate = data.uploadedAt?.toDate ? data.uploadedAt.toDate() : new Date(data.uploadedAt || Date.now());
        const daysAgo = Math.floor((Date.now() - uploadedDate.getTime()) / (1000 * 60 * 60 * 24));
        const dateText = daysAgo === 0 ? 'Just now' : daysAgo === 1 ? '1 day ago' : `${daysAgo} days ago`;
        
        documentsData.push({
          id: docSnap.id,
          name: data.name || 'Document',
          type: data.type || 'PDF',
          size: data.size || '0 KB',
          date: dateText,
          url: data.url || '',
          reviewStatus: data.reviewStatus || 'pending',
          reviewComment: data.reviewComment || '',
          reviewedBy: data.reviewedBy || '',
          reviewedAt: data.reviewedAt?.toDate ? data.reviewedAt.toDate() : undefined,
          source: data.source || 'manual'
        });
      });

      // Check for registration documents in Storage that might not be in Firestore
      // This helps recover documents from users who registered before the upload code was added
      if (isStorageConfigured()) {
        const storagePaths = [
          `user-documents/${user.id}`,
          `users/${user.id}/documents`,
          `registration-documents/${user.id}`
        ];
        
        for (const storagePath of storagePaths) {
          try {
            const storageRef = ref(storage, storagePath);
            const storageList = await listAll(storageRef);
            
            // Check each file in storage
            for (const itemRef of storageList.items) {
              try {
                const downloadURL = await getDownloadURL(itemRef);
                const fileName = itemRef.name;
                
                // Check if this document already exists in Firestore by URL
                const existingDoc = documentsData.find(d => d.url === downloadURL);
                if (!existingDoc) {
                  // Extract document name from filename (remove timestamp prefix)
                  const nameMatch = fileName.match(/^\d+_(.+?)(\.\w+)?$/);
                  const docName = nameMatch 
                    ? nameMatch[1].replace(/_/g, ' ') 
                    : fileName.replace(/\.\w+$/, '').replace(/_/g, ' ');
                  
                  try {
                    // Get file metadata
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
                    
                    console.log(`✅ Recovered registration document: ${docName}`);
                  } catch (metaError: any) {
                    // If metadata fetch fails, use defaults
                    await addDoc(collection(db, 'users', user.id, 'documents'), {
                      name: docName,
                      type: fileName.toLowerCase().endsWith('.pdf') ? 'PDF' : 'Document',
                      size: 'Unknown',
                      url: downloadURL,
                      uploadedAt: Timestamp.now(),
                      reviewStatus: 'pending',
                      source: 'registration'
                    });
                    console.log(`✅ Recovered registration document (with defaults): ${docName}`);
                  }
                }
              } catch (error: any) {
                console.error(`Error processing storage item ${itemRef.name}:`, error);
              }
            }
          } catch (storageError: any) {
            // Storage folder might not exist yet, which is fine
            if (storageError.code !== 'storage/object-not-found' && storageError.code !== 'storage/unauthorized') {
              console.log(`Storage path ${storagePath} not found or inaccessible (this is normal)`);
            }
          }
        }
      }

      setDocuments(documentsData);
    }, (error) => {
      console.error('Error loading documents:', error);
    });

    return () => unsubscribe();
  }, [user.id]);

  // Load billing information from Firestore
  useEffect(() => {
    if (!user.id || !isFirebaseConfigured()) return;

    const loadBillingInfo = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.id));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.billingInfo) {
            setBillingInfo({
              bankName: data.billingInfo.bankName || '',
              accountHolderName: data.billingInfo.accountHolderName || '',
              accountNumber: data.billingInfo.accountNumber || '',
              accountType: data.billingInfo.accountType || 'Cheque',
              branchCode: data.billingInfo.branchCode || '',
              email: data.billingInfo.email || user.email || '',
              phone: data.billingInfo.phone || (user.profile as any).phone || ''
            });
          } else {
            // Initialize with user email and phone if available
            setBillingInfo(prev => ({
              ...prev,
              email: user.email || '',
              phone: (user.profile as any).phone || ''
            }));
          }
        }
      } catch (error) {
        console.error('Error loading billing info:', error);
      }
    };

    loadBillingInfo();
  }, [user.id, user.email]);

  // Load Recent Activities for SME
  useEffect(() => {
    if (!isFirebaseConfigured() || !user.id) return;

    const loadRecentActivities = async () => {
      try {
        const activities: any[] = [];

        // 1. Get recent engagements
        let engagementsQuery;
        try {
          engagementsQuery = query(
            collection(db, 'engagements'),
            where('smeId', '==', user.id),
            orderBy('updatedAt', 'desc'),
            limit(10)
          );
        } catch (error) {
          engagementsQuery = query(
            collection(db, 'engagements'),
            where('smeId', '==', user.id),
            limit(10)
          );
        }

        const engagementsSnapshot = await getDocs(engagementsQuery);
        engagementsSnapshot.forEach((docSnap) => {
          const engagement = docSnap.data() as any;
          const sdpName = engagement.sdpName || 'SDP';
          
          if (engagement.status === 'Pending') {
            activities.push({
              id: `engagement-${docSnap.id}`,
              type: 'engagement_request',
              message: `New engagement request from ${sdpName}`,
              timestamp: engagement.createdAt || engagement.updatedAt,
              color: 'blue',
              icon: 'briefcase'
            });
          } else if (engagement.status === 'In Progress' && engagement.projectStartedAt) {
            activities.push({
              id: `project-${docSnap.id}`,
              type: 'project_started',
              message: `Project started with ${sdpName}`,
              timestamp: engagement.projectStartedAt,
              color: 'green',
              icon: 'play'
            });
          } else if (engagement.status === 'Completed') {
            activities.push({
              id: `completed-${docSnap.id}`,
              type: 'project_completed',
              message: `Project completed with ${sdpName}`,
              timestamp: engagement.completedAt || engagement.updatedAt,
              color: 'purple',
              icon: 'check-circle'
            });
          } else if (engagement.paymentConfirmedByAdmin && engagement.paymentConfirmedAt) {
            activities.push({
              id: `payment-${docSnap.id}`,
              type: 'payment_confirmed',
              message: `Payment confirmed for project with ${sdpName}`,
              timestamp: engagement.paymentConfirmedAt,
              color: 'green',
              icon: 'dollar'
            });
          }
        });

        // 2. Get recent chat messages from SDPs
        let chatsQuery;
        try {
          chatsQuery = query(
            collection(db, 'chats'),
            where('smeId', '==', user.id),
            orderBy('lastMessageAt', 'desc'),
            limit(5)
          );
        } catch (error) {
          chatsQuery = query(
            collection(db, 'chats'),
            where('smeId', '==', user.id),
            limit(5)
          );
        }

        const chatsSnapshot = await getDocs(chatsQuery);
        for (const chatDoc of chatsSnapshot.docs) {
          const chat = chatDoc.data() as any;
          const messagesQuery = query(
            collection(db, 'chats', chatDoc.id, 'messages'),
            orderBy('timestamp', 'desc'),
            limit(1)
          );
          const messagesSnapshot = await getDocs(messagesQuery);
          messagesSnapshot.forEach((msgDoc) => {
            const message = msgDoc.data() as any;
            if (message.senderId !== user.id) {
              activities.push({
                id: `message-${msgDoc.id}`,
                type: 'message',
                message: `New message from ${chat.sdpName || 'SDP'}`,
                timestamp: message.timestamp,
                color: 'blue',
                icon: 'message'
              });
            }
          });
        }

        // 3. Get recent ratings received
        const ratingsQuery = query(
          collection(db, 'smeRatings'),
          where('smeId', '==', user.id),
          orderBy('createdAt', 'desc'),
          limit(5)
        );

        const ratingsSnapshot = await getDocs(ratingsQuery);
        ratingsSnapshot.forEach((ratingDoc) => {
          const rating = ratingDoc.data() as any;
          activities.push({
            id: `rating-${ratingDoc.id}`,
            type: 'rating',
            message: `Received ${rating.rating} star rating from ${rating.sdpName || 'SDP'}`,
            timestamp: rating.createdAt,
            color: 'yellow',
            icon: 'star'
          });
        });

        // Sort by timestamp and limit to 5 most recent
        activities.sort((a, b) => {
          const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp?.getTime ? a.timestamp.getTime() : 0);
          const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp?.getTime ? b.timestamp.getTime() : 0);
          return timeB - timeA;
        });

        setRecentActivities(activities.slice(0, 5));
      } catch (error: any) {
        if (error.code === 'failed-precondition') {
          // Index missing - this is expected, try without orderBy
          console.log('ℹ️ Recent activities index missing. Using fallback query.');
          try {
            const fallbackQuery = query(
              collection(db, 'engagements'),
              where('smeId', '==', user.id)
            );
            const snapshot = await getDocs(fallbackQuery);
            const activities: any[] = [];
            snapshot.forEach((doc) => {
              const data = doc.data();
              activities.push({
                id: doc.id,
                type: 'engagement',
                title: `${data.type} with ${data.sdp}`,
                description: data.description || '',
                timestamp: data.updatedAt || data.createdAt,
                status: data.status
              });
            });
            // Sort manually
            activities.sort((a, b) => {
              const aTime = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0;
              const bTime = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0;
              return bTime - aTime;
            });
            setRecentActivities(activities.slice(0, 5));
          } catch (fallbackError) {
            console.error('Error loading recent activities (fallback):', fallbackError);
          }
        } else {
          console.error('Error loading recent activities:', error);
        }
      }
    };

    loadRecentActivities();

    // Set up real-time listener
    const unsubscribe = onSnapshot(
      query(
        collection(db, 'engagements'),
        where('smeId', '==', user.id)
      ),
      () => {
        loadRecentActivities();
      }
    );

    return () => unsubscribe();
  }, [user.id]);

  // Load available projects from Firestore
  // This loads ALL projects with status 'open' - no user-specific filters
  // Ensures every project posted to market is visible to all SMEs
  useEffect(() => {
    if (!isFirebaseConfigured()) {
      console.log('⏭️ Skipping projects load (demo mode or not authenticated)');
      return;
    }

    console.log('📋 Loading all available projects from market...');

    // Query all projects with status 'open' - these are all projects available for application
    // No user-specific filters - all SMEs see all open projects
    const projectsQuery = query(
      collection(db, 'projects'),
      where('status', '==', 'open'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(projectsQuery, (snapshot) => {
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
          thumbnail: data.thumbnail || '',
          status: data.status || 'open',
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          applicationsCount: data.applicationsCount || 0
        });
      });

      console.log(`✅ Successfully loaded ${projectsData.length} open project(s) from market`);
      if (projectsData.length === 0) {
        console.log('ℹ️ No open projects found in market. Projects will appear here once SDPs post them.');
      }
      setAvailableProjects(projectsData);
    }, (error: any) => {
      // Check if it's an index error first
      if (error.code === 'failed-precondition') {
        // Index missing - this is expected, fallback will be used
        console.log('ℹ️ Projects index missing. Using fallback query.');
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
              thumbnail: data.thumbnail || '',
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

          console.log(`✅ Loaded ${projectsData.length} open project(s) from market (fallback, sorted manually)`);
          setAvailableProjects(projectsData);
        }, (fallbackError) => {
          console.error('❌ Error loading projects (fallback also failed):', fallbackError);
          setAvailableProjects([]);
        });

        return () => fallbackUnsubscribe();
      } else {
        // Other errors - log them
        console.error('❌ Error loading projects from market:', error);
        setAvailableProjects([]);
      }
    });

    return () => unsubscribe();
  }, []);

  // Load my applications from Firestore
  useEffect(() => {
    if (!user.id || !isFirebaseConfigured()) {
      return;
    }

    const applicationsQuery = query(
      collection(db, 'projectApplications'),
      where('smeId', '==', user.id),
      orderBy('appliedAt', 'desc')
    );

    const unsubscribe = onSnapshot(applicationsQuery, (snapshot) => {
      const applicationsData: ProjectApplication[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        applicationsData.push({
          id: docSnap.id,
          projectId: data.projectId || '',
          projectName: data.projectName || '',
          smeId: data.smeId || '',
          smeName: data.smeName || '',
          smeEmail: data.smeEmail || '',
          coverLetter: data.coverLetter || '',
          status: data.status || 'pending',
          appliedAt: data.appliedAt,
          reviewedAt: data.reviewedAt,
          reviewedBy: data.reviewedBy,
          rejectionReason: data.rejectionReason
        });
      });

      setMyApplications(applicationsData);
    }, (error: any) => {
      if (error.code === 'failed-precondition') {
        // Index missing - try without orderBy
        console.log('ℹ️ Project applications index missing. Using fallback query.');
        const fallbackQuery = query(
          collection(db, 'projectApplications'),
          where('smeId', '==', user.id)
        );
        const fallbackUnsubscribe = onSnapshot(fallbackQuery, (snapshot) => {
          const applicationsData: ProjectApplication[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
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
          });
          // Sort manually
          applicationsData.sort((a, b) => {
            const aTime = a.appliedAt?.toDate ? a.appliedAt.toDate().getTime() : 0;
            const bTime = b.appliedAt?.toDate ? b.appliedAt.toDate().getTime() : 0;
            return bTime - aTime;
          });
          setMyApplications(applicationsData);
        }, (fallbackError) => {
          console.error('Error loading applications (fallback):', fallbackError);
        });
        return () => fallbackUnsubscribe();
      } else {
        console.error('Error loading my applications:', error);
      }
    });

    return () => unsubscribe();
  }, [user.id]);

  // Load invited projects (projectApplications with status 'invited')
  useEffect(() => {
    if (!user.id || !isFirebaseConfigured()) {
      return;
    }

    console.log('📨 Loading invited projects...');

    const invitedQuery = query(
      collection(db, 'projectApplications'),
      where('smeId', '==', user.id),
      where('status', '==', 'invited')
    );

    const unsubscribe = onSnapshot(invitedQuery, async (snapshot) => {
      const invitedData: Array<{ project: Project; invitation: ProjectApplication }> = [];

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const projectId = data.projectId;

        if (projectId) {
          try {
            // Fetch the project details
            const projectDoc = await getDoc(doc(db, 'projects', projectId));
            if (projectDoc.exists()) {
              const projectData = projectDoc.data();
              const project: Project = {
                id: projectDoc.id,
                sdpId: projectData.sdpId || '',
                sdpName: projectData.sdpName || '',
                projectName: projectData.projectName || projectData.name || '',
                projectType: projectData.projectType || projectData.type || '',
                description: projectData.description || '',
                budget: projectData.budget || '',
                startDate: projectData.startDate || '',
                endDate: projectData.endDate || '',
                status: projectData.status || 'open',
                thumbnail: projectData.thumbnail || '',
                deliverables: projectData.deliverables || '',
                milestones: projectData.milestones || [],
                createdAt: projectData.createdAt,
                updatedAt: projectData.updatedAt
              };

              const invitation: ProjectApplication = {
                id: docSnap.id,
                projectId: data.projectId || '',
                projectName: data.projectName || project.projectName,
                smeId: data.smeId || '',
                smeName: data.smeName || '',
                smeEmail: data.smeEmail || '',
                coverLetter: data.coverLetter || '',
                status: data.status || 'invited',
                appliedAt: data.appliedAt,
                reviewedAt: data.reviewedAt,
                reviewedBy: data.reviewedBy,
                rejectionReason: data.rejectionReason,
                invitedBy: data.invitedBy,
                invitedAt: data.invitedAt
              };

              invitedData.push({ project, invitation });
            }
          } catch (error) {
            console.error(`Error loading project ${projectId}:`, error);
          }
        }
      }

      console.log(`✅ Loaded ${invitedData.length} invited project(s)`);
      setInvitedProjects(invitedData);
    }, (error: any) => {
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        return; // Ignore abort errors
      }
      console.error('Error loading invited projects:', error);
      setInvitedProjects([]);
    });

    return () => unsubscribe();
  }, [user.id]);

  // Load market items from Firestore
  useEffect(() => {
    // Skip if Firebase not configured or not authenticated
    if (!isFirebaseConfigured() || !auth.currentUser || import.meta.env.VITE_SKIP_FIREBASE_LOGIN === 'true') {
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
          sellerType: data.sellerType || 'SME',
          location: data.location || '',
          image: data.imageUrl || '/images/collaboration.jpg',
          date: dateText,
          verified: data.verified || false
        });
      });
      setMarketItems(items);
    }, (error: any) => {
      if (error.code === 'failed-precondition') {
        // Index missing - this is expected, fallback will be used
        console.log('ℹ️ Market items index missing. Using fallback query.');
        // Try without orderBy
        const fallbackQuery = query(
          collection(db, 'marketItems'),
          where('status', '==', 'active')
        );
        const fallbackUnsubscribe = onSnapshot(fallbackQuery, (snapshot) => {
          const items: any[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            const dateText = data.createdAt?.toDate ? data.createdAt.toDate().toLocaleDateString() : 'N/A';
            items.push({
              id: doc.id,
              title: data.title || '',
              description: data.description || '',
              category: data.category || '',
              price: data.price || '',
              image: data.imageUrl || '/images/collaboration.jpg',
              location: data.location || '',
              seller: data.sellerName || '',
              sellerId: data.sellerId || '',
              sellerType: data.sellerType || 'SDP',
              date: dateText,
              verified: data.verified || false
            });
          });
          // Sort manually
          items.sort((a, b) => {
            const aTime = a.date === 'N/A' ? 0 : new Date(a.date).getTime();
            const bTime = b.date === 'N/A' ? 0 : new Date(b.date).getTime();
            return bTime - aTime;
          });
          setMarketItems(items);
        });
        return () => fallbackUnsubscribe();
      } else {
        console.error('Error loading market items:', error);
      }
    });

    return () => unsubscribe();
  }, []);

  // Load want ads from Firestore
  useEffect(() => {
    // Skip if Firebase not configured or not authenticated
    if (!isFirebaseConfigured() || !auth.currentUser || import.meta.env.VITE_SKIP_FIREBASE_LOGIN === 'true') {
      console.log('⏭️ Skipping want ads load (demo mode or not authenticated)');
      return;
    }

    const wantItemsQuery = query(
      collection(db, 'wantAds'),
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
          category: data.category || 'Other',
          budget: data.budget || '',
          buyer: data.buyerName || '',
          buyerType: data.buyerType || 'SME',
          location: data.location || '',
          date: dateText
        });
      });
      setWantItems(items);
    }, (error: any) => {
      if (error.code === 'failed-precondition') {
        // Index missing - try without orderBy
        console.log('ℹ️ Want ads index missing. Using fallback query.');
        const fallbackQuery = query(
          collection(db, 'wantAds'),
          where('status', '==', 'active')
        );
        const fallbackUnsubscribe = onSnapshot(fallbackQuery, (snapshot) => {
          const items: any[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            const dateText = data.createdAt?.toDate ? data.createdAt.toDate().toLocaleDateString() : 'N/A';
            items.push({
              id: doc.id,
              title: data.title || '',
              description: data.description || '',
              category: data.category || '',
              budget: data.budget || '',
              buyer: data.buyerName || '',
              buyerType: data.buyerType || 'SME',
              location: data.location || '',
              date: dateText
            });
          });
          // Sort manually
          items.sort((a, b) => {
            const aTime = a.date === 'N/A' ? 0 : new Date(a.date).getTime();
            const bTime = b.date === 'N/A' ? 0 : new Date(b.date).getTime();
            return bTime - aTime;
          });
          setWantItems(items);
        }, (fallbackError) => {
          console.error('Error loading want ads (fallback):', fallbackError);
        });
        return () => fallbackUnsubscribe();
      } else {
        console.error('Error loading want ads:', error);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleExport = () => {
    const dataStr = JSON.stringify(engagements, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sme-engagements-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    alert('Projects exported successfully!');
  };

  const handleUpdateAvailability = async (newAvailability: 'Available' | 'Busy' | 'Offline' | 'Away') => {
    if (!user.id) {
      alert('User ID not found');
      return;
    }

    if (!isFirebaseConfigured()) {
      alert('Firebase not configured. Availability cannot be updated.');
      return;
    }

    try {
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, {
        'profile.availability': newAvailability,
        updatedAt: Timestamp.now()
      });

      // Update local state
      setProfileData({ ...profileData, availability: newAvailability });

      // Update local cache
      const cached = localStorage.getItem('edulinker_user');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.profile) {
          parsed.profile.availability = newAvailability;
          localStorage.setItem('edulinker_user', JSON.stringify(parsed));
          // Dispatch custom event to notify App.tsx of user data change
          window.dispatchEvent(new CustomEvent('userDataChanged', { detail: parsed }));
        }
      }

      setShowAvailabilityPopout(false);
    } catch (error: any) {
      console.error('Error updating availability:', error);
      alert('Error updating availability: ' + error.message);
    }
  };

  const handleSaveProfile = async () => {
    if (!user.id) {
      alert('User ID not found');
      return;
    }

    if (!isFirebaseConfigured()) {
      alert('Firebase not configured. Profile cannot be saved.');
      return;
    }

    try {
      const userRef = doc(db, 'users', user.id);
      
      // Prepare profile data for Firestore
      const profileUpdate = {
        profile: {
          ...user.profile,
          name: `${profileData.firstName} ${profileData.lastName}`,
          email: profileData.email,
          roles: profileData.roles.includes('Other') && profileData.otherRole.trim()
            ? [...profileData.roles.filter(r => r !== 'Other'), profileData.otherRole.trim()]
            : profileData.roles.filter(r => r !== 'Other').concat(profileData.otherRole.trim() ? [profileData.otherRole.trim()] : []),
          location: profileData.location,
          experience: profileData.experience,
          specializations: profileData.specializations,
          sectors: profileData.sectors,
          qualifications: profileData.qualifications,
          rates: profileData.rates,
          availability: profileData.availability,
          aboutMe: profileData.aboutMe,
          profileImage: profileData.profileImage,
          phone: profileData.phone,
          idNumber: profileData.idNumber,
          setaRegistration: profileData.setaRegistration,
          otherSpecialization: profileData.otherSpecialization,
          otherSector: profileData.otherSector,
          otherQualification: profileData.otherQualification
        },
        updatedAt: Timestamp.now()
      };

      await updateDoc(userRef, profileUpdate);
      alert('Profile saved successfully!');
    } catch (error: any) {
      console.error('Error saving profile:', error);
      alert('Error saving profile: ' + error.message);
    }
  };

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

    // If Firebase is not configured, use localStorage fallback
    if (!isFirebaseConfigured() || !isStorageConfigured()) {
      try {
        // Convert file to base64 for localStorage storage
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const base64Data = e.target?.result as string;
            
            // Create document data
            const documentData = {
              id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              name: documentName.trim(),
              originalFileName: uploadingFile.name,
              type: uploadingFile.type || 'application/pdf',
              size: `${(uploadingFile.size / 1024).toFixed(0)} KB`,
              url: base64Data, // Store base64 data as URL
              uploadedAt: new Date().toISOString(),
              reviewStatus: 'pending' as const,
              uploadedBy: user.id,
              uploadedByName: user.profile.name,
              isLocalStorage: true // Flag to indicate this is stored locally
            };

            // Save to localStorage
            const storageKey = `edulinker_documents_${user.id}`;
            const existingDocs = JSON.parse(localStorage.getItem(storageKey) || '[]');
            existingDocs.push(documentData);
            localStorage.setItem(storageKey, JSON.stringify(existingDocs));

            // Also save to review queue in localStorage
            const reviewKey = 'edulinker_document_reviews';
            const existingReviews = JSON.parse(localStorage.getItem(reviewKey) || '[]');
            existingReviews.push({
              ...documentData,
              userId: user.id,
              userRole: user.role,
              userName: user.profile.name,
              userEmail: user.email
            });
            localStorage.setItem(reviewKey, JSON.stringify(existingReviews));

            alert(`Document "${documentName.trim()}" uploaded successfully! (Stored locally - Firebase not configured)\n\nNote: Documents stored locally will be lost if you clear browser data. Please configure Firebase for persistent storage.`);
            setShowUploadModal(false);
            setDocumentName('');
            setUploadingFile(null);
            
            // Refresh documents list
            window.location.reload();
          } catch (error: any) {
            console.error('Error saving document to localStorage:', error);
            alert('Error saving document: ' + error.message);
          }
        };
        reader.onerror = () => {
          alert('Error reading file. Please try again.');
        };
        reader.readAsDataURL(uploadingFile);
        return;
      } catch (error: any) {
        console.error('Error in localStorage fallback:', error);
        alert('Error uploading document: ' + error.message);
        return;
      }
    }

    // Firebase is configured - use Firebase Storage
    try {
      // Upload file to Firebase Storage with error handling
      const fileRef = ref(storage, `users/${user.id}/documents/${Date.now()}_${uploadingFile.name}`);
      
      // Show upload progress (optional - for better UX)
      console.log('Uploading document to Firebase Storage...');
      
      await uploadBytes(fileRef, uploadingFile);
      console.log('Document uploaded successfully, getting download URL...');
      
      const downloadURL = await getDownloadURL(fileRef);
      console.log('Download URL obtained:', downloadURL);

      // Save document metadata to Firestore with review status
      const documentData = {
        name: documentName.trim(),
        originalFileName: uploadingFile.name,
        type: uploadingFile.type || 'application/pdf',
        size: `${(uploadingFile.size / 1024).toFixed(0)} KB`,
        url: downloadURL,
        uploadedAt: Timestamp.now(),
        reviewStatus: 'pending', // All documents start as pending
        uploadedBy: user.id,
        uploadedByName: user.profile.name,
        source: 'manual' // Documents uploaded manually from dashboard
      };

      const docRef = await addDoc(collection(db, 'users', user.id, 'documents'), documentData);
      
      // Also add to admin review queue
      await addDoc(collection(db, 'documentReviews'), {
        ...documentData,
        userId: user.id,
        userRole: user.role,
        userName: user.profile.name,
        userEmail: user.email,
        reviewStatus: 'pending',
        documentId: docRef.id // Reference to the document in user's collection
      });

      alert(`Document "${documentName.trim()}" uploaded successfully! It is now pending admin review.`);
      setShowUploadModal(false);
      setDocumentName('');
      setUploadingFile(null);
    } catch (error: any) {
      console.error('Error uploading document:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Error uploading document: ';
      if (error.code === 'storage/unauthorized') {
        errorMessage += 'You do not have permission to upload files. Please check your Firebase Storage rules.';
      } else if (error.code === 'storage/canceled') {
        errorMessage += 'Upload was canceled.';
      } else if (error.code === 'storage/unknown') {
        errorMessage += 'An unknown error occurred. Please check your Firebase Storage configuration.';
      } else if (error.code === 'storage/quota-exceeded') {
        errorMessage += 'Storage quota exceeded. Please contact support.';
      } else {
        errorMessage += error.message || 'Unknown error occurred';
      }
      
      alert(errorMessage);
    }
  };

  const handleDownloadReport = (type: string) => {
    alert(`${type} report download initiated!`);
    // In a real app, this would generate and download the report
  };

  const handleViewDocument = async (docId: string) => {
    const doc = documents.find(d => d.id === docId);
    if (!doc) {
      alert('Document not found');
      return;
    }

    if (!doc.url) {
      alert('Document URL not available. The document may not have been uploaded correctly.');
      return;
    }

    try {
      // Check if this is a localStorage document (base64 data URL)
      const docAny = doc as any;
      if (docAny.isLocalStorage && doc.url.startsWith('data:')) {
        // It's a base64 data URL - open directly
        window.open(doc.url, '_blank');
        return;
      }

      // Firebase Storage document - open URL
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
      alert('Document URL not available. The document may not have been uploaded correctly.');
      return;
    }

    try {
      // Check if this is a localStorage document (base64 data)
      const docAny = doc as any;
      if (docAny.isLocalStorage && doc.url.startsWith('data:')) {
        // It's a base64 data URL - download directly
        const link = document.createElement('a');
        link.href = doc.url;
        link.download = doc.name || 'document';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }

      // Firebase Storage document - fetch and download
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

  const handleManageEngagement = async (engagementId: string) => {
    const engagement = engagements.find(e => e.id === engagementId);
    if (!engagement || !engagement.sdpId) {
      alert('Unable to load chat. SDP information is missing.');
      return;
    }

    setSelectedEngagement(engagement);
    setShowChatModal(true);

    // Load chat messages
    if (isFirebaseConfigured()) {
      try {
        const chatId = [user.id, engagement.sdpId].sort().join('_');
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

  const handleSendEngagementMessage = async () => {
    if (!chatMessage.trim() || !selectedEngagement || !selectedEngagement.sdpId) return;

    const messageText = chatMessage.trim();
    const newMessage = {
      senderId: user.id,
      senderName: user.profile.name,
      receiverId: selectedEngagement.sdpId,
      receiverName: selectedEngagement.sdp,
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
        const chatId = [user.id, selectedEngagement.sdpId].sort().join('_');
        await addDoc(collection(db, 'chats', chatId, 'messages'), {
          ...newMessage,
          timestamp: Timestamp.now()
        });

        // Create notification for SDP
        if (selectedEngagement.sdpId) {
          await createNotification({
            userId: selectedEngagement.sdpId,
            type: 'message',
            title: 'New Message',
            message: `${user.profile.name}: ${messageText.substring(0, 50)}${messageText.length > 50 ? '...' : ''}`,
            link: `/dashboard?tab=engagements&chat=${chatId}`,
            metadata: { chatId, senderId: user.id }
          });
        }
      } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message. Please try again.');
      }
    }
  };

  const handleAcceptProject = async () => {
    if (!viewingProject || !isFirebaseConfigured()) return;

    try {
      await updateDoc(doc(db, 'engagements', viewingProject.id), {
        status: 'In Progress',
        acceptedAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      // Send notification to SDP
      if (viewingProject.sdpId) {
        const chatId = [user.id, viewingProject.sdpId].sort().join('_');
        await addDoc(collection(db, 'chats', chatId, 'messages'), {
          senderId: user.id,
          senderName: user.profile.name,
          receiverId: viewingProject.sdpId,
          receiverName: viewingProject.sdp,
          message: `✅ I have accepted your project proposal: "${viewingProject.projectName || viewingProject.type}". Let's discuss the next steps!`,
          timestamp: Timestamp.now(),
          read: false,
          isProjectAcceptance: true
        });

        // Create notification
        await createNotification({
          userId: viewingProject.sdpId,
          type: 'engagement',
          title: 'Project Accepted',
          message: `${user.profile.name} accepted your project: "${viewingProject.projectName || viewingProject.type}"`,
          link: `/dashboard?tab=engagements&engagement=${viewingProject.id}`,
          metadata: { engagementId: viewingProject.id }
        });
      }

      alert('Project accepted! Status changed to In Progress.');
      setShowProjectModal(false);
      setViewingProject(null);
    } catch (error) {
      console.error('Error accepting project:', error);
      alert('Failed to accept project. Please try again.');
    }
  };

  const handleRejectProject = async () => {
    if (!viewingProject || !isFirebaseConfigured()) return;

    const reason = prompt('Please provide a reason for rejection (optional):');

    try {
      await updateDoc(doc(db, 'engagements', viewingProject.id), {
        status: 'Cancelled',
        rejectedAt: Timestamp.now(),
        rejectionReason: reason || 'No reason provided',
        updatedAt: Timestamp.now()
      });

      // Send notification to SDP
      if (viewingProject.sdpId) {
        const chatId = [user.id, viewingProject.sdpId].sort().join('_');
        await addDoc(collection(db, 'chats', chatId, 'messages'), {
          senderId: user.id,
          senderName: user.profile.name,
          receiverId: viewingProject.sdpId,
          receiverName: viewingProject.sdp,
          message: `❌ I have declined your project proposal: "${viewingProject.projectName || viewingProject.type}".\n\nReason: ${reason || 'Not specified'}`,
          timestamp: Timestamp.now(),
          read: false,
          isProjectRejection: true
        });

        // Create notification
        await createNotification({
          userId: viewingProject.sdpId,
          type: 'engagement',
          title: 'Project Rejected',
          message: `${user.profile.name} rejected your project: "${viewingProject.projectName || viewingProject.type}"`,
          link: `/dashboard?tab=engagements`,
          metadata: { engagementId: viewingProject.id, reason }
        });
      }

      alert('Project rejected.');
      setShowProjectModal(false);
      setViewingProject(null);
    } catch (error) {
      console.error('Error rejecting project. Please try again.');
    }
  };

  const handleViewProject = (engagement: any) => {
    setViewingProject(engagement);
    setShowProjectModal(true);
  };

  const tabs = [
    { id: 'dashboard' as TabType, label: 'Dashboard', icon: User },
    { id: 'market' as TabType, label: 'Market', icon: ShoppingBag },
    { id: 'engagements' as TabType, label: 'Projects', icon: Calendar },
    { id: 'profile' as TabType, label: 'Profile', icon: Edit },
    { id: 'documents' as TabType, label: 'Documents', icon: FolderOpen },
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

  const EngagementCard = ({ engagement }: { engagement: Engagement }) => (
    <div className={`bg-white rounded-2xl shadow-sm border ${engagement.status === 'Disputed' ? 'border-red-400 border-2 ring-4 ring-red-100' : 'border-gray-200'} overflow-hidden hover:shadow-lg transition-all duration-300 group`}>
      {/* Status Banner for Special States */}
      {engagement.status === 'Disputed' && (
        <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-3 flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-white animate-pulse" />
          <span className="text-white font-bold text-sm">⚠️ DISPUTE - ACTION REQUIRED</span>
        </div>
      )}
      {engagement.status === 'Awaiting SDP Confirmation' && (
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-3 flex items-center space-x-2">
          <Clock className="w-5 h-5 text-white" />
          <span className="text-white font-semibold text-sm">Awaiting SDP Confirmation</span>
        </div>
      )}
      
      <div className="p-6">
        {/* Dispute Alert Details */}
        {engagement.status === 'Disputed' && (engagement as any).disputeReason && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-start">
              <div className="flex-1">
                <p className="text-sm font-bold text-red-900 mb-1">SDP's Concern:</p>
                <p className="text-sm text-red-800">"{(engagement as any).disputeReason}"</p>
                <p className="text-xs text-red-600 mt-2">Click "View Project" to see details and resolve this issue.</p>
              </div>
            </div>
          </div>
        )}
        
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                {engagement.projectName || engagement.type}
              </h3>
            <Badge 
              variant={
                engagement.status === 'Completed' ? 'success' :
                engagement.status === 'In Progress' || engagement.status === 'Awaiting SDP Confirmation' ? 'info' :
                engagement.status === 'Disputed' ? 'danger' :
                'warning'
              }
              size="sm"
              className={`shadow-md ${engagement.status === 'Disputed' ? 'animate-pulse' : ''}`}
            >
              {engagement.status}
            </Badge>
          </div>
          <div className="flex items-center space-x-2 mb-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Briefcase className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Client</p>
              <p className="text-sm font-semibold text-gray-900">{engagement.sdp}</p>
            </div>
          </div>
          <p className="text-sm text-gray-600 line-clamp-2">{engagement.description}</p>
        </div>
      </div>
      
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 bg-gray-50 rounded-lg px-3 py-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="text-xs text-gray-600">{engagement.startDate || 'TBD'}</span>
          </div>
          <div className="flex items-center space-x-2 bg-emerald-50 rounded-lg px-3 py-2">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-bold text-emerald-700">{engagement.fee}</span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center space-x-2 mt-4">
        {engagement.status === 'Pending' && (
          <Button 
            size="sm" 
            onClick={() => handleViewProject(engagement)}
            className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-md"
          >
            <Eye className="w-4 h-4 mr-1" />
            View Project
          </Button>
        )}
        {(engagement.status === 'In Progress' || engagement.status === 'Awaiting SDP Confirmation' || engagement.status === 'Disputed') && (
          <Button 
            size="sm" 
            onClick={() => {
              setSelectedProjectForProgress(engagement);
              setShowProgressModal(true);
            }}
            className={`flex-1 ${engagement.status === 'Disputed' ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800' : 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800'} text-white shadow-md`}
          >
            <Eye className="w-4 h-4 mr-1" />
            View Project
          </Button>
        )}
        {engagement.status === 'Completed' && (
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => {
              setSelectedProjectForProgress(engagement);
              setShowProgressModal(true);
            }}
            className="flex-1 hover:bg-purple-50 hover:border-purple-400 hover:text-purple-700 transition-colors shadow-sm"
          >
            <BarChart3 className="w-4 h-4 mr-1" />
            View Details
          </Button>
        )}
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => handleManageEngagement(engagement.id)}
          className="hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700 transition-colors shadow-sm"
        >
          <MessageSquare className="w-4 h-4" />
        </Button>
      </div>
      </div>
    </div>
  );

  const renderDashboard = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
      {/* Enhanced Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Earnings Card */}
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl shadow-lg hover:shadow-xl transition-all p-6 text-white group hover:scale-105">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
              <DollarSign className="w-6 h-6" />
            </div>
            <div className="flex items-center space-x-1 bg-white/20 backdrop-blur-sm rounded-full px-2 py-1">
              <TrendingUp className="w-3 h-3" />
              <span className="text-xs font-semibold">+8%</span>
            </div>
          </div>
          <p className="text-emerald-100 text-sm mb-1">Total Earnings</p>
          <p className="text-3xl font-bold">{stats.totalEarnings}</p>
        </div>

        {/* Weekly Earnings Card */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg hover:shadow-xl transition-all p-6 text-white group hover:scale-105">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div className="flex items-center space-x-1 bg-white/20 backdrop-blur-sm rounded-full px-2 py-1">
              <Clock className="w-3 h-3" />
              <span className="text-xs font-semibold">This Week</span>
            </div>
          </div>
          <p className="text-blue-100 text-sm mb-1">Earnings This Week</p>
          <p className="text-3xl font-bold">{stats.totalEarningsThisWeek}</p>
        </div>

        {/* Active Projects Card */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-lg hover:shadow-xl transition-all p-6 text-white group hover:scale-105">
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
          <p className="text-purple-100 text-sm mb-1">Active Projects</p>
          <p className="text-3xl font-bold">{stats.activeEngagements}</p>
        </div>

        {/* Average Rating Card */}
        <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl shadow-lg hover:shadow-xl transition-all p-6 text-white group hover:scale-105">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
              <Star className="w-6 h-6 fill-white" />
            </div>
            <div className="flex items-center space-x-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} className="w-3 h-3 fill-white opacity-80" />
              ))}
            </div>
          </div>
          <p className="text-amber-100 text-sm mb-1">Average Rating</p>
          <p className="text-3xl font-bold">
            {stats.averageRating > 0 && user.profile.reviews && user.profile.reviews > 0 ? stats.averageRating.toFixed(1) : '0.0'}
          </p>
        </div>

        {/* Completed Projects Card */}
        <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-all p-6 border border-gray-200 group hover:border-emerald-300">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-emerald-50 rounded-xl group-hover:bg-emerald-100 transition-colors">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            </div>
            <div className="flex items-center space-x-1 bg-emerald-50 rounded-full px-2 py-1">
              <TrendingUp className="w-3 h-3 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-600">+12</span>
            </div>
          </div>
          <p className="text-gray-600 text-sm mb-1">Completed Projects</p>
          <p className="text-3xl font-bold text-gray-900">{stats.completedProjects}</p>
        </div>

        {/* Total Paid Card */}
        <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-all p-6 border border-gray-200 group hover:border-blue-300">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-50 rounded-xl group-hover:bg-blue-100 transition-colors">
              <CreditCard className="w-6 h-6 text-blue-600" />
            </div>
            <CheckCircle className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-gray-600 text-sm mb-1">Total Paid</p>
          <p className="text-3xl font-bold text-gray-900">{stats.totalPaid}</p>
        </div>

        {/* Weekly Paid Card */}
        <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-all p-6 border border-gray-200 group hover:border-purple-300">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-50 rounded-xl group-hover:bg-purple-100 transition-colors">
              <DollarSign className="w-6 h-6 text-purple-600" />
            </div>
            <div className="flex items-center space-x-1 bg-purple-50 rounded-full px-2 py-1">
              <Clock className="w-3 h-3 text-purple-600" />
              <span className="text-xs font-semibold text-purple-600">Week</span>
            </div>
          </div>
          <p className="text-gray-600 text-sm mb-1">Paid This Week</p>
          <p className="text-3xl font-bold text-gray-900">{stats.totalPaidThisWeek}</p>
        </div>

        {/* Quick Action Card */}
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl shadow-lg hover:shadow-xl transition-all p-6 text-white group hover:scale-105 cursor-pointer" onClick={() => setActiveTab('market')}>
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </div>
          <p className="text-indigo-100 text-sm mb-1">Marketplace</p>
          <p className="text-lg font-bold">Sell Your Services</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Current Projects */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
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
                <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 p-12 text-center">
                  <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No active engagements</h3>
                  <p className="text-gray-600 mb-6">Your engagements with SDPs will appear here.</p>
                  <Button onClick={() => setActiveTab('engagements')}>
                    <Plus className="w-4 h-4 mr-2" />
                  View All Projects
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Plus className="w-5 h-5 mr-2 text-blue-600" />
              Quick Actions
            </h3>
            <div className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors" 
                onClick={() => setActiveTab('profile')}
              >
                <Edit className="w-4 h-4 mr-2" />
                Update Profile
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors"
                onClick={() => setActiveTab('documents')}
              >
                <FileText className="w-4 h-4 mr-2" />
                Upload Documents
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors" 
                onClick={() => setActiveTab('reports')}
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                View Reports
              </Button>
            </div>
          </div>

          {/* Recent Activities */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Clock className="w-5 h-5 mr-2 text-blue-600" />
              Recent Activity
            </h3>
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
                    yellow: 'bg-yellow-500',
                    red: 'bg-red-500'
                  }[activity.color] || 'bg-gray-500';

                  return (
                    <div key={activity.id} className="flex items-start space-x-3 p-2 hover:bg-gray-50 rounded-lg transition-colors">
                      <div className={`w-2 h-2 ${colorClass} rounded-full mt-2 flex-shrink-0`}></div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{activity.message}</p>
                        <p className="text-gray-500 text-xs">{getTimeAgo(activity.timestamp)}</p>
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
  };

  const renderEngagements = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    return (
    <div className="space-y-6">
      {/* Invited Projects Section */}
      {invitedProjects.length > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl shadow-sm border-2 border-purple-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Mail className="w-5 h-5 text-purple-600" />
              <h2 className="text-xl font-bold text-gray-900">Project Invitations</h2>
              <Badge variant="success" className="ml-2">{invitedProjects.length}</Badge>
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-4">You've been invited to apply for these projects</p>
          <div className="space-y-4">
            {invitedProjects.map(({ project, invitation }) => {
              const hasApplied = myApplications.some(app => app.projectId === project.id && app.status !== 'invited');
              return (
                <div key={project.id} className="bg-white rounded-lg border border-purple-200 p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{project.projectName}</h3>
                        <Badge variant="success" className="bg-purple-100 text-purple-700 border-purple-300">
                          <Mail className="w-3 h-3 mr-1" />
                          Invited
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">From: {project.sdpName}</p>
                      <p className="text-sm text-gray-700 mb-3">{project.description}</p>
                      <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                        <span className="flex items-center">
                          <DollarSign className="w-4 h-4 mr-1" />
                          {project.budget}
                        </span>
                        <span className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          {project.startDate} - {project.endDate}
                        </span>
                        <span className="flex items-center">
                          <Tag className="w-4 h-4 mr-1" />
                          {project.projectType}
                        </span>
                      </div>
                      {hasApplied ? (
                        <Badge variant="success">Application Submitted</Badge>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            setSelectedProjectForApplication(project);
                            setShowApplicationModal(true);
                          }}
                        >
                          Apply Now
                        </Button>
                      )}
                    </div>
                    {project.thumbnail && (
                      <div className="ml-4">
                        <img 
                          src={project.thumbnail} 
                          alt={project.projectName}
                          className="w-24 h-24 object-cover rounded-lg"
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
          <h2 className="text-xl font-bold text-gray-900">All Projects</h2>
          <div className="flex items-center space-x-3">
            <div className="relative flex-1 md:flex-initial">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search engagements..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full md:w-64"
              />
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleExport}
              className="hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center space-x-2 mb-6 overflow-x-auto pb-2">
          {['all', 'Pending', 'In Progress', 'Completed'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                filterStatus === status
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status === 'all' ? 'All' : status} ({status === 'all' ? engagements.length : engagements.filter(e => e.status === status).length})
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {engagements
            .filter(e => filterStatus === 'all' || e.status === filterStatus)
            .filter(e => 
              e.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
              e.sdp.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .length > 0 ? (
            engagements
              .filter(e => filterStatus === 'all' || e.status === filterStatus)
              .filter(e => 
                e.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
                e.sdp.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map(engagement => (
                <EngagementCard key={engagement.id} engagement={engagement} />
              ))
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-xl">
              <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No engagements found</h3>
              <p className="text-gray-600 mb-4">Try adjusting your search or filter criteria.</p>
            </div>
          )}
        </div>
      </div>
    </div>
    );
  };

  const addSpecialization = () => {
    if (newSpecialization.trim() && !profileData.specializations.includes(newSpecialization.trim())) {
      setProfileData({
        ...profileData,
        specializations: [...profileData.specializations, newSpecialization.trim()]
      });
      setNewSpecialization('');
    }
  };

  const removeSpecialization = (index: number) => {
    setProfileData({
      ...profileData,
      specializations: profileData.specializations.filter((_, i) => i !== index)
    });
  };

  const addSector = () => {
    if (newSector.trim() && !profileData.sectors.includes(newSector.trim())) {
      setProfileData({
        ...profileData,
        sectors: [...profileData.sectors, newSector.trim()]
      });
      setNewSector('');
    }
  };

  const removeSector = (index: number) => {
    setProfileData({
      ...profileData,
      sectors: profileData.sectors.filter((_, i) => i !== index)
    });
  };

  const addQualification = () => {
    if (newQualification.trim() && !profileData.qualifications.includes(newQualification.trim())) {
      setProfileData({
        ...profileData,
        qualifications: [...profileData.qualifications, newQualification.trim()]
      });
      setNewQualification('');
    }
  };

  const removeQualification = (index: number) => {
    setProfileData({
      ...profileData,
      qualifications: profileData.qualifications.filter((_, i) => i !== index)
    });
  };

  const handleProfileImageChange = async () => {
    if (!user.id) {
      alert('User ID not found');
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;

      // Check if Firebase is properly configured and user is authenticated
      const skipFirebaseLogin = import.meta.env.VITE_SKIP_FIREBASE_LOGIN === 'true';
      const notSignedIn = !auth?.currentUser;
      
      if (!isFirebaseConfigured()) {
        alert('❌ Firebase is not configured. Please check your .env.local file.');
        return;
      }
      
      if (skipFirebaseLogin) {
        alert('❌ Demo mode is enabled. Set VITE_SKIP_FIREBASE_LOGIN=false in .env.local and restart the server.');
        return;
      }
      
      if (notSignedIn) {
        alert('❌ Not authenticated with Firebase. Please:\n\n1. Create demo users (see INITIALIZE_USERS.md)\n2. Log out and log back in with Firebase credentials\n3. Then try uploading again');
        return;
      }

      try {
        // Upload image to Firebase Storage
        const imageRef = ref(storage, `users/${user.id}/profile/${Date.now()}_${file.name}`);
        await uploadBytes(imageRef, file);
        const downloadURL = await getDownloadURL(imageRef);
        
        // Update profile data state
        setProfileData({ ...profileData, profileImage: downloadURL });

        // Update in Firestore
        const userRef = doc(db, 'users', user.id);
        await updateDoc(userRef, {
          'profile.profileImage': downloadURL,
          updatedAt: Timestamp.now()
        });

        // Update local cache
        const cached = localStorage.getItem('edulinker_user');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.profile) {
            parsed.profile.profileImage = downloadURL;
            localStorage.setItem('edulinker_user', JSON.stringify(parsed));
            // Dispatch custom event to notify App.tsx of user data change
            window.dispatchEvent(new CustomEvent('userDataChanged', { detail: parsed }));
          }
        }

        alert('Profile image updated successfully!');
        // Reload to reflect changes in header
        window.location.reload();
      } catch (error: any) {
        console.error('Error uploading profile image:', error);
        alert('Error uploading profile image: ' + error.message);
      }
    };
    input.click();
  };

  const resetProfileData = async () => {
    if (!user.id) return;

    try {
      // Reload user data from Firestore
      const userDocRef = doc(db, 'users', user.id);
      const userDocSnap = await getDoc(userDocRef);
      
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        const profile = userData.profile || user.profile;
        
        const nameParts = profile.name.split(' ');
        const defaultFirstName = nameParts[0] || '';
        const defaultLastName = nameParts.slice(1).join(' ') || '';
        
        setProfileData({
          firstName: defaultFirstName,
          lastName: defaultLastName,
          email: profile.email || user.profile.email,
          phone: (profile as any).phone || '',
          idNumber: (profile as any).idNumber || '',
          roles: profile.roles || user.profile.roles || (user.profile.role ? [user.profile.role] : []),
          otherRole: profile.otherRole || '',
          location: profile.location || user.profile.location,
          experience: profile.experience || user.profile.experience,
          specializations: profile.specializations || [],
          sectors: profile.sectors || [],
          qualifications: profile.qualifications || [],
          setaRegistration: (profile as any).setaRegistration || '',
          rates: profile.rates || {
            facilitation: '',
            assessment: '',
            consultation: '',
            moderation: ''
          },
          availability: profile.availability || user.profile.availability,
          aboutMe: profile.aboutMe || '',
          profileImage: profile.profileImage || '',
          otherSpecialization: (profile as any).otherSpecialization || '',
          otherSector: (profile as any).otherSector || '',
          otherQualification: (profile as any).otherQualification || ''
        });
      } else {
        // Fallback to current user profile
        const nameParts = user.profile.name.split(' ');
        const defaultFirstName = nameParts[0] || '';
        const defaultLastName = nameParts.slice(1).join(' ') || '';
        
        setProfileData({
          firstName: defaultFirstName,
          lastName: defaultLastName,
          email: user.profile.email,
          phone: (user.profile as any).phone || '',
          idNumber: (user.profile as any).idNumber || '',
          roles: user.profile.roles || (user.profile.role ? [user.profile.role] : []),
          otherRole: (user.profile as any).otherRole || '',
          location: user.profile.location,
          experience: user.profile.experience,
          specializations: user.profile.specializations || [],
          sectors: user.profile.sectors || [],
          qualifications: user.profile.qualifications || [],
          setaRegistration: (user.profile as any).setaRegistration || '',
          rates: user.profile.rates || {
            facilitation: '',
            assessment: '',
            consultation: '',
            moderation: ''
          },
          availability: user.profile.availability,
          aboutMe: user.profile.aboutMe || '',
          profileImage: user.profile.profileImage || '',
          otherSpecialization: (user.profile as any).otherSpecialization || '',
          otherSector: (user.profile as any).otherSector || '',
          otherQualification: (user.profile as any).otherQualification || ''
        });
      }
    } catch (error) {
      console.error('Error resetting profile data:', error);
      // Fallback to current user profile
      const nameParts = user.profile.name.split(' ');
      const defaultFirstName = nameParts[0] || '';
      const defaultLastName = nameParts.slice(1).join(' ') || '';
      
      setProfileData({
        firstName: defaultFirstName,
        lastName: defaultLastName,
        email: user.profile.email,
        phone: (user.profile as any).phone || '',
        idNumber: (user.profile as any).idNumber || '',
        roles: user.profile.roles || (user.profile.role ? [user.profile.role] : []),
        otherRole: (user.profile as any).otherRole || '',
        location: user.profile.location,
        experience: user.profile.experience,
        specializations: user.profile.specializations || [],
        sectors: user.profile.sectors || [],
        qualifications: user.profile.qualifications || [],
        setaRegistration: (user.profile as any).setaRegistration || '',
        rates: user.profile.rates || {
          facilitation: '',
          assessment: '',
          consultation: '',
          moderation: ''
        },
        availability: user.profile.availability,
        aboutMe: user.profile.aboutMe || '',
        profileImage: user.profile.profileImage || '',
        otherSpecialization: (user.profile as any).otherSpecialization || '',
        otherSector: (user.profile as any).otherSector || '',
        otherQualification: (user.profile as any).otherQualification || ''
      });
    }
  };

  const renderProfile = () => (
    <div className="space-y-6">
      {/* Basic Information Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Basic Information</h2>
          <p className="text-sm text-gray-600">Your personal and contact details</p>
        </div>
        <div className="space-y-5">
          {/* Profile Image */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Profile Image</label>
            <div className="flex items-center space-x-4">
              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-blue-100 bg-gray-100">
                {profileData.profileImage ? (
                  <img src={profileData.profileImage} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-12 h-12 text-gray-400" />
                  </div>
                )}
              </div>
              <Button 
                variant="outline" 
                onClick={handleProfileImageChange}
                className="hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors"
              >
                <Upload className="w-4 h-4 mr-2" />
                Change Image
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
              <input
                type="text"
                value={profileData.firstName}
                onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                placeholder="Enter your first name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
              <input
                type="text"
                value={profileData.lastName}
                onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                placeholder="Enter your last name"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email Address *</label>
              <input
                type="email"
                value={profileData.email}
                onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                placeholder="your.email@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number *</label>
              <input
                type="tel"
                value={profileData.phone}
                onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                placeholder="+27 11 123 4567"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">ID Number *</label>
            <input
              type="text"
              value={profileData.idNumber}
              onChange={(e) => setProfileData({ ...profileData, idNumber: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              placeholder="ID number for verification"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Your Roles * <span className="text-gray-500 text-xs">(You can select multiple)</span></label>
              <div className="grid grid-cols-2 gap-3">
                {roles.map(role => (
                  <label
                    key={role}
                    className={`flex items-center space-x-2 p-3 border rounded-md cursor-pointer transition-all ${
                      profileData.roles.includes(role)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-300 hover:border-blue-300 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={profileData.roles.includes(role) || (role === 'Other' && profileData.otherRole && !profileData.roles.includes('Other'))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setProfileData({ ...profileData, roles: [...profileData.roles, role] });
                        } else {
                          setProfileData({ ...profileData, roles: profileData.roles.filter(r => r !== role), otherRole: role === 'Other' ? '' : profileData.otherRole });
                        }
                      }}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{role}</span>
                  </label>
                ))}
              </div>
              {(profileData.roles.includes('Other') || (profileData.otherRole && !profileData.roles.includes('Other'))) && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Specify Your Other Role *
                  </label>
                  <input
                    type="text"
                    value={profileData.otherRole}
                    onChange={(e) => setProfileData({ ...profileData, otherRole: e.target.value, roles: profileData.roles.includes('Other') ? profileData.roles : [...profileData.roles, 'Other'] })}
                    placeholder="Enter your custom role"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}
              {profileData.roles.length === 0 && !profileData.otherRole && (
                <p className="mt-1 text-sm text-red-600">Please select at least one role</p>
              )}
              {(profileData.roles.includes('Other') || profileData.otherRole) && !profileData.otherRole.trim() && (
                <p className="mt-1 text-sm text-red-600">Please specify your other role</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Years of Experience *</label>
              <select
                value={profileData.experience}
                onChange={(e) => setProfileData({ ...profileData, experience: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                required
              >
                <option value="">Select experience level</option>
                {experienceOptions.map(exp => (
                  <option key={exp} value={exp}>{exp}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Location *</label>
            <select
              value={profileData.location}
              onChange={(e) => setProfileData({ ...profileData, location: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              required
            >
              <option value="">Select your location</option>
              {locations.map(location => (
                <option key={location} value={location}>{location}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Specializations Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Specializations *</h2>
          <p className="text-sm text-gray-600">Select all areas of expertise that apply</p>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {specializations.map(spec => (
              <label key={spec} className="flex items-center space-x-2 cursor-pointer p-2 hover:bg-gray-50 rounded-lg transition-colors">
                <input
                  type="checkbox"
                  checked={profileData.specializations.includes(spec)}
                  onChange={() => {
                    if (profileData.specializations.includes(spec)) {
                      removeSpecialization(profileData.specializations.indexOf(spec));
                    } else {
                      setProfileData({
                        ...profileData,
                        specializations: [...profileData.specializations, spec]
                      });
                    }
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <span className="text-sm text-gray-700">{spec}</span>
              </label>
            ))}
            <label className="flex items-center space-x-2 cursor-pointer p-2 hover:bg-gray-50 rounded-lg transition-colors">
              <input
                type="checkbox"
                checked={profileData.specializations.includes('Other')}
                onChange={() => {
                  if (profileData.specializations.includes('Other')) {
                    removeSpecialization(profileData.specializations.indexOf('Other'));
                    setProfileData({ ...profileData, otherSpecialization: '' });
                  } else {
                    setProfileData({
                      ...profileData,
                      specializations: [...profileData.specializations, 'Other']
                    });
                  }
                }}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
              />
              <span className="text-sm text-gray-700">Other</span>
            </label>
          </div>
          {profileData.specializations.includes('Other') && (
            <div className="mt-3">
              <input
                type="text"
                value={profileData.otherSpecialization}
                onChange={(e) => setProfileData({ ...profileData, otherSpecialization: e.target.value })}
                placeholder="Please specify your other specialization"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              />
            </div>
          )}
          {profileData.specializations.length === 0 && (
            <p className="text-sm text-gray-500 italic text-center py-4">No specializations selected</p>
          )}
        </div>
      </div>

      {/* Sectors Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Sectors *</h2>
          <p className="text-sm text-gray-600">Select all sectors you work in</p>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {sectors.map(sector => (
              <label key={sector} className="flex items-center space-x-2 cursor-pointer p-2 hover:bg-gray-50 rounded-lg transition-colors">
                <input
                  type="checkbox"
                  checked={profileData.sectors.includes(sector)}
                  onChange={() => {
                    if (profileData.sectors.includes(sector)) {
                      removeSector(profileData.sectors.indexOf(sector));
                    } else {
                      setProfileData({
                        ...profileData,
                        sectors: [...profileData.sectors, sector]
                      });
                    }
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <span className="text-sm text-gray-700">{sector}</span>
              </label>
            ))}
            <label className="flex items-center space-x-2 cursor-pointer p-2 hover:bg-gray-50 rounded-lg transition-colors">
              <input
                type="checkbox"
                checked={profileData.sectors.includes('Other')}
                onChange={() => {
                  if (profileData.sectors.includes('Other')) {
                    removeSector(profileData.sectors.indexOf('Other'));
                    setProfileData({ ...profileData, otherSector: '' });
                  } else {
                    setProfileData({
                      ...profileData,
                      sectors: [...profileData.sectors, 'Other']
                    });
                  }
                }}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
              />
              <span className="text-sm text-gray-700">Other</span>
            </label>
          </div>
          {profileData.sectors.includes('Other') && (
            <div className="mt-3">
              <input
                type="text"
                value={profileData.otherSector}
                onChange={(e) => setProfileData({ ...profileData, otherSector: e.target.value })}
                placeholder="Please specify your other sector"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              />
            </div>
          )}
          {profileData.sectors.length === 0 && (
            <p className="text-sm text-gray-500 italic text-center py-4">No sectors selected</p>
          )}
        </div>
      </div>

      {/* Qualifications Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Qualifications *</h2>
          <p className="text-sm text-gray-600">Select all qualifications that apply</p>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {qualificationsList.map(qual => (
              <label key={qual} className="flex items-center space-x-2 cursor-pointer p-2 hover:bg-gray-50 rounded-lg transition-colors">
                <input
                  type="checkbox"
                  checked={profileData.qualifications.includes(qual)}
                  onChange={() => {
                    if (profileData.qualifications.includes(qual)) {
                      removeQualification(profileData.qualifications.indexOf(qual));
                    } else {
                      setProfileData({
                        ...profileData,
                        qualifications: [...profileData.qualifications, qual]
                      });
                    }
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <span className="text-sm text-gray-700">{qual}</span>
              </label>
            ))}
            <label className="flex items-center space-x-2 cursor-pointer p-2 hover:bg-gray-50 rounded-lg transition-colors">
              <input
                type="checkbox"
                checked={profileData.qualifications.includes('Other')}
                onChange={() => {
                  if (profileData.qualifications.includes('Other')) {
                    removeQualification(profileData.qualifications.indexOf('Other'));
                    setProfileData({ ...profileData, otherQualification: '' });
                  } else {
                    setProfileData({
                      ...profileData,
                      qualifications: [...profileData.qualifications, 'Other']
                    });
                  }
                }}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
              />
              <span className="text-sm text-gray-700">Other</span>
            </label>
          </div>
          {profileData.qualifications.includes('Other') && (
            <div className="mt-3">
              <input
                type="text"
                value={profileData.otherQualification}
                onChange={(e) => setProfileData({ ...profileData, otherQualification: e.target.value })}
                placeholder="Please specify your other qualification"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              />
            </div>
          )}
          {profileData.qualifications.length === 0 && (
            <p className="text-sm text-gray-500 italic text-center py-4">No qualifications selected</p>
          )}
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            SETA Registration Number
          </label>
          <input
            type="text"
            value={profileData.setaRegistration}
            onChange={(e) => setProfileData({ ...profileData, setaRegistration: e.target.value })}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            placeholder="e.g. ETDP12345"
          />
          <p className="text-xs text-gray-500 mt-1">Enter your SETA registration number if you have one</p>
        </div>
      </div>

      {/* Service Rates Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Service Rates</h2>
          <p className="text-sm text-gray-600">Set your standard rates for different services</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Facilitation Rate *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">R</span>
              <input
                type="text"
                value={profileData.rates.facilitation || ''}
                onChange={(e) => setProfileData({
                  ...profileData,
                  rates: { ...profileData.rates, facilitation: e.target.value }
                })}
                className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                placeholder="e.g. 1500"
                required
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Per day rate</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Assessment Rate *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">R</span>
              <input
                type="text"
                value={profileData.rates.assessment || ''}
                onChange={(e) => setProfileData({
                  ...profileData,
                  rates: { ...profileData.rates, assessment: e.target.value }
                })}
                className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                placeholder="e.g. 800"
                required
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Per day rate</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Consultation Rate</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">R</span>
              <input
                type="text"
                value={profileData.rates.consultation || ''}
                onChange={(e) => setProfileData({
                  ...profileData,
                  rates: { ...profileData.rates, consultation: e.target.value }
                })}
                className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                placeholder="e.g. 1200"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Per hour rate</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Moderation Rate</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">R</span>
              <input
                type="text"
                value={profileData.rates.moderation || ''}
                onChange={(e) => setProfileData({
                  ...profileData,
                  rates: { ...profileData.rates, moderation: e.target.value }
                })}
                className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                placeholder="e.g. 1000"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Per day rate</p>
          </div>
        </div>
      </div>

      {/* Availability Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Availability</h2>
          <p className="text-sm text-gray-600">Set your current availability status</p>
        </div>
        <div className="space-y-3">
          {(['Available', 'Busy', 'Offline', 'Away'] as const).map((status) => (
            <label
              key={status}
              className={`flex items-center space-x-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                profileData.availability === status
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="availability"
                value={status}
                checked={profileData.availability === status}
                onChange={(e) => setProfileData({ ...profileData, availability: e.target.value as 'Available' | 'Busy' | 'Offline' | 'Away' })}
                className="w-4 h-4 text-blue-600 focus:ring-blue-500"
              />
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-gray-900">{status}</span>
                  <Badge 
                    variant={status === 'Available' ? 'success' : status === 'Busy' ? 'warning' : 'default'} 
                    size="sm"
                  >
                    {status === 'Available' ? 'Active' : status === 'Busy' ? 'Busy' : status === 'Offline' ? 'Offline' : 'Away'}
                  </Badge>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {status === 'Available' && 'You are currently available for new engagements'}
                  {status === 'Busy' && 'You are currently busy but may accept urgent requests'}
                  {status === 'Offline' && 'You are currently offline and not available'}
                  {status === 'Away' && 'You are away and will respond later'}
                </p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* About Me Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">About Me</h2>
          <p className="text-sm text-gray-600">Tell potential clients about yourself, your experience, and expertise</p>
        </div>
        <textarea
          value={profileData.aboutMe}
          onChange={(e) => setProfileData({ ...profileData, aboutMe: e.target.value })}
          rows={8}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors resize-none"
          placeholder="Write a comprehensive description of your professional background, areas of expertise, achievements, and what makes you unique. This will help SDPs understand your value proposition..."
        />
        <p className="text-xs text-gray-500 mt-2">{profileData.aboutMe.length} characters</p>
      </div>

      {/* Action Buttons */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Save Your Profile</h3>
            <p className="text-sm text-gray-600">Make sure all information is accurate before saving</p>
          </div>
          <div className="flex items-center space-x-3">
            <Button 
              variant="outline" 
              onClick={resetProfileData}
              className="hover:bg-gray-50 hover:border-gray-300 transition-colors"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Reset
            </Button>
            <Button 
              onClick={handleSaveProfile} 
              className="hover:shadow-lg transition-shadow"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  const getReviewStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="success" size="sm"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="danger" size="sm"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="warning" size="sm"><Clock className="w-3 h-3 mr-1" />Pending Review</Badge>;
    }
  };

  const handleRecoverRegistrationDocuments = async () => {
    if (!user.id || !isFirebaseConfigured() || !isStorageConfigured()) {
      alert('Cannot recover documents. Firebase not configured.');
      return;
    }

    setRecoveringDocuments(true);
    let recoveredCount = 0;

    try {
      const storagePaths = [
        `user-documents/${user.id}`,
        `users/${user.id}/documents`,
        `registration-documents/${user.id}`
      ];

      for (const storagePath of storagePaths) {
        try {
          const storageRef = ref(storage, storagePath);
          const storageList = await listAll(storageRef);
          
          // Get existing documents from Firestore to check for duplicates
          const existingDocsSnapshot = await getDocs(collection(db, 'users', user.id, 'documents'));
          const existingUrls = new Set<string>();
          existingDocsSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.url) existingUrls.add(data.url);
          });
          
          // Check each file in storage
          for (const itemRef of storageList.items) {
            try {
              const downloadURL = await getDownloadURL(itemRef);
              
              // Skip if already in Firestore
              if (existingUrls.has(downloadURL)) {
                continue;
              }
              
              const fileName = itemRef.name;
              
              // Extract document name from filename
              const nameMatch = fileName.match(/^\d+_(.+?)(\.\w+)?$/);
              const docName = nameMatch 
                ? nameMatch[1].replace(/_/g, ' ') 
                : fileName.replace(/\.\w+$/, '').replace(/_/g, ' ');
              
              try {
                // Get file metadata
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
                
                recoveredCount++;
                console.log(`✅ Recovered registration document: ${docName}`);
              } catch (metaError: any) {
                // If metadata fetch fails, use defaults
                await addDoc(collection(db, 'users', user.id, 'documents'), {
                  name: docName,
                  type: fileName.toLowerCase().endsWith('.pdf') ? 'PDF' : 'Document',
                  size: 'Unknown',
                  url: downloadURL,
                  uploadedAt: Timestamp.now(),
                  reviewStatus: 'pending',
                  source: 'registration'
                });
                recoveredCount++;
                console.log(`✅ Recovered registration document (with defaults): ${docName}`);
              }
            } catch (error: any) {
              console.error(`Error processing storage item ${itemRef.name}:`, error);
            }
          }
        } catch (storageError: any) {
          // Storage folder might not exist yet, which is fine
          if (storageError.code !== 'storage/object-not-found' && storageError.code !== 'storage/unauthorized') {
            console.log(`Storage path ${storagePath} not found or inaccessible`);
          }
        }
      }

      if (recoveredCount > 0) {
        alert(`✅ Successfully recovered ${recoveredCount} registration document(s)! They will appear in your Documents tab.`);
      } else {
        alert('No registration documents found in Storage. If you uploaded documents during registration, they may not have been saved. Please upload them again using the "Upload Document" button.');
      }
    } catch (error: any) {
      console.error('Error recovering documents:', error);
      alert(`Error recovering documents: ${error.message || 'Please try again.'}`);
    } finally {
      setRecoveringDocuments(false);
    }
  };

  const renderDocuments = () => {
    const filteredDocuments = documents.filter(doc => {
      if (documentFilter === 'all') return true;
      return (doc.reviewStatus || 'pending') === documentFilter;
    });

    const statusCounts = {
      all: documents.length,
      pending: documents.filter(d => (d.reviewStatus || 'pending') === 'pending').length,
      approved: documents.filter(d => d.reviewStatus === 'approved').length,
      rejected: documents.filter(d => d.reviewStatus === 'rejected').length
    };

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                  <FolderOpen className="w-6 h-6 mr-2 text-blue-600" />
                  Submitted Documents
                </h2>
                <p className="text-sm text-gray-600 mt-2">View all your submitted documents and their review status</p>
              </div>
              <div className="flex items-center gap-3">
                {documents.length === 0 && (
                  <Button 
                    onClick={handleRecoverRegistrationDocuments}
                    disabled={recoveringDocuments}
                    variant="outline"
                    className="border-green-500 text-green-600 hover:bg-green-50 hover:border-green-600 transition-all"
                  >
                    {recoveringDocuments ? (
                      <>
                        <Clock className="w-4 h-4 mr-2 animate-spin" />
                        Recovering...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Recover Registration Documents
                      </>
                    )}
                  </Button>
                )}
                <Button 
                  onClick={handleUploadDocument}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Document
                </Button>
              </div>
            </div>
          </div>

          {/* Status Filter Tabs */}
          <div className="p-4 bg-gray-50 border-b border-gray-200">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setDocumentFilter('all')}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  documentFilter === 'all'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                All ({statusCounts.all})
              </button>
              <button
                onClick={() => setDocumentFilter('pending')}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center space-x-1 ${
                  documentFilter === 'pending'
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>Pending ({statusCounts.pending})</span>
              </button>
              <button
                onClick={() => setDocumentFilter('approved')}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center space-x-1 ${
                  documentFilter === 'approved'
                    ? 'bg-green-600 text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <CheckCircle className="w-4 h-4" />
                <span>Approved ({statusCounts.approved})</span>
              </button>
              <button
                onClick={() => setDocumentFilter('rejected')}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center space-x-1 ${
                  documentFilter === 'rejected'
                    ? 'bg-red-600 text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <XCircle className="w-4 h-4" />
                <span>Rejected ({statusCounts.rejected})</span>
              </button>
            </div>
          </div>
          
          <div className="p-6">
            {filteredDocuments.length > 0 ? (
              <div className="space-y-4">
                {filteredDocuments.map((doc) => {
                  const status = doc.reviewStatus || 'pending';
                  const statusColors = {
                    pending: { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'bg-amber-100', iconColor: 'text-amber-600' },
                    approved: { bg: 'bg-green-50', border: 'border-green-200', icon: 'bg-green-100', iconColor: 'text-green-600' },
                    rejected: { bg: 'bg-red-50', border: 'border-red-200', icon: 'bg-red-100', iconColor: 'text-red-600' }
                  };
                  const colors = statusColors[status as keyof typeof statusColors] || statusColors.pending;

                  return (
                    <div 
                      key={doc.id} 
                      className={`${colors.bg} ${colors.border} border-2 rounded-xl p-5 hover:shadow-md transition-all group`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-4 flex-1">
                          <div className={`w-14 h-14 ${colors.icon} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
                            <FileText className={`w-7 h-7 ${colors.iconColor}`} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <h3 className="text-lg font-bold text-gray-900">{doc.name}</h3>
                              {doc.source === 'registration' && (
                                <Badge variant="info" size="sm" className="bg-blue-100 text-blue-700 border-blue-300">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Registration
                                </Badge>
                              )}
                              <div className="flex-shrink-0">
                                {getReviewStatusBadge(status)}
                              </div>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 mb-3">
                              <span className="flex items-center space-x-1">
                                <FileText className="w-4 h-4" />
                                <span className="font-medium">{doc.type}</span>
                              </span>
                              <span className="flex items-center space-x-1">
                                <Package className="w-4 h-4" />
                                <span>{doc.size}</span>
                              </span>
                              <span className="flex items-center space-x-1">
                                <Calendar className="w-4 h-4" />
                                <span>Uploaded {doc.date}</span>
                              </span>
                              {doc.source === 'registration' && (
                                <span className="flex items-center space-x-1 text-blue-600">
                                  <Upload className="w-4 h-4" />
                                  <span className="font-medium">From Registration</span>
                                </span>
                              )}
                            </div>

                            {/* Status-specific information */}
                            {status === 'rejected' && doc.reviewComment && (
                              <div className="mt-3 p-3 bg-red-100 border-l-4 border-red-600 rounded">
                                <p className="text-sm font-semibold text-red-900 mb-1">Rejection Reason:</p>
                                <p className="text-sm text-red-800">{doc.reviewComment}</p>
                                {doc.reviewedAt && (
                                  <p className="text-xs text-red-600 mt-2">
                                    Reviewed on {new Date(doc.reviewedAt).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                            )}
                            {status === 'approved' && doc.reviewedAt && (
                              <div className="mt-3 p-3 bg-green-100 border-l-4 border-green-600 rounded">
                                <p className="text-sm font-semibold text-green-900">
                                  ✅ Approved on {new Date(doc.reviewedAt).toLocaleDateString()}
                                  {doc.reviewedBy && <span className="text-green-700"> by {doc.reviewedBy}</span>}
                                </p>
                              </div>
                            )}
                            {status === 'pending' && (
                              <div className="mt-3 p-3 bg-amber-100 border-l-4 border-amber-600 rounded">
                                <p className="text-sm font-semibold text-amber-900">
                                  ⏳ Awaiting admin review. You'll be notified once the review is complete.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2 ml-4">
                          {(status === 'approved' || status === 'rejected') && doc.url && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleViewDocument(doc.id)}
                              className="hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors"
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              View
                            </Button>
                          )}
                          {status === 'approved' && doc.url && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleDownloadDocument(doc.id)}
                              className="hover:bg-green-50 hover:border-green-300 hover:text-green-600 transition-colors"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16 border-2 border-dashed border-gray-300 rounded-xl">
                <FolderOpen className="w-20 h-20 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {documentFilter === 'all' ? 'No documents uploaded yet' : `No ${documentFilter} documents`}
                </h3>
                <p className="text-gray-600 mb-6">
                  {documentFilter === 'all' 
                    ? 'If you uploaded documents during registration, click "Recover Registration Documents" above. Otherwise, upload your professional documents to get started.' 
                    : `You don't have any ${documentFilter} documents at this time.`}
                </p>
                {documentFilter === 'all' && (
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <Button 
                      onClick={handleRecoverRegistrationDocuments}
                      disabled={recoveringDocuments}
                      variant="outline"
                      className="border-green-500 text-green-600 hover:bg-green-50 hover:border-green-600"
                    >
                      {recoveringDocuments ? (
                        <>
                          <Clock className="w-4 h-4 mr-2 animate-spin" />
                          Recovering...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Recover Registration Documents
                        </>
                      )}
                    </Button>
                    <Button onClick={handleUploadDocument} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white">
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Your First Document
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Upload Modal */}
        {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Upload Document</h2>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setDocumentName('');
                  setUploadingFile(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Document Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={documentName}
                  onChange={(e) => setDocumentName(e.target.value)}
                  placeholder="Enter document name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  maxLength={100}
                />
                <p className="text-xs text-gray-500 mt-1">Give your document a descriptive name</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select File <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  onChange={handleFileSelect}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {uploadingFile && (
                  <p className="text-sm text-gray-600 mt-2">
                    Selected: <span className="font-medium">{uploadingFile.name}</span> 
                    ({(uploadingFile.size / 1024).toFixed(0)} KB)
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">Accepted formats: PDF, DOC, DOCX, JPG, PNG</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <AlertCircle className="w-4 h-4 inline mr-1" />
                  Your document will be reviewed by an admin before it's approved.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowUploadModal(false);
                  setDocumentName('');
                  setUploadingFile(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitDocument}
                disabled={!documentName.trim() || !uploadingFile}
                className={(!documentName.trim() || !uploadingFile) ? 'opacity-50 cursor-not-allowed' : ''}
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload & Submit for Review
              </Button>
            </div>
          </div>
        </div>
        )}
      </div>
    );
  };

  const renderReports = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-shadow group">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <BarChart3 className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Monthly Report</h3>
          <p className="text-sm text-gray-600 mb-4">View your monthly engagement statistics</p>
          <div className="space-y-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors"
              onClick={() => setShowMonthlyReportModal(true)}
            >
              <Eye className="w-4 h-4 mr-2" />
              View Report
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors"
              onClick={() => handleDownloadReport('Monthly')}
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-shadow group">
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <FileText className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Engagement History</h3>
          <p className="text-sm text-gray-600 mb-4">Complete history of all your engagements</p>
          <div className="space-y-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full hover:bg-green-50 hover:border-green-300 hover:text-green-600 transition-colors"
              onClick={() => setShowEngagementHistoryModal(true)}
            >
              <Eye className="w-4 h-4 mr-2" />
              View History
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full hover:bg-green-50 hover:border-green-300 hover:text-green-600 transition-colors"
              onClick={() => handleDownloadReport('Engagement History')}
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-shadow group">
          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <DollarSign className="w-6 h-6 text-purple-600" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Earnings Report</h3>
          <p className="text-sm text-gray-600 mb-4">Track your earnings and payments</p>
          <div className="space-y-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full hover:bg-purple-50 hover:border-purple-300 hover:text-purple-600 transition-colors"
              onClick={() => setShowTransactionsModal(true)}
            >
              <Eye className="w-4 h-4 mr-2" />
              View Transactions
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full hover:bg-purple-50 hover:border-purple-300 hover:text-purple-600 transition-colors"
              onClick={() => handleDownloadReport('Earnings')}
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  const handlePostItem = async () => {
    if (!newItemForm.title || !newItemForm.price) {
      alert('Please fill in all required fields');
      return;
    }

    if (!user.id) {
      alert('User ID not found');
      return;
    }

    if (!isFirebaseConfigured()) {
      alert('Firebase not configured. Cannot post items.');
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
        sellerType: 'SME',
        location: newItemForm.location,
        imageUrl: newItemForm.imageUrl || profileData.profileImage || '/images/collaboration.jpg',
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

    if (!user.id) {
      alert('User ID not found');
      return;
    }

    if (!isFirebaseConfigured()) {
      alert('Firebase not configured. Cannot post want ads.');
      return;
    }

    try {
      const wantAdData = {
        title: newWantForm.title,
        description: newWantForm.description,
        category: newWantForm.category,
        budget: newWantForm.budget,
        buyerId: user.id,
        buyerName: user.profile.name,
        buyerType: 'SME',
        location: newWantForm.location,
        status: 'active',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      await addDoc(collection(db, 'wantAds'), wantAdData);
      
      setNewWantForm({ title: '', description: '', category: 'Materials', budget: '', location: user.profile.location });
      setMarketView('want');
      alert('Want ad posted successfully!');
    } catch (error: any) {
      console.error('Error posting want ad:', error);
      alert('Error posting want ad: ' + error.message);
    }
  };

  const handleApplyToProject = async (project: Project) => {
    if (!isFirebaseConfigured()) return;

    setSelectedProjectForApplication(project);
    setApplicationCoverLetter('');
    setApplicationCV(null);
    setApplicationCVUrl('');
    setApplicationForm({
      experience: '',
      qualifications: '',
      availability: '',
      whyInterested: '',
      relevantSkills: ''
    });
    setShowApplicationModal(true);
  };

  // Handle CV upload
  const handleCVUpload = async (file: File) => {
    if (!isStorageConfigured()) {
      alert('File storage is not configured. Please contact support.');
      return;
    }

    setUploadingCV(true);
    try {
      const fileRef = ref(storage, `project-applications/${user.id}/${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      const downloadURL = await getDownloadURL(fileRef);
      setApplicationCVUrl(downloadURL);
      setApplicationCV(file);
      console.log('✅ CV uploaded successfully:', downloadURL);
    } catch (error: any) {
      console.error('Error uploading CV:', error);
      alert('Failed to upload CV: ' + error.message);
    } finally {
      setUploadingCV(false);
    }
  };

  const handleSubmitApplication = async () => {
    if (!isFirebaseConfigured() || !selectedProjectForApplication) return;

    // Validate required fields
    if (!applicationCoverLetter.trim()) {
      alert('Please provide a cover letter.');
      return;
    }

    if (!applicationCVUrl) {
      alert('Please upload your CV.');
      return;
    }

    try {
      // Check if already applied
      const existingApplication = myApplications.find(
        app => app.projectId === selectedProjectForApplication.id && app.status === 'pending'
      );

      if (existingApplication) {
        alert('You have already applied to this project.');
        return;
      }

      // Create application
      const applicationData = {
        projectId: selectedProjectForApplication.id,
        projectName: selectedProjectForApplication.projectName,
        smeId: user.id,
        smeName: user.profile.name,
        smeEmail: user.email,
        coverLetter: applicationCoverLetter,
        cvUrl: applicationCVUrl,
        applicationForm: {
          experience: applicationForm.experience || '',
          qualifications: applicationForm.qualifications || '',
          availability: applicationForm.availability || '',
          whyInterested: applicationForm.whyInterested || '',
          relevantSkills: applicationForm.relevantSkills || ''
        },
        status: 'pending',
        appliedAt: Timestamp.now()
      };

      const docRef = await addDoc(collection(db, 'projectApplications'), applicationData);

      // Note: applicationsCount is calculated dynamically from projectApplications collection
      // We don't update it here to avoid permission issues (only SDP can update projects)

      // Create notification for SDP
      await createNotification({
        userId: selectedProjectForApplication.sdpId,
        type: 'engagement',
        title: 'New Project Application',
        message: `${user.profile.name} applied to your project: "${selectedProjectForApplication.projectName}"`,
        link: `/dashboard?tab=engagements`,
        metadata: { projectId: selectedProjectForApplication.id, applicationId: docRef.id }
      });

      alert('Application submitted successfully!');
      setShowApplicationModal(false);
      setSelectedProjectForApplication(null);
      setApplicationCoverLetter('');
    } catch (error) {
      console.error('Error submitting application:', error);
      alert('Failed to submit application. Please try again.');
    }
  };

  const renderMarket = () => {
    const categories = ['all', 'Course', 'Certificate', 'Materials', 'Service', 'Other'];
    const filteredItems = marketItems.filter(item => {
      const matchesSearch = item.title.toLowerCase().includes(marketSearch.toLowerCase()) ||
        item.description.toLowerCase().includes(marketSearch.toLowerCase());
      const matchesCategory = marketCategory === 'all' || item.category === marketCategory;
      return matchesSearch && matchesCategory;
    });

    return (
      <div className="space-y-6">
        {/* Market Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl shadow-lg p-6 text-white">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2 flex items-center">
                <ShoppingBag className="w-6 h-6 mr-2" />
                Marketplace
              </h2>
              <p className="text-blue-100">Find work projects</p>
            </div>
          </div>
        </div>

        {/* View Toggle - Always Visible */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-2">
            <Button
              variant={marketView === 'projects' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setMarketView('projects')}
            >
              <Briefcase className="w-4 h-4 mr-2" />
              Projects ({availableProjects.length})
            </Button>
          </div>
        </div>

        {/* View Tabs */}

        {/* Projects View */}
        {marketView === 'projects' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Available Projects</h2>
                  <p className="text-sm text-gray-600 mt-1">Browse and apply to projects posted by SDPs</p>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant={marketView === 'projects' ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => setMarketView('projects')}
                  >
                    <Briefcase className="w-4 h-4 mr-2" />
                    Projects ({availableProjects.length})
                  </Button>
                </div>
              </div>

              {/* Projects Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {availableProjects.map(project => {
                  const hasApplied = myApplications.some(app => app.projectId === project.id);
                  const myApplication = myApplications.find(app => app.projectId === project.id);
                  
                  return (
                    <div key={project.id} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                      {project.thumbnail && (
                        <div className="w-full h-48 bg-gray-100">
                          <img 
                            src={project.thumbnail} 
                            alt={project.projectName}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      <div className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">{project.projectName}</h3>
                            <p className="text-sm text-gray-600 mb-3 line-clamp-3">{project.description}</p>
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
                          </div>
                        </div>

                        {hasApplied && myApplication && (
                        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-blue-900">
                              Application Status: 
                              <Badge variant={
                                myApplication.status === 'accepted' ? 'success' : 
                                myApplication.status === 'rejected' ? 'danger' : 
                                'warning'
                              } className="ml-2">
                                {myApplication.status}
                              </Badge>
                            </span>
                          </div>
                          {myApplication.rejectionReason && (
                            <p className="text-xs text-red-600 mt-2">Reason: {myApplication.rejectionReason}</p>
                          )}
                        </div>
                        )}

                        <div className="flex items-center space-x-2">
                        {!hasApplied ? (
                          <Button
                            className="flex-1"
                            onClick={() => handleApplyToProject(project)}
                          >
                            <Briefcase className="w-4 h-4 mr-2" />
                            Apply Now
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            className="flex-1"
                            disabled
                          >
                            {myApplication?.status === 'pending' ? 'Application Pending' : 
                             myApplication?.status === 'accepted' ? 'Application Accepted' : 
                             'Application Rejected'}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSelectedProjectForApplication(project);
                            setShowApplicationModal(true);
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {availableProjects.length === 0 && (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <Briefcase className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No projects available</h3>
                  <p className="text-gray-600">Check back later for new project opportunities.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const handleSaveBillingInfo = async () => {
    if (!user.id || !isFirebaseConfigured()) {
      alert('Cannot save billing information. Firebase not configured.');
      return;
    }

    // Validate required fields
    if (!billingInfo.bankName || !billingInfo.accountHolderName || !billingInfo.accountNumber) {
      alert('Please fill in all required fields: Bank Name, Account Holder Name, and Account Number.');
      return;
    }

    // Validate account number (should be numeric)
    if (!/^\d+$/.test(billingInfo.accountNumber.replace(/\s/g, ''))) {
      alert('Account number must contain only numbers.');
      return;
    }

    try {
      await updateDoc(doc(db, 'users', user.id), {
        billingInfo: {
          bankName: billingInfo.bankName.trim(),
          accountHolderName: billingInfo.accountHolderName.trim(),
          accountNumber: billingInfo.accountNumber.replace(/\s/g, ''), // Remove spaces
          accountType: billingInfo.accountType,
          branchCode: billingInfo.branchCode.trim(),
          email: billingInfo.email.trim(),
          phone: billingInfo.phone.trim(),
          updatedAt: Timestamp.now()
        },
        updatedAt: Timestamp.now()
      });

      alert('✅ Billing information saved successfully!');
      setShowBillingModal(false);
    } catch (error: any) {
      console.error('Error saving billing info:', error);
      alert(`❌ Failed to save billing information: ${error.message || 'Please try again.'}`);
    }
  };

  const renderSettings = () => (
    <div className="space-y-6">
      {/* Account Settings */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
          <User className="w-5 h-5 mr-2 text-blue-600" />
          Account Settings
        </h3>
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="font-medium text-gray-900">Account Status</p>
              {(() => {
                const userData = user as any;
                const isRejected = userData.rejected || (user.profile as any).rejected;
                const isVerified = user.verified;
                
                if (isRejected) {
                  return (
                    <Badge variant="danger" size="sm">
                      <XCircle className="w-3 h-3 mr-1" />
                      Rejected
                    </Badge>
                  );
                } else if (isVerified) {
                  return (
                    <Badge variant="success" size="sm">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Approved
                    </Badge>
                  );
                } else {
                  return (
                    <Badge variant="warning" size="sm">
                      <Clock className="w-3 h-3 mr-1" />
                      Pending Verification
                    </Badge>
                  );
                }
              })()}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {(() => {
                const userData = user as any;
                const isRejected = userData.rejected || (user.profile as any).rejected;
                const isVerified = user.verified;
                const rejectionReason = userData.rejectionReason || (user.profile as any).rejectionReason;
                
                if (isRejected) {
                  return rejectionReason 
                    ? `Your application has been rejected. Reason: ${rejectionReason}`
                    : 'Your application has been rejected. Please contact support for more information.';
                } else if (isVerified) {
                  return 'Your account has been verified and is active.';
                } else {
                  return 'Your account verification is pending admin approval.';
                }
              })()}
            </p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="font-medium text-gray-900">User Role</p>
              <Badge variant="default" size="sm">{user.role}</Badge>
            </div>
            <p className="text-sm text-gray-500 mt-1">Your account type and permissions</p>
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
          <Bell className="w-5 h-5 mr-2 text-blue-600" />
          Notification Settings
        </h3>
        <div className="space-y-5">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
            <div className="flex-1">
              <p className="font-medium text-gray-900">Email Notifications</p>
              <p className="text-sm text-gray-500 mt-1">Receive updates about engagements, payments, and messages</p>
            </div>
            <button 
              onClick={() => setEmailNotifications(!emailNotifications)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                emailNotifications ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                emailNotifications ? 'translate-x-6' : 'translate-x-1'
              }`}></span>
            </button>
          </div>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
            <div className="flex-1">
              <p className="font-medium text-gray-900">SMS Notifications</p>
              <p className="text-sm text-gray-500 mt-1">Get instant alerts via SMS for important updates</p>
            </div>
            <button 
              onClick={() => setSmsNotifications(!smsNotifications)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                smsNotifications ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                smsNotifications ? 'translate-x-6' : 'translate-x-1'
              }`}></span>
            </button>
          </div>
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Notification preferences are saved automatically. You can change these settings at any time.
            </p>
          </div>
        </div>
      </div>

      {/* Payment & Billing Settings */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
          <CreditCard className="w-5 h-5 mr-2 text-blue-600" />
          Payment & Billing
        </h3>
        <div className="space-y-4">
          <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-semibold text-gray-900">Bank Account Information</p>
                <p className="text-sm text-gray-600 mt-1">
                  {billingInfo.bankName && billingInfo.accountNumber
                    ? `${billingInfo.bankName} • ••••${billingInfo.accountNumber.slice(-4)}`
                    : 'No bank account information saved'}
                </p>
              </div>
              {billingInfo.bankName && (
                <Badge variant="success" size="sm">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Configured
                </Badge>
              )}
            </div>
            <Button 
              onClick={() => setShowBillingModal(true)}
              className="w-full mt-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
            >
              <CreditCard className="w-4 h-4 mr-2" />
              {billingInfo.bankName ? 'Update Billing Information' : 'Add Billing Information'}
            </Button>
          </div>

          <div className="space-y-3 pt-4 border-t border-gray-200">
            <Button 
              variant="outline" 
              className="w-full justify-start hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors"
              onClick={() => {
                // Generate invoices from completed engagements
                const completedEngagements = engagements.filter(e => 
                  e.status === 'Completed' && e.paymentConfirmedByAdmin
                );
                if (completedEngagements.length === 0) {
                  alert('No completed engagements with confirmed payments to generate invoices.');
                  return;
                }
                handleDownloadReport('Earnings');
              }}
            >
              <Download className="w-4 h-4 mr-2" />
              Download Payment History
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors"
              onClick={() => setShowTransactionsModal(true)}
            >
              <Eye className="w-4 h-4 mr-2" />
              View Transaction History
            </Button>
          </div>
        </div>
      </div>

      {/* Privacy & Security */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
          <Shield className="w-5 h-5 mr-2 text-blue-600" />
          Privacy & Security
        </h3>
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="font-medium text-gray-900 mb-2">Data Protection</p>
            <p className="text-sm text-gray-600">
              Your billing information is encrypted and stored securely. We use industry-standard security measures to protect your data.
            </p>
          </div>
          <Button 
            variant="outline" 
            className="w-full justify-start hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors"
            onClick={() => alert('Privacy policy will open in a new window.')}
          >
            <Shield className="w-4 h-4 mr-2" />
            View Privacy Policy
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Profile Banner Card */}
        <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-purple-600 rounded-2xl shadow-xl mb-6 overflow-hidden">
          <div className="p-6 md:p-8 relative">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
            </div>
            
            <div className="relative flex flex-col md:flex-row md:items-center md:justify-between">
              <div className="flex items-center space-x-5 mb-4 md:mb-0">
                <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center ring-4 ring-white/30">
                  {profileData.profileImage || (user.profile as any).profileImage ? (
                    <img
                      src={profileData.profileImage || (user.profile as any).profileImage}
                      alt={user.profile.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-10 h-10 text-white" />
                  )}
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
                  <p className="text-blue-100 text-sm mb-2">{(user.profile.roles || (user.profile.role ? [user.profile.role] : [])).join(', ')} • {user.profile.location}</p>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1">
                      <Star className="w-4 h-4 text-yellow-300 fill-yellow-300" />
                      <span className="text-sm font-semibold">
                        {(() => {
                          const smeProfile = user.profile as any;
                          const displayRating = (smeProfile.rating || 0.0).toFixed(1);
                          const reviewCount = smeProfile.reviews || 0;
                          return `${displayRating} (${reviewCount})`;
                        })()}
                      </span>
                    </div>
                    <button
                      onClick={() => setShowAvailabilityPopout(true)}
                      className={`group relative flex items-center space-x-2 px-4 py-2 rounded-full font-medium text-sm transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 ${
                        (profileData.availability || user.profile.availability) === 'Available' 
                          ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700' 
                          : (profileData.availability || user.profile.availability) === 'Busy'
                          ? 'bg-gradient-to-r from-yellow-500 to-amber-600 text-white hover:from-yellow-600 hover:to-amber-700'
                          : (profileData.availability || user.profile.availability) === 'Offline'
                          ? 'bg-gradient-to-r from-gray-500 to-gray-600 text-white hover:from-gray-600 hover:to-gray-700'
                          : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700'
                      }`}
                    >
                      <div className={`w-2.5 h-2.5 rounded-full ${
                        (profileData.availability || user.profile.availability) === 'Available' ? 'bg-white animate-pulse' :
                        (profileData.availability || user.profile.availability) === 'Busy' ? 'bg-white' :
                        (profileData.availability || user.profile.availability) === 'Offline' ? 'bg-white' :
                        'bg-white'
                      }`}></div>
                      <span className="font-semibold">{profileData.availability || user.profile.availability}</span>
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    {(() => {
                      const userData = user as any;
                      const isRejected = userData.rejected || (user.profile as any).rejected;
                      const isVerified = user.verified;
                      
                      if (isRejected) {
                        return (
                          <Badge variant="danger" size="sm" className="shadow-lg">
                            <XCircle className="w-3 h-3 mr-1" />
                            Rejected
                          </Badge>
                        );
                      } else if (isVerified) {
                        return (
                          <Badge variant="success" size="sm" className="shadow-lg">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Approved
                          </Badge>
                        );
                      } else {
                        return (
                          <Badge variant="warning" size="sm" className="shadow-lg">
                            <Clock className="w-3 h-3 mr-1" />
                            Pending
                          </Badge>
                        );
                      }
                    })()}
                  </div>
                </div>
              </div>
              
              <Button 
                onClick={() => setActiveTab('profile')}
                className="bg-white text-blue-600 hover:bg-blue-50 shadow-lg hover:shadow-xl transition-all"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Profile
              </Button>
            </div>
          </div>
        </div>

        {/* Modern Tab Navigation */}
        <div className="mb-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-1">
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-1">
              {tabs.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex flex-col items-center justify-center px-4 py-3 rounded-xl font-medium text-xs transition-all ${
                      isActive
                        ? 'bg-gradient-to-br from-blue-600 to-purple-600 text-white shadow-md scale-105'
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
          {activeTab === 'engagements' && renderEngagements()}
          {activeTab === 'profile' && renderProfile()}
          {activeTab === 'documents' && renderDocuments()}
          {activeTab === 'reports' && renderReports()}
          {activeTab === 'settings' && renderSettings()}
        </div>
      </div>

      {/* Application Modal */}
      {showApplicationModal && selectedProjectForApplication && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                    <Briefcase className="w-6 h-6 mr-2 text-blue-600" />
                    Apply to Project
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">{selectedProjectForApplication.projectName}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowApplicationModal(false);
                    setSelectedProjectForApplication(null);
                    setApplicationCoverLetter('');
                  }}
                  className="hover:bg-gray-100"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Project Details */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2">Project Details</h3>
                <p className="text-sm text-gray-600 mb-2">{selectedProjectForApplication.description}</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Type:</span>
                    <span className="ml-2 font-medium">{selectedProjectForApplication.projectType}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Budget:</span>
                    <span className="ml-2 font-medium">{selectedProjectForApplication.budget}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Posted by:</span>
                    <span className="ml-2 font-medium">{selectedProjectForApplication.sdpName}</span>
                  </div>
                  {selectedProjectForApplication.startDate && (
                    <div>
                      <span className="text-gray-500">Start Date:</span>
                      <span className="ml-2 font-medium">
                        {new Date(selectedProjectForApplication.startDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* CV Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload CV <span className="text-red-500">*</span>
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  {applicationCVUrl ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-center space-x-2 text-green-600">
                        <FileText className="w-8 h-8" />
                        <span className="font-medium">CV Uploaded Successfully</span>
                      </div>
                      <p className="text-sm text-gray-600">{applicationCV?.name}</p>
                      <div className="flex items-center justify-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setApplicationCV(null);
                            setApplicationCVUrl('');
                          }}
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
                            input.accept = '.pdf,.doc,.docx';
                            input.onchange = async (e: any) => {
                              const file = e.target.files[0];
                              if (file) {
                                await handleCVUpload(file);
                              }
                            };
                            input.click();
                          }}
                          disabled={uploadingCV}
                        >
                          {uploadingCV ? 'Uploading...' : 'Change CV'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <FileText className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600 mb-2">Upload your CV (PDF, DOC, or DOCX)</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = '.pdf,.doc,.docx';
                          input.onchange = async (e: any) => {
                            const file = e.target.files[0];
                            if (file) {
                              await handleCVUpload(file);
                            }
                          };
                          input.click();
                        }}
                        disabled={uploadingCV}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {uploadingCV ? 'Uploading...' : 'Choose CV File'}
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Application Form */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Application Form</h3>
                
                {/* Experience */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Relevant Experience
                  </label>
                  <textarea
                    value={applicationForm.experience}
                    onChange={(e) => setApplicationForm({ ...applicationForm, experience: e.target.value })}
                    placeholder="Describe your relevant experience for this project..."
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>

                {/* Qualifications */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Qualifications
                  </label>
                  <textarea
                    value={applicationForm.qualifications}
                    onChange={(e) => setApplicationForm({ ...applicationForm, qualifications: e.target.value })}
                    placeholder="List your relevant qualifications..."
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>

                {/* Relevant Skills */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Relevant Skills
                  </label>
                  <textarea
                    value={applicationForm.relevantSkills}
                    onChange={(e) => setApplicationForm({ ...applicationForm, relevantSkills: e.target.value })}
                    placeholder="List skills that make you suitable for this project..."
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>

                {/* Availability */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Availability
                  </label>
                  <textarea
                    value={applicationForm.availability}
                    onChange={(e) => setApplicationForm({ ...applicationForm, availability: e.target.value })}
                    placeholder="When are you available to work on this project?"
                    rows={2}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>

                {/* Why Interested */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Why are you interested in this project?
                  </label>
                  <textarea
                    value={applicationForm.whyInterested}
                    onChange={(e) => setApplicationForm({ ...applicationForm, whyInterested: e.target.value })}
                    placeholder="Explain why you want to work on this project..."
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>
              </div>

              {/* Cover Letter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cover Letter <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={applicationCoverLetter}
                  onChange={(e) => setApplicationCoverLetter(e.target.value)}
                  placeholder="Tell the SDP why you're a good fit for this project..."
                  rows={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Required: Add a brief message explaining your interest and qualifications
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 flex items-center justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowApplicationModal(false);
                  setSelectedProjectForApplication(null);
                  setApplicationCoverLetter('');
                  setApplicationCV(null);
                  setApplicationCVUrl('');
                  setApplicationForm({
                    experience: '',
                    qualifications: '',
                    availability: '',
                    whyInterested: '',
                    relevantSkills: ''
                  });
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitApplication}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Send className="w-4 h-4 mr-2" />
                Submit Application
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Modal */}
      {showChatModal && selectedEngagement && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Message with {selectedEngagement.sdp}</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedEngagement.type} • {selectedEngagement.status}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowChatModal(false);
                    setSelectedEngagement(null);
                    setChatMessages([]);
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {chatMessages.length > 0 ? (
                chatMessages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex ${msg.senderId === user.id ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                        msg.senderId === user.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <p className="text-sm font-medium mb-1">{msg.senderName}</p>
                      <p>{msg.message}</p>
                      <p className="text-xs mt-1 opacity-75">
                        {(() => {
                          try {
                            if (msg.timestamp?.seconds) {
                              return new Date(msg.timestamp.seconds * 1000).toLocaleTimeString();
                            } else if (msg.timestamp) {
                              return new Date(msg.timestamp).toLocaleTimeString();
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
              ) : (
                <div className="text-center py-12">
                  <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No messages yet. Start the conversation!</p>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-6 border-t border-gray-200">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendEngagementMessage()}
                  placeholder="Type your message..."
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <Button
                  onClick={handleSendEngagementMessage}
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

      {/* Project View Modal */}
      {showProjectModal && viewingProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white p-6 border-b border-gray-200 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {viewingProject.projectName || viewingProject.type}
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    From: {viewingProject.sdp}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowProjectModal(false);
                    setViewingProject(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Project Details */}
            <div className="p-6 space-y-6">
              {/* Status Badge */}
              <div className="flex items-center space-x-3">
                <Badge 
                  variant={
                    viewingProject.status === 'Completed' ? 'success' :
                    viewingProject.status === 'In Progress' ? 'info' :
                    viewingProject.status === 'Pending' ? 'warning' : 'default'
                  }
                  size="lg"
                >
                  {viewingProject.status}
                </Badge>
                <span className="text-sm text-gray-500">
                  Project Type: {viewingProject.type}
                </span>
              </div>

              {/* Timeline & Budget */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="flex items-center space-x-2 text-blue-600 mb-2">
                    <Calendar className="w-5 h-5" />
                    <span className="font-semibold">Timeline</span>
                  </div>
                  <p className="text-sm text-gray-700">
                    <strong>Start:</strong> {viewingProject.startDate || 'TBD'}
                  </p>
                  <p className="text-sm text-gray-700">
                    <strong>End:</strong> {viewingProject.endDate || 'TBD'}
                  </p>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="flex items-center space-x-2 text-green-600 mb-2">
                    <DollarSign className="w-5 h-5" />
                    <span className="font-semibold">Budget</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{viewingProject.fee}</p>
                </div>
              </div>

              {/* Description */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <FileText className="w-5 h-5 mr-2 text-blue-600" />
                  Project Description
                </h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-700 whitespace-pre-wrap">{viewingProject.description}</p>
                </div>
              </div>

              {/* Deliverables */}
              {viewingProject.deliverables && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                    <Package className="w-5 h-5 mr-2 text-purple-600" />
                    Expected Deliverables
                  </h3>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <p className="text-gray-700 whitespace-pre-wrap">{viewingProject.deliverables}</p>
                  </div>
                </div>
              )}

              {/* Milestones */}
              {viewingProject.milestones && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                    <Award className="w-5 h-5 mr-2 text-orange-600" />
                    Project Milestones
                  </h3>
                  <div className="bg-orange-50 rounded-lg p-4 space-y-3">
                    {Array.isArray(viewingProject.milestones) ? (
                      viewingProject.milestones.map((milestone: any, index: number) => (
                        <div
                          key={milestone.id || milestone.title || index}
                          className="bg-white/80 rounded-lg border border-orange-200 p-3 shadow-sm"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-semibold text-gray-900">
                              {milestone.order ? `${milestone.order}. ` : ''}
                              {milestone.title || 'Milestone'}
                            </p>
                            {milestone.status && (
                              <Badge
                                variant={
                                  milestone.status === 'completed'
                                    ? 'success'
                                    : milestone.status === 'in_progress'
                                      ? 'info'
                                      : 'warning'
                                }
                                size="sm"
                              >
                                {milestone.status.replace('_', ' ')}
                              </Badge>
                            )}
                          </div>
                          {milestone.description && (
                            <p className="text-sm text-gray-600">{milestone.description}</p>
                          )}
                          {milestone.requiresDocument && (
                            <div className="mt-2 inline-flex items-center text-xs font-medium text-orange-700 bg-orange-100 border border-orange-200 rounded-full px-2 py-1">
                              <FileText className="w-3 h-3 mr-1" />
                              Requires document
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-700 whitespace-pre-wrap">{viewingProject.milestones}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200 rounded-b-2xl flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => {
                  setShowProjectModal(false);
                  setViewingProject(null);
                }}
              >
                Close
              </Button>
              
              {viewingProject.status === 'Pending' && (
                <div className="flex items-center space-x-3">
                  <Button
                    variant="outline"
                    onClick={handleRejectProject}
                    className="border-red-300 text-red-600 hover:bg-red-50"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Decline Project
                  </Button>
                  <Button
                    onClick={handleAcceptProject}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Accept Project
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Project Progress Modal */}
      {showProgressModal && selectedProjectForProgress && (
        <ProjectProgressModal
          engagement={selectedProjectForProgress}
          userRole="SME"
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

      {/* Transactions Modal */}
      {showTransactionsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                    <DollarSign className="w-6 h-6 mr-2 text-purple-600" />
                    Payment Transactions
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">View all confirmed payments and earnings</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTransactionsModal(false)}
                  className="hover:bg-gray-100"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {(() => {
                // Filter engagements with confirmed payments
                const confirmedTransactions = engagements.filter(eng => 
                  eng.status === 'Completed' && 
                  eng.paymentConfirmedByAdmin === true
                );

                // Sort by payment confirmation date (newest first)
                confirmedTransactions.sort((a, b) => {
                  const dateA = a.paymentConfirmedAt?.toDate ? a.paymentConfirmedAt.toDate() : new Date(0);
                  const dateB = b.paymentConfirmedAt?.toDate ? b.paymentConfirmedAt.toDate() : new Date(0);
                  return dateB.getTime() - dateA.getTime();
                });

                if (confirmedTransactions.length === 0) {
                  return (
                    <div className="text-center py-12">
                      <CreditCard className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No Transactions Yet</h3>
                      <p className="text-gray-600">You don't have any confirmed payments at this time.</p>
                      <p className="text-sm text-gray-500 mt-2">Completed projects will appear here once payments are confirmed by admin.</p>
                    </div>
                  );
                }

                // Calculate totals
                let totalAmount = 0;
                confirmedTransactions.forEach(eng => {
                  const feeValue = eng.fee ? parseFloat(eng.fee.replace(/[^0-9.]/g, '')) : 0;
                  totalAmount += feeValue;
                });

                return (
                  <div className="space-y-4">
                    {/* Summary Card */}
                    <div className="bg-gradient-to-r from-purple-100 to-blue-100 rounded-xl p-6 mb-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-1">Total Confirmed Payments</p>
                          <p className="text-3xl font-bold text-gray-900">R{totalAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                          <p className="text-sm text-gray-600 mt-2">{confirmedTransactions.length} transaction{confirmedTransactions.length !== 1 ? 's' : ''}</p>
                        </div>
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
                          <DollarSign className="w-8 h-8 text-purple-600" />
                        </div>
                      </div>
                    </div>

                    {/* Transactions List */}
                    <div className="space-y-3">
                      {confirmedTransactions.map((transaction, index) => {
                        const feeValue = transaction.fee ? parseFloat(transaction.fee.replace(/[^0-9.]/g, '')) : 0;
                        const confirmedDate = transaction.paymentConfirmedAt?.toDate 
                          ? transaction.paymentConfirmedAt.toDate() 
                          : transaction.fundsReleasedAt?.toDate 
                            ? transaction.fundsReleasedAt.toDate() 
                            : new Date();
                        const completedDate = transaction.smeCompletedAt?.toDate 
                          ? transaction.smeCompletedAt.toDate() 
                          : null;

                        return (
                          <div
                            key={transaction.id || index}
                            className="bg-white border-2 border-gray-200 rounded-xl p-5 hover:shadow-md transition-all"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-3 mb-3">
                                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                                    <CheckCircle className="w-6 h-6 text-green-600" />
                                  </div>
                                  <div className="flex-1">
                                    <h3 className="font-bold text-gray-900 text-lg">
                                      {transaction.projectName || transaction.type}
                                    </h3>
                                    <p className="text-sm text-gray-600">
                                      {transaction.sdp} • {transaction.type}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-2xl font-bold text-green-600">
                                      {transaction.fee || 'R0'}
                                    </p>
                                    <Badge variant="success" size="sm" className="mt-1">
                                      <CheckCircle className="w-3 h-3 mr-1" />
                                      Confirmed
                                    </Badge>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-200">
                                  <div>
                                    <p className="text-xs font-medium text-gray-500 mb-1">Payment Confirmed</p>
                                    <p className="text-sm font-semibold text-gray-900">
                                      {confirmedDate.toLocaleDateString('en-ZA', { 
                                        year: 'numeric', 
                                        month: 'short', 
                                        day: 'numeric' 
                                      })}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {confirmedDate.toLocaleTimeString('en-ZA', { 
                                        hour: '2-digit', 
                                        minute: '2-digit' 
                                      })}
                                    </p>
                                  </div>
                                  {completedDate && (
                                    <div>
                                      <p className="text-xs font-medium text-gray-500 mb-1">Project Completed</p>
                                      <p className="text-sm font-semibold text-gray-900">
                                        {completedDate.toLocaleDateString('en-ZA', { 
                                          year: 'numeric', 
                                          month: 'short', 
                                          day: 'numeric' 
                                        })}
                                      </p>
                                    </div>
                                  )}
                                  <div>
                                    <p className="text-xs font-medium text-gray-500 mb-1">Status</p>
                                    <p className="text-sm font-semibold text-gray-900">{transaction.status}</p>
                                  </div>
                                  {transaction.paymentConfirmationComment && (
                                    <div>
                                      <p className="text-xs font-medium text-gray-500 mb-1">Admin Note</p>
                                      <p className="text-sm text-gray-900">{transaction.paymentConfirmationComment}</p>
                                    </div>
                                  )}
                                </div>

                                {transaction.description && (
                                  <div className="mt-3 pt-3 border-t border-gray-200">
                                    <p className="text-xs font-medium text-gray-500 mb-1">Description</p>
                                    <p className="text-sm text-gray-700">{transaction.description}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Only payments confirmed by admin are shown here
                </p>
                <Button
                  onClick={() => setShowTransactionsModal(false)}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Monthly Report Modal */}
      {showMonthlyReportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                    <BarChart3 className="w-6 h-6 mr-2 text-blue-600" />
                    Monthly Engagement Report
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">View your monthly engagement statistics and performance</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMonthlyReportModal(false)}
                  className="hover:bg-gray-100"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {(() => {
                // Group engagements by month
                const monthlyData: { [key: string]: { engagements: Engagement[]; totalEarnings: number; completed: number } } = {};
                
                engagements.forEach(eng => {
                  const date = eng.startDate ? new Date(eng.startDate) : new Date();
                  const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                  const monthName = date.toLocaleDateString('en-ZA', { year: 'numeric', month: 'long' });
                  
                  if (!monthlyData[monthName]) {
                    monthlyData[monthName] = { engagements: [], totalEarnings: 0, completed: 0 };
                  }
                  
                  monthlyData[monthName].engagements.push(eng);
                  
                  if (eng.status === 'Completed') {
                    monthlyData[monthName].completed++;
                    const feeValue = eng.fee ? parseFloat(eng.fee.replace(/[^0-9.]/g, '')) : 0;
                    monthlyData[monthName].totalEarnings += feeValue;
                  }
                });

                const months = Object.keys(monthlyData).sort((a, b) => {
                  return new Date(b).getTime() - new Date(a).getTime();
                });

                if (months.length === 0) {
                  return (
                    <div className="text-center py-12">
                      <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No Monthly Data Yet</h3>
                      <p className="text-gray-600">You don't have any projects to display in monthly reports.</p>
                    </div>
                  );
                }

                // Calculate overall totals
                let totalProjects = 0;
                let totalCompleted = 0;
                let totalEarnings = 0;
                months.forEach(month => {
                  totalProjects += monthlyData[month].engagements.length;
                  totalCompleted += monthlyData[month].completed;
                  totalEarnings += monthlyData[month].totalEarnings;
                });

                return (
                  <div className="space-y-6">
                    {/* Summary Card */}
                    <div className="bg-gradient-to-r from-blue-100 to-purple-100 rounded-xl p-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-1">Total Projects</p>
                          <p className="text-3xl font-bold text-gray-900">{totalProjects}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-1">Completed</p>
                          <p className="text-3xl font-bold text-green-600">{totalCompleted}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-1">Total Earnings</p>
                          <p className="text-3xl font-bold text-purple-600">R{totalEarnings.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>
                      </div>
                    </div>

                    {/* Monthly Breakdown */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-gray-900">Monthly Breakdown</h3>
                      {months.map(month => {
                        const data = monthlyData[month];
                        const statusCounts = {
                          pending: data.engagements.filter(e => e.status === 'Pending').length,
                          inProgress: data.engagements.filter(e => e.status === 'In Progress').length,
                          completed: data.engagements.filter(e => e.status === 'Completed').length,
                          cancelled: data.engagements.filter(e => e.status === 'Cancelled').length,
                          disputed: data.engagements.filter(e => e.status === 'Disputed').length
                        };

                        return (
                          <div key={month} className="bg-white border-2 border-gray-200 rounded-xl p-5 hover:shadow-md transition-all">
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="text-xl font-bold text-gray-900">{month}</h4>
                              <Badge variant="default" size="sm">
                                {data.engagements.length} project{data.engagements.length !== 1 ? 's' : ''}
                              </Badge>
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                              <div className="bg-blue-50 rounded-lg p-3">
                                <p className="text-xs font-medium text-gray-600 mb-1">Pending</p>
                                <p className="text-lg font-bold text-blue-600">{statusCounts.pending}</p>
                              </div>
                              <div className="bg-amber-50 rounded-lg p-3">
                                <p className="text-xs font-medium text-gray-600 mb-1">In Progress</p>
                                <p className="text-lg font-bold text-amber-600">{statusCounts.inProgress}</p>
                              </div>
                              <div className="bg-green-50 rounded-lg p-3">
                                <p className="text-xs font-medium text-gray-600 mb-1">Completed</p>
                                <p className="text-lg font-bold text-green-600">{statusCounts.completed}</p>
                              </div>
                              <div className="bg-red-50 rounded-lg p-3">
                                <p className="text-xs font-medium text-gray-600 mb-1">Cancelled</p>
                                <p className="text-lg font-bold text-red-600">{statusCounts.cancelled}</p>
                              </div>
                              <div className="bg-orange-50 rounded-lg p-3">
                                <p className="text-xs font-medium text-gray-600 mb-1">Disputed</p>
                                <p className="text-lg font-bold text-orange-600">{statusCounts.disputed}</p>
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                              <div>
                                <p className="text-xs font-medium text-gray-600 mb-1">Monthly Earnings</p>
                                <p className="text-lg font-bold text-purple-600">
                                  R{data.totalEarnings.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs font-medium text-gray-600 mb-1">Completion Rate</p>
                                <p className="text-lg font-bold text-gray-900">
                                  {data.engagements.length > 0 
                                    ? Math.round((data.completed / data.engagements.length) * 100) 
                                    : 0}%
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Statistics based on all your engagements
                </p>
                <Button
                  onClick={() => setShowMonthlyReportModal(false)}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Project History Modal */}
      {showEngagementHistoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-green-50 to-blue-50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                    <FileText className="w-6 h-6 mr-2 text-green-600" />
                    Project History
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">Complete history of all your projects</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEngagementHistoryModal(false)}
                  className="hover:bg-gray-100"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {engagements.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Projects Yet</h3>
                  <p className="text-gray-600">You don't have any projects in your history.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Summary Stats */}
                  <div className="bg-gradient-to-r from-green-100 to-blue-100 rounded-xl p-6 mb-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-1">Total Projects</p>
                        <p className="text-2xl font-bold text-gray-900">{engagements.length}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-1">Completed</p>
                        <p className="text-2xl font-bold text-green-600">
                          {engagements.filter(e => e.status === 'Completed').length}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-1">In Progress</p>
                        <p className="text-2xl font-bold text-amber-600">
                          {engagements.filter(e => e.status === 'In Progress').length}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-1">Pending</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {engagements.filter(e => e.status === 'Pending').length}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Projects List */}
                  <div className="space-y-3">
                    {[...engagements].sort((a, b) => {
                      const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
                      const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
                      return dateB - dateA;
                    }).map((engagement, index) => {
                      const getStatusBadge = (status: string) => {
                        const variants: { [key: string]: 'success' | 'warning' | 'danger' | 'default' } = {
                          'Completed': 'success',
                          'In Progress': 'warning',
                          'Pending': 'default',
                          'Cancelled': 'danger',
                          'Disputed': 'danger'
                        };
                        return (
                          <Badge variant={variants[status] || 'default'} size="sm">
                            {status}
                          </Badge>
                        );
                      };

                      const startDate = engagement.startDate ? new Date(engagement.startDate) : null;
                      const endDate = engagement.endDate ? new Date(engagement.endDate) : null;

                      return (
                        <div
                          key={engagement.id || index}
                          className="bg-white border-2 border-gray-200 rounded-xl p-5 hover:shadow-md transition-all"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3 mb-2">
                                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                  <Briefcase className="w-6 h-6 text-blue-600" />
                                </div>
                                <div className="flex-1">
                                  <h3 className="font-bold text-gray-900 text-lg">
                                    {engagement.projectName || engagement.type}
                                  </h3>
                                  <p className="text-sm text-gray-600">
                                    {engagement.sdp} • {engagement.type}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xl font-bold text-gray-900 mb-1">
                                    {engagement.fee || 'R0'}
                                  </p>
                                  {getStatusBadge(engagement.status)}
                                </div>
                              </div>

                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-200">
                                {startDate && (
                                  <div>
                                    <p className="text-xs font-medium text-gray-500 mb-1">Start Date</p>
                                    <p className="text-sm font-semibold text-gray-900">
                                      {startDate.toLocaleDateString('en-ZA', { 
                                        year: 'numeric', 
                                        month: 'short', 
                                        day: 'numeric' 
                                      })}
                                    </p>
                                  </div>
                                )}
                                {endDate && (
                                  <div>
                                    <p className="text-xs font-medium text-gray-500 mb-1">End Date</p>
                                    <p className="text-sm font-semibold text-gray-900">
                                      {endDate.toLocaleDateString('en-ZA', { 
                                        year: 'numeric', 
                                        month: 'short', 
                                        day: 'numeric' 
                                      })}
                                    </p>
                                  </div>
                                )}
                                {engagement.progressPercentage !== undefined && (
                                  <div>
                                    <p className="text-xs font-medium text-gray-500 mb-1">Progress</p>
                                    <p className="text-sm font-semibold text-gray-900">
                                      {engagement.progressPercentage}%
                                    </p>
                                  </div>
                                )}
                                <div>
                                  <p className="text-xs font-medium text-gray-500 mb-1">Duration</p>
                                  <p className="text-sm font-semibold text-gray-900">
                                    {startDate && endDate 
                                      ? `${Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))} days`
                                      : 'N/A'}
                                  </p>
                                </div>
                              </div>

                              {engagement.description && (
                                <div className="mt-3 pt-3 border-t border-gray-200">
                                  <p className="text-xs font-medium text-gray-500 mb-1">Description</p>
                                  <p className="text-sm text-gray-700">{engagement.description}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Showing all {engagements.length} project{engagements.length !== 1 ? 's' : ''}
                </p>
                <Button
                  onClick={() => setShowEngagementHistoryModal(false)}
                  className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Availability Popout Modal */}
      {showAvailabilityPopout && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Update Availability</h2>
                    <p className="text-blue-100 text-sm mt-1">Choose your current availability status</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAvailabilityPopout(false)}
                  className="text-white/80 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-3">
              {(['Available', 'Busy', 'Offline', 'Away'] as const).map((status) => {
                const statusConfig = {
                  Available: { 
                    gradient: 'from-green-500 to-emerald-600', 
                    hoverGradient: 'hover:from-green-600 hover:to-emerald-700',
                    icon: 'bg-green-500',
                    ring: 'ring-green-200',
                    description: 'You are currently available for new engagements'
                  },
                  Busy: { 
                    gradient: 'from-yellow-500 to-amber-600', 
                    hoverGradient: 'hover:from-yellow-600 hover:to-amber-700',
                    icon: 'bg-yellow-500',
                    ring: 'ring-yellow-200',
                    description: 'You are currently busy but may accept urgent requests'
                  },
                  Offline: { 
                    gradient: 'from-gray-500 to-gray-600', 
                    hoverGradient: 'hover:from-gray-600 hover:to-gray-700',
                    icon: 'bg-gray-500',
                    ring: 'ring-gray-200',
                    description: 'You are currently offline and not accepting new engagements'
                  },
                  Away: { 
                    gradient: 'from-orange-500 to-orange-600', 
                    hoverGradient: 'hover:from-orange-600 hover:to-orange-700',
                    icon: 'bg-orange-500',
                    ring: 'ring-orange-200',
                    description: 'You are away but may check messages periodically'
                  }
                };
                const config = statusConfig[status];
                const isSelected = (profileData.availability || user.profile.availability) === status;

                return (
                  <button
                    key={status}
                    onClick={() => handleUpdateAvailability(status)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                      isSelected
                        ? `bg-gradient-to-r ${config.gradient} text-white border-transparent shadow-lg scale-105`
                        : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        isSelected 
                          ? 'bg-white/20' 
                          : status === 'Available' 
                            ? 'bg-green-100' 
                            : status === 'Busy' 
                              ? 'bg-yellow-100' 
                              : status === 'Offline' 
                                ? 'bg-gray-100' 
                                : 'bg-orange-100'
                      }`}>
                        <div className={`w-6 h-6 rounded-full ${
                          isSelected 
                            ? 'bg-white' 
                            : status === 'Available' 
                              ? 'bg-green-500' 
                              : status === 'Busy' 
                                ? 'bg-yellow-500' 
                                : status === 'Offline' 
                                  ? 'bg-gray-500' 
                                  : 'bg-orange-500'
                        } ${status === 'Available' && isSelected ? 'animate-pulse' : ''}`}></div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-bold text-lg">{status}</span>
                          {isSelected && (
                            <CheckCircle className="w-5 h-5 text-white" />
                          )}
                        </div>
                        <p className={`text-sm ${isSelected ? 'text-white/90' : 'text-gray-500'}`}>
                          {config.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-6 bg-gray-50 border-t border-gray-200">
              <Button
                variant="outline"
                onClick={() => setShowAvailabilityPopout(false)}
                className="w-full hover:bg-gray-100"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Billing Information Modal */}
      {showBillingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                    <CreditCard className="w-6 h-6 mr-2 text-blue-600" />
                    Billing Information
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">Manage your bank account details for payments</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBillingModal(false)}
                  className="hover:bg-gray-100"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {/* Security Notice */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-blue-900 mb-1">Secure & Encrypted</p>
                      <p className="text-xs text-blue-800">
                        Your banking information is encrypted and stored securely. This information is used only for processing payments to your account.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bank Details Form */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Bank Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={billingInfo.bankName}
                      onChange={(e) => setBillingInfo({ ...billingInfo, bankName: e.target.value })}
                      placeholder="e.g., Standard Bank, FNB, Absa"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Account Holder Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={billingInfo.accountHolderName}
                      onChange={(e) => setBillingInfo({ ...billingInfo, accountHolderName: e.target.value })}
                      placeholder="Name as it appears on bank account"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Account Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={billingInfo.accountNumber}
                        onChange={(e) => {
                          // Only allow numbers
                          const value = e.target.value.replace(/\D/g, '');
                          setBillingInfo({ ...billingInfo, accountNumber: value });
                        }}
                        placeholder="Account number"
                        maxLength={20}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">Numbers only</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Account Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={billingInfo.accountType}
                        onChange={(e) => setBillingInfo({ ...billingInfo, accountType: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="Cheque">Cheque Account</option>
                        <option value="Savings">Savings Account</option>
                        <option value="Current">Current Account</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Branch Code
                    </label>
                    <input
                      type="text"
                      value={billingInfo.branchCode}
                      onChange={(e) => {
                        // Only allow numbers
                        const value = e.target.value.replace(/\D/g, '');
                        setBillingInfo({ ...billingInfo, branchCode: value });
                      }}
                      placeholder="e.g., 250655"
                      maxLength={6}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">6-digit branch code (optional)</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Contact Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        value={billingInfo.email}
                        onChange={(e) => setBillingInfo({ ...billingInfo, email: e.target.value })}
                        placeholder="your.email@example.com"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Contact Phone <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        value={billingInfo.phone}
                        onChange={(e) => {
                          // Format phone number
                          const value = e.target.value.replace(/\D/g, '');
                          setBillingInfo({ ...billingInfo, phone: value });
                        }}
                        placeholder="0821234567"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>
                  </div>

                  {/* Summary */}
                  {billingInfo.bankName && billingInfo.accountNumber && (
                    <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm font-semibold text-green-900 mb-1">Account Summary</p>
                      <p className="text-sm text-green-800">
                        {billingInfo.bankName} {billingInfo.accountType} • ••••{billingInfo.accountNumber.slice(-4)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Required fields are marked with <span className="text-red-500">*</span>
                </p>
                <div className="flex items-center space-x-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowBillingModal(false)}
                    className="hover:bg-gray-100"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveBillingInfo}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Billing Information
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
