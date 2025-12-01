import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  TrendingUp,
  DollarSign,
  Briefcase,
  Award,
  AlertCircle,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  Download,
  Eye,
  User,
  UserPlus,
  Activity,
  Shield,
  Clock,
  BarChart3,
  PieChart,
  FileText,
  CreditCard,
  Settings,
  Lock,
  Unlock,
  AlertTriangle,
  ArrowRight,
  Mail,
  FolderOpen,
  X,
  Gavel,
  MessageSquare,
  Check,
  X as XIcon,
  BookOpen,
  Plus,
  Edit,
  Trash2,
  EyeOff,
  Sparkles,
  Loader2,
  Upload,
  Image as ImageIcon,
  ExternalLink
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { db, isFirebaseConfigured, storage, isStorageConfigured } from '../../firebase/config';
import { collection, getDocs, onSnapshot, query, where, doc, updateDoc, Timestamp, addDoc, orderBy, limit, getDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Blog } from '../../types';
import { createNotification } from '../../utils/notifications';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase/config';
import { getIdTokenResult } from 'firebase/auth';
import { auth } from '../../firebase/config';

interface AdminDashboardProps {
  user: any;
}

type ViewType = 'overview' | 'applications' | 'smes' | 'sdps' | 'engagements' | 'escrow' | 'analytics' | 'documents' | 'disputes' | 'payments' | 'blogs';

type ApplicationType = 'registration' | 'verification' | 'subscription' | 'payment';

const formatDetailValue = (value?: string | number | null) => {
  if (value === null || value === undefined) return 'Not provided';
  if (typeof value === 'number') return value.toString();
  const str = value.toString().trim();
  return str.length ? str : 'Not provided';
};

const maskAccountNumber = (value?: string | null) => {
  if (!value) return 'Not provided';
  const digits = value.replace(/\s+/g, '');
  if (digits.length <= 4) return digits;
  const lastFour = digits.slice(-4);
  return `•••• ${lastFour}`;
};

const getTimestamp = (value: any) => {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (value?.toDate) {
    const date = value.toDate();
    return date instanceof Date ? date.getTime() : 0;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

const formatDateTime = (value: any, fallback = 'Not available') => {
  if (!value) return fallback;
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const isPendingReviewStatus = (status?: string | null) => {
  if (!status) return true;
  const normalized = status.toLowerCase();
  return [
    'pending',
    'awaiting',
    'in_review',
    'needs_changes',
    'require_changes',
    'requires_attention',
    'awaiting_review'
  ].includes(normalized);
};

const MAX_USERS_FOR_PENDING_SCAN = 40;

export function AdminDashboard({ user }: AdminDashboardProps) {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState<ViewType>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [recentActivities, setRecentActivities] = useState<any[]>([]);

  const handleExport = (type: string) => {
    let data: any[] = [];
    switch(type) {
      case 'SMEs':
        data = recentSMEs;
        break;
      case 'SDPs':
        data = recentSDPs;
        break;
      case 'Engagements':
        data = recentEngagements;
        break;
      case 'Applications':
        data = allApplications;
        break;
      case 'Escrow':
        data = escrowTransactions;
        break;
      default:
        data = [];
    }
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${type.toLowerCase()}-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    alert(`${type} data exported successfully!`);
  };

  const handleViewDetails = async (id: string, type: string) => {
    if (!isFirebaseConfigured()) {
      alert('Firebase is not configured');
      return;
    }

    setLoadingApplication(true);
    try {
      // Fetch user data
      const userDocRef = doc(db, 'users', id);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        alert('User not found');
        setLoadingApplication(false);
        return;
      }

      const userData = userDoc.data();
      
      // Fetch user documents
      const docsSnapshot = await getDocs(collection(db, 'users', id, 'documents'));
      const documents = docsSnapshot.docs.map(doc => ({
        id: doc.id,
        userId: id,
        userName: userData.profile?.name || userData.profile?.companyName || userData.name || userData.email,
        userEmail: userData.email || userData.profile?.email || '',
        userRole: userData.role || type,
        isQueueDoc: false,
        ...doc.data()
      }));

      setSelectedApplication({
        id,
        ...userData,
        type: userData.role || type
      });
      setApplicationDocuments(documents);
      setShowApplicationModal(true);
    } catch (error: any) {
      console.error('Error fetching application details:', error);
      alert('Error loading application details: ' + error.message);
    } finally {
      setLoadingApplication(false);
    }
  };

  const handleApprove = (id: string, type: string) => {
    alert(`${type} ${id} approved successfully!`);
  };

  const handleReject = async (id: string, type: string, rejectionReason?: string) => {
    if (!isFirebaseConfigured()) {
      alert('Firebase is not configured');
      return;
    }

    // Find the application to determine the actual user ID
    const application = allApplications.find((app: any) => app.id === id) || 
                       recentSMEs.find((sme: any) => sme.id === id) ||
                       recentSDPs.find((sdp: any) => sdp.id === id);
    
    // Determine the actual user ID - could be from applications collection (userId) or users collection (id)
    const userId = application?.userId || application?.id || id;

    // If no rejection reason provided, show modal to collect it
    if (!rejectionReason) {
      if (application) {
        setSelectedApplication(application);
        setShowApplicationModal(false); // Close details modal if open
        // We'll use a separate rejection modal, but for now, let's prompt
        const reason = prompt(`Please provide a reason for rejecting this ${type} application:\n\nThis reason will be sent to the applicant.`);
        if (!reason || !reason.trim()) {
          alert('Rejection reason is required.');
          return;
        }
        await handleReject(id, type, reason.trim());
      } else {
        const reason = prompt(`Please provide a reason for rejecting this ${type}:\n\nThis reason will be sent to the applicant.`);
        if (!reason || !reason.trim()) {
          alert('Rejection reason is required.');
          return;
        }
        await handleReject(id, type, reason.trim());
      }
      return;
    }

    const confirmed = window.confirm(
      `⚠️ Are you sure you want to reject this ${type} application?\n\nThis action will notify the applicant and cannot be easily undone.`
    );

    if (!confirmed) return;

    try {
      const userRef = doc(db, 'users', userId);
      
      // Get user data first to get their name/email for notification
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) {
        alert('User not found. Please check if the user ID is correct.');
        console.error('User not found. ID:', userId, 'Application:', application);
        return;
      }

      const userData = userDoc.data();

      // Update user document with rejection information
      await updateDoc(userRef, {
        verified: false,
        rejected: true,
        rejectedAt: Timestamp.now(),
        rejectedBy: user.id,
        rejectedByName: user.profile?.name || user.email,
        rejectionReason: rejectionReason,
        updatedAt: Timestamp.now()
      });

      // If this was from the applications collection, we might want to update that too
      if (application && application.id && allApplications.find((app: any) => app.id === application.id)) {
        try {
          const appRef = doc(db, 'applications', application.id);
          await updateDoc(appRef, {
            status: 'rejected',
            rejectedAt: Timestamp.now(),
            rejectedBy: user.id,
            rejectionReason: rejectionReason
          });
        } catch (appError: any) {
          console.warn('Could not update application document:', appError);
          // Continue anyway - user document update is more important
        }
      }

      // Create notification for the user
      await createNotification({
        userId: userId,
        type: 'rejection',
        title: 'Application Rejected',
        message: `Your ${type} application has been rejected. Reason: ${rejectionReason}`,
        link: '/edit-profile',
        metadata: { 
          rejectedBy: user.id,
          rejectionReason: rejectionReason
        }
      });

      alert(`✅ ${type} application rejected successfully. The applicant has been notified.`);
      
      // Close any open modals
      setShowApplicationModal(false);
      setSelectedApplication(null);
      setApplicationDocuments([]);
      
      // Force a refresh of the data by triggering a re-render
      // The onSnapshot listeners will automatically update, but we can also manually refresh
      // by ensuring the component re-renders with the updated data
    } catch (error: any) {
      console.error('Error rejecting application:', error);
      alert(`❌ Failed to reject ${type} application: ${error.message}`);
    }
  };

  const handleVerify = async (id: string, type: string) => {
    if (!isFirebaseConfigured()) {
      alert('Firebase is not configured');
      return;
    }

    const confirmed = window.confirm(`Are you sure you want to verify this ${type}?`);
    if (!confirmed) return;

    try {
      const userRef = doc(db, 'users', id);
      await updateDoc(userRef, {
        verified: true,
        verifiedAt: Timestamp.now(),
        verifiedBy: user.id,
        verifiedByName: user.profile?.name || user.email,
        // Clear rejection fields if this was a previously rejected user
        rejected: false,
        rejectedAt: null,
        rejectedBy: null,
        rejectedByName: null,
        rejectionReason: null,
        updatedAt: Timestamp.now()
      });

      // Create notification for the user
      const userDoc = await getDoc(userRef);
      const userData = userDoc.data();
      
      if (userData) {
        await createNotification({
          userId: id,
          type: 'verification',
          title: 'Account Verified',
          message: `Your ${type} account has been verified by an administrator. You now have full access to the platform.`,
          link: type === 'SME' ? '/sme-dashboard' : '/sdp-dashboard',
          metadata: { verifiedBy: user.id }
        });
      }

      alert(`✅ ${type} verified successfully!`);
    } catch (error: any) {
      console.error('Error verifying user:', error);
      alert(`❌ Failed to verify ${type}: ${error.message}`);
    }
  };

  const handleReleaseEscrow = (id: string) => {
    alert(`Escrow ${id} released successfully!`);
  };

  const handleReviewDocument = (document: any) => {
    setSelectedDocument(document);
    setReviewComment('');
    setShowReviewModal(true);
  };

  const handleApproveDocument = async (docOverride?: any) => {
    const targetDoc = docOverride || selectedDocument;
    if (!targetDoc || !isFirebaseConfigured()) return false;
    const approvalComment = docOverride
      ? 'Document approved by admin'
      : (reviewComment.trim() || 'Document approved');

    try {
      setDocumentActionLoading(`approve-${targetDoc.id}`);
      // Find the document in user's documents collection using documentId
      const documentId = targetDoc.documentId || targetDoc.id;
      
      // Update document in user's documents collection
      const userDocRef = doc(db, 'users', targetDoc.userId, 'documents', documentId);
      const reviewerName = user.profile?.name || user.profile?.companyName || user.email || 'Admin';
      await updateDoc(userDocRef, {
        reviewStatus: 'approved',
        status: 'approved', // Also update status field
        reviewedBy: reviewerName,
        reviewedAt: Timestamp.now(),
        reviewComment: approvalComment
      });

      // Update document in review queue
      if (targetDoc.isQueueDoc !== false) {
        const reviewDocRef = doc(db, 'documentReviews', targetDoc.documentReviewId || targetDoc.id);
        const reviewerName = user.profile?.name || user.profile?.companyName || user.email || 'Admin';
        await updateDoc(reviewDocRef, {
          reviewStatus: 'approved',
          status: 'approved', // Also update status field
          reviewedBy: reviewerName,
          reviewedAt: Timestamp.now(),
          reviewComment: approvalComment
        });
      }

      // Update local state to remove document from pending list
      if (!docOverride) {
        setPendingDocuments(prev => prev.filter(doc => doc.id !== targetDoc.id));
        alert('Document approved successfully!');
        setShowReviewModal(false);
        setSelectedDocument(null);
        setReviewComment('');
      }
      return true;
    } catch (error: any) {
      console.error('Error approving document:', error);
      if (!docOverride) {
        alert('Error approving document: ' + error.message);
      }
      return false;
    } finally {
      setDocumentActionLoading(null);
    }
  };

  const handleRejectDocument = async (docOverride?: any, customComment?: string) => {
    const targetDoc = docOverride || selectedDocument;
    if (!targetDoc || !isFirebaseConfigured()) {
      alert('Please provide a reason for rejection');
      return false;
    }

    const commentToUse = docOverride ? (customComment || '') : reviewComment.trim();

    if (!commentToUse) {
      alert('Please provide a reason for rejection');
      return false;
    }

    try {
      setDocumentActionLoading(`reject-${targetDoc.id}`);
      // Find the document in user's documents collection using documentId
      const documentId = targetDoc.documentId || targetDoc.id;
      
      // Update document in user's documents collection
      const userDocRef = doc(db, 'users', targetDoc.userId, 'documents', documentId);
      const reviewerName = user.profile?.name || user.profile?.companyName || user.email || 'Admin';
      await updateDoc(userDocRef, {
        reviewStatus: 'rejected',
        status: 'rejected', // Also update status field
        reviewedBy: reviewerName,
        reviewedAt: Timestamp.now(),
        reviewComment: commentToUse
      });

      // Update document in review queue
      if (targetDoc.isQueueDoc !== false) {
        const reviewDocRef = doc(db, 'documentReviews', targetDoc.documentReviewId || targetDoc.id);
        const reviewerName = user.profile?.name || user.profile?.companyName || user.email || 'Admin';
        await updateDoc(reviewDocRef, {
          reviewStatus: 'rejected',
          status: 'rejected', // Also update status field
          reviewedBy: reviewerName,
          reviewedAt: Timestamp.now(),
          reviewComment: commentToUse
        });
      }

      // Update local state to remove document from pending list
      if (!docOverride) {
        setPendingDocuments(prev => prev.filter(doc => doc.id !== targetDoc.id));
        alert('Document rejected.');
        setShowReviewModal(false);
        setSelectedDocument(null);
        setReviewComment('');
      }
      return true;
    } catch (error: any) {
      console.error('Error rejecting document:', error);
      if (!docOverride) {
        alert('Error rejecting document: ' + error.message);
      }
      return false;
    } finally {
      setDocumentActionLoading(null);
    }
  };

  const handleSelectDocumentUser = async (userRecord: any) => {
    if (!userRecord || !userRecord.id) return;
    setSelectedDocumentUser(userRecord);
    setUserDocumentError(null);

    const cachedDocs = userDocumentCache[userRecord.id];
    if (cachedDocs) {
      setUserDocumentList(cachedDocs);
      return;
    }

    if (!isFirebaseConfigured()) {
      setUserDocumentError('Firebase is not configured');
      return;
    }

    setLoadingUserDocuments(true);
    setUserDocumentList([]);
    try {
      const snapshot = await getDocs(collection(db, 'users', userRecord.id, 'documents'));
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        userId: userRecord.id,
        userRole: userRecord.role || userRecord.profile?.role,
        userName: userRecord.profile?.name || userRecord.profile?.companyName || userRecord.name || userRecord.email,
        userEmail: userRecord.email || userRecord.profile?.email,
        ...doc.data()
      }));
      docs.sort((a: any, b: any) => getTimestamp(b.uploadedAt || b.createdAt) - getTimestamp(a.uploadedAt || a.createdAt));
      setUserDocumentList(docs);
      setUserDocumentCache(prev => ({ ...prev, [userRecord.id]: docs }));
    } catch (error: any) {
      console.error('Error loading user documents:', error);
      setUserDocumentError(error.message || 'Unable to load documents. Please try again.');
    } finally {
      setLoadingUserDocuments(false);
    }
  };

  const handleApplicationDocumentDecision = async (document: any, action: 'approve' | 'reject') => {
    if (!document) return;

    if (action === 'approve') {
      const success = await handleApproveDocument(document);
      if (success) {
        setApplicationDocuments(prev => prev.map(doc => doc.id === document.id ? { ...doc, reviewStatus: 'approved' } : doc));
      }
      return;
    }

    let reason = prompt('Please provide a reason for rejecting this document:');
    if (!reason) return;
    reason = reason.trim();
    if (!reason) return;

    const success = await handleRejectDocument(document, reason);
    if (success) {
      setApplicationDocuments(prev => prev.map(doc => doc.id === document.id ? { ...doc, reviewStatus: 'rejected' } : doc));
    }
  };

  // REMOVE all mock useState values and set empty/initial:
  const [systemStats, setSystemStats] = useState({
    totalSMEs: 0, activeSMEs: 0, totalSDPs: 0, activeSDPs: 0, totalEngagements: 0, activeEngagements: 0, monthlyRevenue: '-', totalUsers: 0, verifiedUsers: 0, pendingVerifications: 0
  });
  const [recentSMEs, setRecentSMEs] = useState([]);
  const [recentSDPs, setRecentSDPs] = useState([]);
  const [allApplications, setAllApplications] = useState([]);
  const [recentEngagements, setRecentEngagements] = useState([]);
  const [escrowTransactions, setEscrowTransactions] = useState([]);
  const [pendingDocuments, setPendingDocuments] = useState<any[]>([]);
  const [documentSource, setDocumentSource] = useState<'queue' | 'fallback' | null>(null);
  const [documentQueueAvailable, setDocumentQueueAvailable] = useState(false);
  const [scanningUserDocs, setScanningUserDocs] = useState(false);
  const [documentScanError, setDocumentScanError] = useState<string | null>(null);
  const [documentReviewSearch, setDocumentReviewSearch] = useState('');
  const [documentReviewRole, setDocumentReviewRole] = useState<'all' | 'SME' | 'SDP'>('all');
  const [disputedEngagements, setDisputedEngagements] = useState<any[]>([]);
  const [selectedDispute, setSelectedDispute] = useState<any | null>(null);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<any | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [reviewComment, setReviewComment] = useState('');
  const [selectedDocument, setSelectedDocument] = useState<any | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [documentActionLoading, setDocumentActionLoading] = useState<string | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<any | null>(null);
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [selectedBlog, setSelectedBlog] = useState<Blog | null>(null);
  const [showBlogModal, setShowBlogModal] = useState(false);
  const [blogFormData, setBlogFormData] = useState({
    title: '',
    slug: '',
    content: '',
    excerpt: '',
    featuredImage: '',
    category: '',
    tags: [] as string[],
    status: 'draft' as 'draft' | 'published'
  });
  const [blogTagInput, setBlogTagInput] = useState('');
  const [showAIGenerateModal, setShowAIGenerateModal] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [selectedAITopic, setSelectedAITopic] = useState<string>('funding');
  const [customAITopic, setCustomAITopic] = useState('');
  const [aiCategory, setAiCategory] = useState('Education');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [applicationDocuments, setApplicationDocuments] = useState<any[]>([]);
  const [loadingApplication, setLoadingApplication] = useState(false);
  const [selectedEngagementForComment, setSelectedEngagementForComment] = useState<any | null>(null);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [engagementComment, setEngagementComment] = useState('');
  const [documentSearch, setDocumentSearch] = useState('');
  const [selectedDocumentUser, setSelectedDocumentUser] = useState<any | null>(null);
  const [userDocumentList, setUserDocumentList] = useState<any[]>([]);
  const [userDocumentCache, setUserDocumentCache] = useState<Record<string, any[]>>({});
  const [loadingUserDocuments, setLoadingUserDocuments] = useState(false);
  const [userDocumentError, setUserDocumentError] = useState<string | null>(null);
  const billingInfo = useMemo(() => {
    if (!selectedApplication) return null;

    const candidateSources = [
      selectedApplication.billingProfile,
      selectedApplication.billingInfo,
      (selectedApplication as any).banking,
      selectedApplication.profile?.billingProfile,
      selectedApplication.profile?.billingInfo,
      selectedApplication.profile,
      selectedApplication
    ];

    const pick = (...keys: string[]) => {
      for (const source of candidateSources) {
        if (!source) continue;
        for (const key of keys) {
          if (source[key] && typeof source[key] === 'string' && source[key].trim().length) {
            return source[key];
          }
        }
      }
      return '';
    };

    const normalize = (value?: string | null) => (typeof value === 'string' ? value.trim() : value ?? '');

    const normalized = {
      companyName:
        normalize(
          pick(
            'companyName',
            'billingName',
            'businessName',
            'accountHolder',
            'accountHolderName',
            'name'
          )
        ) ||
        normalize(selectedApplication.profile?.companyName) ||
        normalize(selectedApplication.profile?.name) ||
        normalize(selectedApplication.name),
      contactEmail:
        normalize(pick('contactEmail', 'billingEmail', 'email')) ||
        normalize(selectedApplication.email) ||
        normalize(selectedApplication.profile?.email),
      phone:
        normalize(pick('phone', 'contactPhone', 'billingPhone')) ||
        normalize(selectedApplication.phone) ||
        normalize(selectedApplication.profile?.phone),
      vatNumber: normalize(pick('vatNumber', 'vat')),
      billingReference:
        normalize(pick('billingReference', 'reference', 'planReference')) ||
        normalize(selectedApplication.planReference),
      address: normalize(pick('address', 'billingAddress', 'physicalAddress')),
      bankName: normalize(pick('bankName')),
      accountHolder: normalize(pick('accountHolder', 'accountHolderName', 'accountName', 'companyName')),
      accountNumber: normalize(pick('accountNumber', 'bankAccount')),
      branchCode: normalize(pick('branchCode', 'branch', 'branchNumber')),
      accountType: normalize(pick('accountType', 'accountCategory', 'accountKind'))
    };

    const hasValue = Object.values(normalized).some(
      (value) => (typeof value === 'string' ? value.length > 0 : !!value)
    );

    return hasValue ? normalized : null;
  }, [selectedApplication]);

  const documentUsers = useMemo(() => {
    const combined = [...recentSMEs, ...recentSDPs];
    return combined.sort((a: any, b: any) => {
      const aName = (a.profile?.name || a.name || a.profile?.companyName || a.email || '').toLowerCase();
      const bName = (b.profile?.name || b.name || b.profile?.companyName || b.email || '').toLowerCase();
      return aName.localeCompare(bName);
    });
  }, [recentSMEs, recentSDPs]);

  const filteredDocumentUsers = useMemo(() => {
    const term = documentSearch.trim().toLowerCase();
    if (!term) return documentUsers;
    return documentUsers.filter((user: any) => {
      const blob = [
        user.profile?.name,
        user.name,
        user.email,
        user.profile?.companyName,
        user.role
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return blob.includes(term);
    });
  }, [documentUsers, documentSearch]);

  const loadPendingDocumentsFromUsers = useCallback(async () => {
    if (scanningUserDocs) return;
    if (!isFirebaseConfigured()) return;

    const combinedUsers = [...recentSMEs, ...recentSDPs];
    if (!combinedUsers.length) {
      return;
    }

    setScanningUserDocs(true);
    setDocumentScanError(null);
    setLoading(l => ({ ...l, documents: true }));

    try {
      const limit = Math.min(combinedUsers.length, MAX_USERS_FOR_PENDING_SCAN);
      const pendingList: any[] = [];

      for (let i = 0; i < limit; i++) {
        const userRecord = combinedUsers[i];
        if (!userRecord?.id) continue;
        try {
          const docsSnapshot = await getDocs(collection(db, 'users', userRecord.id, 'documents'));
          docsSnapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (isPendingReviewStatus(data.reviewStatus)) {
              pendingList.push({
                id: `${userRecord.id}-${docSnap.id}`,
                documentId: docSnap.id,
                userId: userRecord.id,
                userName: userRecord.profile?.name ||
                  userRecord.profile?.companyName ||
                  userRecord.name ||
                  userRecord.email ||
                  'User',
                userEmail: userRecord.email || userRecord.profile?.email || '',
                userRole: userRecord.role || 'User',
                isQueueDoc: false,
                ...data
              });
            }
          });
        } catch (innerError) {
          console.warn('Error loading documents for user:', userRecord.id, innerError);
        }
      }

      pendingList.sort(
        (a, b) => getTimestamp(b.uploadedAt || b.createdAt) - getTimestamp(a.uploadedAt || a.createdAt)
      );

      setPendingDocuments(pendingList);
      setDocumentSource('fallback');
      setDocumentQueueAvailable(false);
    } catch (error: any) {
      console.error('Error scanning user documents:', error);
      setDocumentScanError(error.message || 'Unable to load pending documents from user profiles.');
    } finally {
      setScanningUserDocs(false);
      setLoading(l => ({ ...l, documents: false }));
    }
  }, [recentSMEs, recentSDPs, scanningUserDocs]);

  const filteredPendingDocuments = useMemo(() => {
    const term = documentReviewSearch.trim().toLowerCase();
    const roleFilter = documentReviewRole.toLowerCase();

    return pendingDocuments.filter((doc: any) => {
      if (documentReviewRole !== 'all') {
        const docRole = (doc.userRole || '').toLowerCase();
        if (docRole !== roleFilter) return false;
      }

      if (!term) return true;

      const blob = [
        doc.userName,
        doc.userEmail,
        doc.userRole,
        doc.companyName,
        doc.name,
        doc.documentType
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return blob.includes(term);
    });
  }, [pendingDocuments, documentReviewSearch, documentReviewRole]);

  const hasDocumentReviewFilters =
    documentReviewRole !== 'all' || documentReviewSearch.trim().length > 0;
  const [loading, setLoading] = useState({
    smes: true, sdps: true, applications: true, engagements: true, escrow: true, documents: true
  });

  // Refresh admin claims on mount if user is admin
  useEffect(() => {
    if (!isFirebaseConfigured() || !user || user.role !== 'Admin') return;

    const refreshAdminClaims = async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        // Check if user has admin role in Firestore
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (!userDoc.exists()) return;

        const userData = userDoc.data();
        if (userData.role === 'Admin') {
          // Check current token claims
          const tokenResult = await getIdTokenResult(currentUser);
          const claims = tokenResult.claims;

          // If claims are missing, refresh them
          if (!claims.role || claims.role !== 'Admin') {
            console.log('Admin claims missing, refreshing...');
            if (functions) {
              try {
                const setAdminClaims = httpsCallable(functions, 'setAdminClaims');
                await setAdminClaims({ 
                  uid: currentUser.uid,
                  adminKey: import.meta.env.VITE_ADMIN_REGISTRATION_KEY || 'ADMIN2024'
                });
                // Force token refresh
                await currentUser.getIdToken(true);
                console.log('Admin claims refreshed successfully');
              } catch (error: any) {
                console.warn('Could not refresh admin claims:', error);
              }
            }
          }
        }
      } catch (error: any) {
        console.error('Error refreshing admin claims:', error);
      }
    };

    refreshAdminClaims();
  }, [user]);

  // FETCH DATA from Firestore - using 'users' collection with role filters
  useEffect(() => {
    if (!isFirebaseConfigured()) return;

    // Fetch SMEs from users collection
    const unsubSMEs = onSnapshot(
      query(collection(db, 'users'), where('role', '==', 'SME')),
      (snap) => {
        const items = snap.docs.map(doc => {
          const data = doc.data() as any;
          return {
            id: doc.id,
            name: data.profile?.name || data.email || 'Unknown',
            email: data.email || data.profile?.email || '',
            status: data.verified ? 'verified' : 'pending',
            verified: data.verified || false,
            rating: data.profile?.rating || 0,
            reviews: data.profile?.reviews || 0,
            joinDate: data.createdAt?.toDate ? data.createdAt.toDate().toLocaleDateString() : 'N/A',
            ...data
          };
        });
      setRecentSMEs(items);
      setLoading(l => ({ ...l, smes: false }));
        
        // Calculate stats
        const verifiedSMEs = items.filter((x: any) => x.verified).length;
        setSystemStats(s => ({ 
          ...s, 
          totalSMEs: items.length, 
          activeSMEs: verifiedSMEs,
          totalUsers: (s.totalUsers || 0) + items.length
        }));
      },
      (error) => {
        console.error('Error fetching SMEs:', error);
        setLoading(l => ({ ...l, smes: false }));
      }
    );

    // Fetch SDPs from users collection
    const unsubSDPs = onSnapshot(
      query(collection(db, 'users'), where('role', '==', 'SDP')),
      (snap) => {
        const items = snap.docs.map(doc => {
          const data = doc.data() as any;
          return {
            id: doc.id,
            name: data.profile?.name || data.email || 'Unknown',
            email: data.email || data.profile?.email || '',
            status: data.verified ? 'verified' : 'pending',
            verified: data.verified || false,
            learners: data.profile?.learners || '0',
            joinDate: data.createdAt?.toDate ? data.createdAt.toDate().toLocaleDateString() : 'N/A',
            ...data
          };
        });
      setRecentSDPs(items);
      setLoading(l => ({ ...l, sdps: false }));
        
        // Calculate stats
        const verifiedSDPs = items.filter((x: any) => x.verified).length;
        setSystemStats(s => ({ 
          ...s, 
          totalSDPs: items.length, 
          activeSDPs: verifiedSDPs,
          totalUsers: (s.totalUsers || 0) + items.length
        }));
      },
      (error) => {
        console.error('Error fetching SDPs:', error);
        setLoading(l => ({ ...l, sdps: false }));
      }
    );
    // Fetch applications (if collection exists)
    const unsubApps = onSnapshot(
      collection(db, 'applications'),
      (snap) => {
        const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setAllApplications(items);
      setLoading(l => ({ ...l, applications: false }));
      },
      (error: any) => {
        console.error('Error fetching applications:', error);
        if (error.code === 'permission-denied' || error.message?.includes('permission')) {
          console.warn('Permission denied for applications. Admin may need to refresh token.');
        }
        setAllApplications([]);
        setLoading(l => ({ ...l, applications: false }));
      }
    );

    // Fetch engagements
    const unsubEng = onSnapshot(
      collection(db, 'engagements'),
      (snap) => {
        const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setRecentEngagements(items);
      setLoading(l => ({ ...l, engagements: false }));
        
        // Calculate engagement stats
        const activeEngagements = items.filter((e: any) => e.status === 'In Progress').length;
        setSystemStats(s => ({ 
          ...s, 
          totalEngagements: items.length, 
          activeEngagements: activeEngagements
        }));
        
        // Filter disputed engagements
        const disputed = items.filter((e: any) => e.status === 'Disputed');
        setDisputedEngagements(disputed);
        
        // Filter pending payments (Completed with fundsReleasedAt but not yet confirmed by admin)
        const pending = items.filter((e: any) => 
          e.status === 'Completed' && 
          e.fundsReleasedAt && 
          !e.paymentConfirmedByAdmin
        );
        setPendingPayments(pending);
      },
      (error: any) => {
        console.error('Error fetching engagements:', error);
        if (error.code === 'permission-denied' || error.message?.includes('permission')) {
          console.warn('Permission denied for engagements. Admin may need to refresh token.');
        }
        setLoading(l => ({ ...l, engagements: false }));
      }
    );

    // Fetch escrow transactions (if collection exists)
    const unsubEscrow = onSnapshot(
      collection(db, 'escrow'),
      (snap) => {
      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEscrowTransactions(items);
      setLoading(l => ({ ...l, escrow: false }));
      },
      (error: any) => {
        console.error('Error fetching escrow:', error);
        if (error.code === 'permission-denied' || error.message?.includes('permission')) {
          console.warn('Permission denied for escrow. Admin may need to refresh token.');
        }
        setEscrowTransactions([]);
        setLoading(l => ({ ...l, escrow: false }));
      }
    );

    // Fetch documents for review queue
    const unsubDocs = onSnapshot(
      collection(db, 'documentReviews'),
      (snap) => {
        const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const pending = items.filter((item: any) => isPendingReviewStatus(item.reviewStatus));
        if (pending.length > 0) {
          setPendingDocuments(pending);
          setDocumentSource('queue');
          setDocumentQueueAvailable(true);
        } else {
          setDocumentQueueAvailable(false);
          setDocumentSource(prev => (prev === 'queue' ? null : prev));
        }
        setLoading(l => ({ ...l, documents: false }));
      },
      (error: any) => {
        console.error('Error fetching documents:', error);
        if (error.code === 'permission-denied' || error.message?.includes('permission')) {
          console.warn('Permission denied for documents. Admin may need to refresh token.');
        }
        setDocumentQueueAvailable(false);
        setDocumentSource(prev => (prev === 'queue' ? null : prev));
        setLoading(l => ({ ...l, documents: false }));
      }
    );

    return () => { 
      unsubSMEs(); 
      unsubSDPs(); 
      unsubApps(); 
      unsubEng(); 
      unsubEscrow(); 
      unsubDocs();
    };
  }, []);

  // Calculate verification stats when users data changes
  useEffect(() => {
    const allUsers = [...recentSMEs, ...recentSDPs];
    // Verified users: those that are verified (not rejected)
    const verifiedUsers = allUsers.filter((u: any) => u.verified && !u.rejected).length;
    // Pending verifications: those that are not verified AND not rejected
    const pendingVerifications = allUsers.filter((u: any) => !u.verified && !u.rejected).length;
    // Rejected users count
    const rejectedUsers = allUsers.filter((u: any) => u.rejected).length;
    
    setSystemStats(s => ({
      ...s,
      verifiedUsers,
      pendingVerifications,
      rejectedUsers,
      totalUsers: allUsers.length
    }));
  }, [recentSMEs, recentSDPs]);

  // Calculate monthly revenue from completed engagements
  useEffect(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const monthlyRevenue = recentEngagements
      .filter((e: any) => {
        if (e.status !== 'Completed' || !e.paymentConfirmedByAdmin) return false;
        const completedDate = e.paymentConfirmedAt?.toDate ? e.paymentConfirmedAt.toDate() : 
                             (e.completedAt?.toDate ? e.completedAt.toDate() : null);
        return completedDate && completedDate >= startOfMonth;
      })
      .reduce((sum: number, e: any) => {
        const amount = parseFloat((e.budget || e.fee || '0').replace(/[^0-9.]/g, '')) || 0;
        return sum + amount;
      }, 0);
    
    setSystemStats(s => ({
      ...s,
      monthlyRevenue: `R${monthlyRevenue.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }));
  }, [recentEngagements]);

  // Hydrate pending documents from user uploads when queue is empty
  useEffect(() => {
    if (documentQueueAvailable) return;
    if (scanningUserDocs) return;
    if (documentSource === 'fallback' && pendingDocuments.length > 0) return;
    if (!recentSMEs.length && !recentSDPs.length) return;
    loadPendingDocumentsFromUsers();
  }, [
    documentQueueAvailable,
    scanningUserDocs,
    documentSource,
    pendingDocuments.length,
    recentSMEs,
    recentSDPs,
    loadPendingDocumentsFromUsers
  ]);

  // Load Recent Activities for Admin
  useEffect(() => {
    if (!isFirebaseConfigured()) return;

    const loadRecentActivities = async () => {
      try {
        const activities: any[] = [];

        // 1. Get recent user registrations
        const usersQuery = query(
          collection(db, 'users'),
          orderBy('createdAt', 'desc'),
          limit(10)
        );
        const usersSnapshot = await getDocs(usersQuery);
        usersSnapshot.forEach((userDoc) => {
          const userData = userDoc.data();
          const role = userData.role || '';
          if (role === 'SME' || role === 'SDP') {
            activities.push({
              id: `registration-${userDoc.id}`,
              action: `New ${role} registration`,
              user: userData.profile?.name || userData.email || 'User',
              timestamp: userData.createdAt,
              type: 'success'
            });
          }
        });

        // 2. Get recent completed engagements
        const completedQuery = query(
          collection(db, 'engagements'),
          where('status', '==', 'Completed'),
          orderBy('completedAt', 'desc'),
          limit(5)
        );
        const completedSnapshot = await getDocs(completedQuery);
        completedSnapshot.forEach((engDoc) => {
          const engagement = engDoc.data();
          activities.push({
            id: `completed-${engDoc.id}`,
            action: 'Engagement completed',
            user: `${engagement.smeName || 'SME'} & ${engagement.sdpName || 'SDP'}`,
            timestamp: engagement.completedAt || engagement.updatedAt,
            type: 'info'
          });
        });

        // 3. Get recent payment confirmations
        const paymentsQuery = query(
          collection(db, 'engagements'),
          where('paymentConfirmedByAdmin', '==', true),
          orderBy('paymentConfirmedAt', 'desc'),
          limit(5)
        );
        const paymentsSnapshot = await getDocs(paymentsQuery);
        paymentsSnapshot.forEach((payDoc) => {
          const engagement = payDoc.data();
          activities.push({
            id: `payment-${payDoc.id}`,
            action: 'Payment processed',
            amount: `R${engagement.budget || engagement.fee || '0'}`,
            timestamp: engagement.paymentConfirmedAt,
            type: 'info'
          });
        });

        // 4. Get recent verifications
        const verifiedUsers = [...recentSMEs, ...recentSDPs].filter((u: any) => u.verified && u.verifiedAt);
        verifiedUsers.slice(0, 5).forEach((user: any) => {
          activities.push({
            id: `verification-${user.id}`,
            action: `${user.role || 'User'} verification approved`,
            user: user.profile?.name || user.name || 'User',
            timestamp: user.verifiedAt,
            type: 'success'
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
        console.error('Error loading recent activities:', error);
        // If it's an index error, the index is still building - that's okay
        if (error.code === 'failed-precondition' && error.message?.includes('index')) {
          console.warn('Index is still building. This is normal and will resolve automatically.');
        } else if (error.code === 'permission-denied' || error.message?.includes('permission')) {
          console.warn('Permission denied. Admin may need to refresh token by signing out and back in.');
        }
      }
    };

    loadRecentActivities();

    // Refresh activities when data changes
    const interval = setInterval(loadRecentActivities, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, [recentSMEs, recentSDPs]);

  // Calculate total applications count (unverified users + applications collection)
  const totalApplicationsCount = useMemo(() => {
    const unverifiedSMEs = recentSMEs.filter((sme: any) => !sme.verified).length;
    const unverifiedSDPs = recentSDPs.filter((sdp: any) => !sdp.verified).length;
    return unverifiedSMEs + unverifiedSDPs + allApplications.length;
  }, [recentSMEs, recentSDPs, allApplications]);

  const views = [
    { id: 'overview' as ViewType, label: 'Overview', icon: BarChart3 },
    { id: 'applications' as ViewType, label: 'Applications', icon: FileText, badge: totalApplicationsCount },
    { id: 'documents' as ViewType, label: 'Documents', icon: FolderOpen, badge: pendingDocuments.length },
    { id: 'disputes' as ViewType, label: 'Disputes', icon: AlertTriangle, badge: disputedEngagements.length },
    { id: 'payments' as ViewType, label: 'Payments', icon: DollarSign, badge: pendingPayments.length },
    { id: 'blogs' as ViewType, label: 'Blogs', icon: BookOpen },
    { id: 'smes' as ViewType, label: 'SMEs', icon: Users },
    { id: 'sdps' as ViewType, label: 'SDPs', icon: Briefcase },
    { id: 'engagements' as ViewType, label: 'Engagements', icon: Activity },
    { id: 'escrow' as ViewType, label: 'Escrow', icon: Lock },
    { id: 'analytics' as ViewType, label: 'Analytics', icon: PieChart },
  ];

  const StatCard = ({ icon, title, value, subtitle, iconColor = 'blue' }: {
    icon: React.ReactNode;
    title: string;
    value: string | number;
    subtitle?: string;
    iconColor?: 'blue' | 'green' | 'purple' | 'orange' | 'red';
  }) => {
    const colorClasses = {
      blue: 'from-blue-500 to-blue-600',
      green: 'from-green-500 to-green-600',
      purple: 'from-purple-500 to-purple-600',
      orange: 'from-orange-500 to-orange-600',
      red: 'from-red-500 to-red-600'
    };
    
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 relative overflow-hidden group">
        <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${colorClasses[iconColor]} opacity-5 rounded-full -mr-16 -mt-16 group-hover:opacity-10 transition-opacity`}></div>
      <div className="relative">
        <div className="flex items-center justify-between mb-4">
            <div className={`w-14 h-14 bg-gradient-to-br ${colorClasses[iconColor]} rounded-xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform`}>
            {icon}
          </div>
        </div>
        <div className="text-3xl font-extrabold text-gray-900 mb-1">{value}</div>
        <div className="text-sm font-medium text-gray-600">{title}</div>
        {subtitle && <div className="text-xs text-gray-500 mt-2 font-medium">{subtitle}</div>}
      </div>
    </div>
  );
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={<Users className="w-6 h-6" />}
          title="Total SMEs"
          value={systemStats.totalSMEs || 0}
          subtitle={`${systemStats.activeSMEs || 0} verified`}
          iconColor="blue"
        />
        <StatCard
          icon={<Briefcase className="w-6 h-6" />}
          title="Total SDPs"
          value={systemStats.totalSDPs || 0}
          subtitle={`${systemStats.activeSDPs || 0} verified`}
          iconColor="green"
        />
        <StatCard
          icon={<Activity className="w-6 h-6" />}
          title="Engagements"
          value={systemStats.totalEngagements || 0}
          subtitle={`${systemStats.activeEngagements || 0} in progress`}
          iconColor="purple"
        />
        <StatCard
          icon={<DollarSign className="w-6 h-6" />}
          title="Monthly Revenue"
          value={systemStats.monthlyRevenue || 'R0.00'}
          subtitle="Confirmed payments this month"
          iconColor="orange"
        />
      </div>

      {/* System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Verification Status</h3>
            <Badge variant="warning" size="sm" className="shadow-sm">
              {systemStats.pendingVerifications} pending
            </Badge>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Verified Users</span>
              <span className="text-sm font-medium text-green-600">{systemStats.verifiedUsers}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Pending Verifications</span>
              <span className="text-sm font-medium text-yellow-600">{systemStats.pendingVerifications}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-600 h-2 rounded-full" 
                style={{ width: `${(systemStats.verifiedUsers / systemStats.totalUsers) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">User Activity</h3>
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Total Users</span>
              <span className="text-sm font-medium text-gray-900">{systemStats.totalUsers || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Verified Users</span>
              <span className="text-sm font-medium text-green-600">{systemStats.verifiedUsers || 0}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full" 
                style={{ width: `${systemStats.totalUsers > 0 ? ((systemStats.verifiedUsers || 0) / systemStats.totalUsers * 100) : 0}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Platform Health</h3>
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Uptime</span>
              <span className="text-sm font-medium text-green-600">99.9%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Response Time</span>
              <span className="text-sm font-medium text-green-600">120ms</span>
            </div>
            <div className="w-full bg-green-200 rounded-full h-2">
              <div className="bg-green-600 h-2 rounded-full" style={{ width: '99.9%' }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-transparent">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Recent SMEs</h3>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setActiveView('smes')} 
                className="shadow-sm hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors"
              >
                View All
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {loading.smes ? (
                <p className="text-center py-8 text-gray-500">Loading SMEs...</p>
              ) : recentSMEs.length === 0 ? (
                <p className="text-center py-8 text-gray-500">No SMEs found.</p>
              ) : (
                recentSMEs.map((sme) => {
                  // Determine status: rejected takes priority, then verified, then pending
                  const isRejected = sme.rejected === true;
                  const isVerified = sme.verified === true && !isRejected;
                  const status = isRejected ? 'rejected' : (isVerified ? 'verified' : 'pending');
                  
                  return (
                    <div key={sme.id} className={`flex items-center justify-between p-3 rounded-lg hover:bg-gray-100 transition-colors ${
                      isRejected ? 'bg-red-50 border border-red-200' : 'bg-gray-50'
                    }`}>
                    <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          isRejected ? 'bg-red-100' : 'bg-blue-100'
                        }`}>
                          {isRejected ? (
                            <XCircle className="w-5 h-5 text-red-600" />
                          ) : (
                        <Users className="w-5 h-5 text-blue-600" />
                          )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{sme.name}</p>
                        <p className="text-xs text-gray-500">{sme.email}</p>
                      </div>
                    </div>
                      <Badge variant={
                        isRejected ? 'danger' : 
                        isVerified ? 'success' : 
                        'warning'
                      }>
                        {status}
                    </Badge>
                  </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-green-50 to-transparent">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Recent SDPs</h3>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setActiveView('sdps')} 
                className="shadow-sm hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors"
              >
                View All
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {loading.sdps ? (
                <p className="text-center py-8 text-gray-500">Loading SDPs...</p>
              ) : recentSDPs.length === 0 ? (
                <p className="text-center py-8 text-gray-500">No SDPs found.</p>
              ) : (
                recentSDPs.map((sdp) => {
                  // Determine status: rejected takes priority, then verified, then pending
                  const isRejected = sdp.rejected === true;
                  const isVerified = sdp.verified === true && !isRejected;
                  const status = isRejected ? 'rejected' : (isVerified ? 'verified' : 'pending');
                  
                  return (
                    <div key={sdp.id} className={`flex items-center justify-between p-3 rounded-lg hover:bg-gray-100 transition-colors ${
                      isRejected ? 'bg-red-50 border border-red-200' : 'bg-gray-50'
                    }`}>
                    <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          isRejected ? 'bg-red-100' : 'bg-green-100'
                        }`}>
                          {isRejected ? (
                            <XCircle className="w-5 h-5 text-red-600" />
                          ) : (
                        <Briefcase className="w-5 h-5 text-green-600" />
                          )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{sdp.name}</p>
                        <p className="text-xs text-gray-500">{sdp.email}</p>
                      </div>
                    </div>
                      <Badge variant={
                        isRejected ? 'danger' : 
                        isVerified ? 'success' : 
                        'warning'
                      }>
                        {status}
                    </Badge>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const handleResolveDispute = async (disputeId: string, resolution: 'release' | 'reject', comment: string) => {
    if (!isFirebaseConfigured()) return;

    try {
      const newStatus = resolution === 'release' ? 'Completed' : 'Cancelled';
      await updateDoc(doc(db, 'engagements', disputeId), {
        status: newStatus,
        disputeResolvedAt: Timestamp.now(),
        disputeResolvedBy: user.id,
        disputeResolvedByName: user.profile?.name || user.email,
        disputeResolution: resolution,
        disputeResolutionComment: comment,
        ...(resolution === 'release' && {
          sdpConfirmedAt: Timestamp.now(),
          fundsReleasedAt: Timestamp.now(),
          paymentConfirmedByAdmin: true,
          paymentConfirmedAt: Timestamp.now(),
          paymentConfirmedBy: user.id
        }),
        updatedAt: Timestamp.now()
      });

      // Send notifications to both parties
      const dispute = disputedEngagements.find(d => d.id === disputeId);
      if (dispute) {
        if (dispute.sdpId && dispute.smeId) {
          const chatId = [dispute.sdpId, dispute.smeId].sort().join('_');
          await addDoc(collection(db, 'chats', chatId, 'messages'), {
            senderId: user.id,
            senderName: 'Admin',
            receiverId: dispute.sdpId,
            receiverName: dispute.sdp,
            message: `🔔 DISPUTE RESOLVED by Admin\n\n` +
                     `Decision: ${resolution === 'release' ? '✅ Funds Released to SME' : '❌ Funds Returned to SDP'}\n\n` +
                     `Admin Comment: ${comment}\n\n` +
                     `The engagement has been ${resolution === 'release' ? 'marked as Completed' : 'cancelled'}.`,
            timestamp: Timestamp.now(),
            read: false,
            isAdmin: true
          });
        }
      }

      alert(`✅ Dispute resolved successfully! ${resolution === 'release' ? 'Funds released to SME.' : 'Funds returned to SDP.'}`);
      setShowDisputeModal(false);
      setSelectedDispute(null);
    } catch (error: any) {
      console.error('Error resolving dispute:', error);
      alert(`❌ Failed to resolve dispute: ${error.message || 'Please try again.'}`);
    }
  };

  const handleAddEngagementComment = async (engagementId: string, comment: string) => {
    if (!isFirebaseConfigured()) return;

    if (!comment.trim()) {
      alert('Please enter a comment.');
      return;
    }

    try {
      const engagementRef = doc(db, 'engagements', engagementId);
      
      // Get current engagement data
      const engagementDoc = await getDoc(engagementRef);
      if (!engagementDoc.exists()) {
        alert('Engagement not found.');
        return;
      }

      const engagementData = engagementDoc.data();
      const existingComments = engagementData.adminComments || [];

      // Add new comment
      const newComment = {
        id: `comment-${Date.now()}`,
        comment: comment.trim(),
        addedBy: user.profile?.name || user.email || 'Admin',
        addedById: user.id,
        addedAt: Timestamp.now()
      };

      // Update engagement with new comment
      await updateDoc(engagementRef, {
        adminComments: [...existingComments, newComment],
        lastAdminCommentAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      alert('✅ Comment added successfully!');
      setShowCommentModal(false);
      setSelectedEngagementForComment(null);
      setEngagementComment('');
    } catch (error: any) {
      console.error('Error adding comment:', error);
      alert(`❌ Failed to add comment: ${error.message || 'Please try again.'}`);
    }
  };

  const handleConfirmPayment = async (engagementId: string, comment: string) => {
    if (!isFirebaseConfigured()) return;

    const confirmed = window.confirm(
      '⚠️ Are you sure you want to confirm that payment has been made to the SME\'s bank account? This action cannot be undone.'
    );

    if (!confirmed) return;

    try {
      // Get the engagement document to ensure we have all the data
      const engagementDoc = await getDoc(doc(db, 'engagements', engagementId));
      if (!engagementDoc.exists()) {
        alert('❌ Engagement not found. Please refresh and try again.');
        return;
      }

      const engagement = engagementDoc.data();
      const smeId = engagement.smeId;
      const sdpId = engagement.sdpId;
      const smeName = engagement.smeName || engagement.sme || 'SME';
      const sdpName = engagement.sdpName || engagement.sdp || 'SDP';
      const projectName = engagement.projectName || engagement.type || 'Project';
      const amount = engagement.budget || engagement.fee || 'N/A';

      if (!smeId) {
        alert('❌ SME ID not found in engagement. Cannot send notification.');
        return;
      }

      // Update engagement document
      await updateDoc(doc(db, 'engagements', engagementId), {
        paymentConfirmedByAdmin: true,
        paymentConfirmedAt: Timestamp.now(),
        paymentConfirmedBy: user.id,
        paymentConfirmationComment: comment,
        updatedAt: Timestamp.now()
      });

      // Send chat message to SME
      if (sdpId && smeId) {
        try {
          const chatId = [sdpId, smeId].sort().join('_');
          await addDoc(collection(db, 'chats', chatId, 'messages'), {
            senderId: user.id,
            senderName: 'Admin',
            receiverId: smeId,
            receiverName: smeName,
            message: `💰 PAYMENT CONFIRMED\n\n` +
                     `Good news! We have confirmed that payment for "${projectName}" has been successfully transferred to your bank account.\n\n` +
                     `Amount: ${amount}\n` +
                     `Admin Note: ${comment || 'Payment verified and processed.'}\n\n` +
                     `Please check your bank account. If you have any questions, contact support.`,
            timestamp: Timestamp.now(),
            read: false,
            isAdmin: true
          });
        } catch (chatError: any) {
          console.error('Error sending chat message:', chatError);
          // Continue even if chat message fails
        }
      }

      // Create notification for SME - this is critical
      try {
        await createNotification({
          userId: smeId,
          type: 'payment',
          title: 'Payment Confirmed',
          message: `Payment of ${amount} has been confirmed and transferred to your bank account for "${projectName}"`,
          link: `/dashboard?tab=reports`,
          metadata: { engagementId, amount }
        });
        console.log('✅ Notification sent to SME:', smeId);
      } catch (notifError: any) {
        console.error('❌ Error creating notification:', notifError);
        // Still show success but warn about notification
        alert('⚠️ Payment confirmed, but notification may not have been sent. Please contact the SME manually.');
        return;
      }

      alert('✅ Payment confirmed successfully! SME has been notified via notification and chat message.');
      setShowPaymentModal(false);
      setSelectedPayment(null);
      setReviewComment('');
    } catch (error: any) {
      console.error('Error confirming payment:', error);
      alert(`❌ Failed to confirm payment: ${error.message || 'Please try again.'}`);
    }
  };

  const renderPayments = () => {
    // Get all payments from engagements
    const allPayments = recentEngagements.filter((e: any) => 
      e.fundsReleasedAt || e.paymentConfirmedByAdmin
    );

    // Calculate payment stats
    const pendingPaymentsList = allPayments.filter((p: any) => 
      p.fundsReleasedAt && !p.paymentConfirmedByAdmin
    );
    const confirmedPayments = allPayments.filter((p: any) => 
      p.paymentConfirmedByAdmin
    );
    const totalPayments = allPayments.length;

    // Calculate amounts
    const parseAmount = (amountStr: string) => {
      if (!amountStr) return 0;
      return parseFloat(amountStr.replace(/[^0-9.]/g, '')) || 0;
    };

    const pendingAmount = pendingPaymentsList.reduce((sum: number, p: any) => 
      sum + parseAmount(p.budget || p.fee || '0'), 0
    );
    const confirmedAmount = confirmedPayments.reduce((sum: number, p: any) => 
      sum + parseAmount(p.budget || p.fee || '0'), 0
    );
    const totalAmount = allPayments.reduce((sum: number, p: any) => 
      sum + parseAmount(p.budget || p.fee || '0'), 0
    );

    // Filter payments
    const filteredPayments = allPayments
      .filter((payment: any) => {
        if (filterStatus === 'all') return true;
        if (filterStatus === 'pending') return payment.fundsReleasedAt && !payment.paymentConfirmedByAdmin;
        if (filterStatus === 'confirmed') return payment.paymentConfirmedByAdmin;
        return true;
      })
      .filter((payment: any) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (payment.projectName?.toLowerCase().includes(query) ||
                payment.type?.toLowerCase().includes(query) ||
                payment.smeName?.toLowerCase().includes(query) ||
                payment.sdpName?.toLowerCase().includes(query) ||
                payment.budget?.toLowerCase().includes(query) ||
                payment.fee?.toLowerCase().includes(query));
      })
      .sort((a: any, b: any) => {
        // Sort by fundsReleasedAt or paymentConfirmedAt, newest first
        const dateA = a.paymentConfirmedAt?.toDate ? a.paymentConfirmedAt.toDate().getTime() : 
                     (a.fundsReleasedAt?.toDate ? a.fundsReleasedAt.toDate().getTime() : 
                      (a.fundsReleasedAt ? new Date(a.fundsReleasedAt).getTime() : 0));
        const dateB = b.paymentConfirmedAt?.toDate ? b.paymentConfirmedAt.toDate().getTime() : 
                     (b.fundsReleasedAt?.toDate ? b.fundsReleasedAt.toDate().getTime() : 
                      (b.fundsReleasedAt ? new Date(b.fundsReleasedAt).getTime() : 0));
        return dateB - dateA;
      });

    const formatDate = (date: any) => {
      if (!date) return 'N/A';
      if (date.toDate) return date.toDate().toLocaleDateString('en-ZA', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      if (typeof date === 'string') return new Date(date).toLocaleDateString('en-ZA', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      return 'N/A';
    };

    return (
      <div className="space-y-6">
        {/* Payment Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500 to-blue-600 opacity-5 rounded-full -mr-16 -mt-16 group-hover:opacity-10 transition-opacity"></div>
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <div className="text-3xl font-extrabold text-gray-900 mb-1">{totalPayments}</div>
              <div className="text-sm font-medium text-gray-600">Total Payments</div>
              <div className="text-xs text-gray-500 mt-1">
                R{totalAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-yellow-500 to-yellow-600 opacity-5 rounded-full -mr-16 -mt-16 group-hover:opacity-10 transition-opacity"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                {pendingPaymentsList.length > 0 && (
                  <Badge variant="warning" size="sm">{pendingPaymentsList.length} pending</Badge>
                )}
              </div>
              <div className="text-3xl font-extrabold text-gray-900 mb-1">{pendingPaymentsList.length}</div>
              <div className="text-sm font-medium text-gray-600">Pending Confirmation</div>
              <div className="text-xs text-gray-500 mt-1">
                R{pendingAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-500 to-green-600 opacity-5 rounded-full -mr-16 -mt-16 group-hover:opacity-10 transition-opacity"></div>
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <div className="text-3xl font-extrabold text-gray-900 mb-1">{confirmedPayments.length}</div>
              <div className="text-sm font-medium text-gray-600">Confirmed</div>
              <div className="text-xs text-gray-500 mt-1">
                R{confirmedAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500 to-purple-600 opacity-5 rounded-full -mr-16 -mt-16 group-hover:opacity-10 transition-opacity"></div>
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                <CreditCard className="w-6 h-6 text-white" />
              </div>
              <div className="text-3xl font-extrabold text-gray-900 mb-1">
                R{totalAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-sm font-medium text-gray-600">Total Amount</div>
              <div className="text-xs text-gray-500 mt-1">
                Across all payments
              </div>
            </div>
          </div>
        </div>

        {/* Payments List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">All Payments</h2>
                <p className="text-sm text-gray-600 mt-1">View and manage all payment confirmations</p>
              </div>
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search payments..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent w-64"
                  />
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleExport('Payments')}
                  className="hover:bg-green-50 hover:border-green-300 hover:text-green-600 transition-colors"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center space-x-2 pb-4 border-b border-gray-200">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  filterStatus === 'all' 
                    ? 'bg-green-600 text-white shadow-md' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All ({totalPayments})
              </button>
              <button
                onClick={() => setFilterStatus('pending')}
                className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  filterStatus === 'pending' 
                    ? 'bg-yellow-600 text-white shadow-md' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Pending ({pendingPaymentsList.length})
              </button>
              <button
                onClick={() => setFilterStatus('confirmed')}
                className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  filterStatus === 'confirmed' 
                    ? 'bg-green-600 text-white shadow-md' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Confirmed ({confirmedPayments.length})
              </button>
            </div>
          </div>

          <div className="p-6">
            {loading.engagements ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mb-4"></div>
                <p className="text-gray-500">Loading payments...</p>
              </div>
            ) : filteredPayments.length === 0 ? (
              <div className="text-center py-12">
                <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 font-medium">No payments found</p>
                <p className="text-sm text-gray-500 mt-1">
                  {searchQuery ? 'Try adjusting your search criteria' : 'Payments will appear here once funds are released'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredPayments.map((payment: any) => {
                  const isPending = payment.fundsReleasedAt && !payment.paymentConfirmedByAdmin;
                  const isConfirmed = payment.paymentConfirmedByAdmin;

                  // Get SME and SDP names
                  let smeName = payment.smeName || payment.sme;
                  let sdpName = payment.sdpName || payment.sdp;
                  
                  if (!smeName && payment.smeId) {
                    const sme = recentSMEs.find((s: any) => s.id === payment.smeId);
                    smeName = sme?.name || sme?.profile?.name || 'N/A';
                  }
                  
                  if (!sdpName && payment.sdpId) {
                    const sdp = recentSDPs.find((s: any) => s.id === payment.sdpId);
                    sdpName = sdp?.name || sdp?.profile?.name || 'N/A';
                  }

                  return (
                    <div 
                      key={payment.id}
                      className={`p-6 rounded-xl hover:shadow-lg transition-all duration-200 border-2 ${
                        isConfirmed 
                          ? 'bg-gradient-to-r from-green-50 to-white border-green-200' 
                          : 'bg-gradient-to-r from-yellow-50 to-white border-yellow-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-4 flex-1">
                          <div className={`w-16 h-16 rounded-xl flex items-center justify-center shadow-md ${
                            isConfirmed 
                              ? 'bg-gradient-to-br from-green-500 to-green-600' 
                              : 'bg-gradient-to-br from-yellow-500 to-yellow-600'
                          }`}>
                            {isConfirmed ? (
                              <CheckCircle className="w-8 h-8 text-white" />
                            ) : (
                              <Clock className="w-8 h-8 text-white" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-3">
                              <h3 className="font-bold text-lg text-gray-900">
                                {payment.projectName || payment.type || 'Payment'}
                              </h3>
                              {isConfirmed ? (
                                <Badge variant="success" size="sm" className="font-medium">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Confirmed
                                </Badge>
                              ) : (
                                <Badge variant="warning" size="sm" className="font-medium">
                                  <Clock className="w-3 h-3 mr-1" />
                                  Pending Confirmation
                                </Badge>
                              )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                                <p className="text-xs font-semibold text-blue-700 mb-1">SDP (Client)</p>
                                <p className="font-semibold text-gray-900">{sdpName || 'N/A'}</p>
                              </div>
                              <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                                <p className="text-xs font-semibold text-green-700 mb-1">SME (Provider)</p>
                                <p className="font-semibold text-gray-900">{smeName || 'N/A'}</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-4">
                              <div className="bg-gray-50 rounded-lg p-3">
                                <p className="text-xs text-gray-500 mb-1">Amount</p>
                                <p className="font-bold text-gray-900 text-lg text-green-600">
                                  {payment.budget || payment.fee || 'TBD'}
                                </p>
                              </div>
                              {payment.fundsReleasedAt && (
                                <div className="bg-gray-50 rounded-lg p-3">
                                  <p className="text-xs text-gray-500 mb-1">Funds Released</p>
                                  <p className="font-medium text-gray-900">
                                    {formatDate(payment.fundsReleasedAt)}
                                  </p>
                                </div>
                              )}
                              {isConfirmed && payment.paymentConfirmedAt && (
                                <div className="bg-gray-50 rounded-lg p-3">
                                  <p className="text-xs text-gray-500 mb-1">Confirmed On</p>
                                  <p className="font-medium text-green-600">
                                    {formatDate(payment.paymentConfirmedAt)}
                                  </p>
                                </div>
                              )}
                            </div>

                            {isConfirmed && payment.paymentConfirmedBy && (
                              <div className="bg-green-50 border-l-4 border-green-600 rounded-lg p-3 mb-4">
                                <p className="text-xs font-semibold text-green-700 mb-1">Confirmed by Admin</p>
                                <p className="text-sm text-green-800">
                                  {payment.paymentConfirmedByName || 'Admin'} on {formatDate(payment.paymentConfirmedAt)}
                                </p>
                              </div>
                            )}

                            {isPending && (
                              <div className="bg-yellow-50 border-l-4 border-yellow-600 rounded-lg p-3 mb-4">
                                <p className="text-xs font-semibold text-yellow-900 mb-1">⚠️ Action Required</p>
                                <p className="text-xs text-yellow-800">
                                  Please verify that the payment of <strong>{payment.budget || payment.fee}</strong> has been successfully transferred to {smeName}'s bank account before confirming.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 ml-6">
                          {isPending && (
                            <Button 
                              variant="primary" 
                              size="sm"
                              onClick={() => {
                                setSelectedPayment(payment);
                                setShowPaymentModal(true);
                              }}
                              className="bg-green-600 hover:bg-green-700 hover:shadow-lg transition-all"
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Confirm Payment
                            </Button>
                          )}
                          {isConfirmed && (
                            <Badge variant="success" size="sm" className="font-medium">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Payment Confirmed
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
                    {billingInfo && (
                      <div className="mt-6 border-t border-gray-200 pt-4">
                        <h4 className="text-base font-semibold text-gray-900 mb-3 flex items-center">
                          <CreditCard className="w-4 h-4 mr-2 text-blue-600" />
                          Billing & Banking Snapshot
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500">Billing Contact</p>
                            <p className="font-semibold text-gray-900">{billingInfo.contactEmail || 'Not provided'}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Phone</p>
                            <p className="font-semibold text-gray-900">{billingInfo.phone || 'Not provided'}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Bank Name</p>
                            <p className="font-semibold text-gray-900">{billingInfo.bankName || 'Not provided'}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Account Holder</p>
                            <p className="font-semibold text-gray-900">{billingInfo.accountHolder || 'Not provided'}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Account Number</p>
                            <p className="font-semibold text-gray-900">{maskAccountNumber(billingInfo.accountNumber)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Branch / Code</p>
                            <p className="font-semibold text-gray-900">{billingInfo.branchCode || 'Not provided'}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Account Type</p>
                            <p className="font-semibold text-gray-900">{billingInfo.accountType || 'Not provided'}</p>
                          </div>
                        </div>
                      </div>
                    )}
        </div>
      </div>
    );
  };

  const renderDisputes = () => {
    // Combine active disputes (status === 'Disputed') and resolved disputes (disputeResolvedAt exists)
    const allDisputes = recentEngagements.filter((e: any) => 
      e.status === 'Disputed' || e.disputeResolvedAt
    );

    // Calculate dispute stats
    const activeDisputes = allDisputes.filter((d: any) => d.status === 'Disputed');
    const resolvedDisputesList = allDisputes.filter((d: any) => d.disputeResolvedAt);
    const totalDisputes = allDisputes.length;
    
    const recentDisputes = activeDisputes.filter((d: any) => {
      if (!d.disputedAt) return false;
      const disputeDate = d.disputedAt?.toDate ? d.disputedAt.toDate() : new Date(d.disputedAt);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return disputeDate >= sevenDaysAgo;
    }).length;
    
    const resolvedDisputes = resolvedDisputesList.length;
    const totalDisputeValue = activeDisputes.reduce((sum: number, d: any) => {
      const amount = parseFloat((d.budget || d.fee || '0').replace(/[^0-9.]/g, '')) || 0;
      return sum + amount;
    }, 0);

    // Filter disputes
    const filteredDisputes = allDisputes
      .filter((dispute: any) => {
        if (filterStatus === 'all') return true;
        if (filterStatus === 'recent') {
          if (!dispute.disputedAt) return false;
          const disputeDate = dispute.disputedAt?.toDate ? dispute.disputedAt.toDate() : new Date(dispute.disputedAt);
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          return disputeDate >= sevenDaysAgo;
        }
        if (filterStatus === 'resolved') {
          return dispute.disputeResolvedAt && dispute.status !== 'Disputed';
        }
        return true;
      })
      .filter((dispute: any) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (dispute.projectName?.toLowerCase().includes(query) ||
                dispute.type?.toLowerCase().includes(query) ||
                dispute.smeName?.toLowerCase().includes(query) ||
                dispute.sdpName?.toLowerCase().includes(query) ||
                dispute.disputeReason?.toLowerCase().includes(query) ||
                dispute.disputedByName?.toLowerCase().includes(query));
      })
      .sort((a: any, b: any) => {
        // Sort by dispute date, newest first
        const dateA = a.disputedAt?.toDate ? a.disputedAt.toDate().getTime() : 
                     (a.disputedAt ? new Date(a.disputedAt).getTime() : 0);
        const dateB = b.disputedAt?.toDate ? b.disputedAt.toDate().getTime() : 
                     (b.disputedAt ? new Date(b.disputedAt).getTime() : 0);
        return dateB - dateA;
      });

    const formatDate = (date: any) => {
      if (!date) return 'N/A';
      if (date.toDate) return date.toDate().toLocaleDateString('en-ZA', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      if (typeof date === 'string') return new Date(date).toLocaleDateString('en-ZA', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      return 'N/A';
    };

    const getTimeAgo = (timestamp: any) => {
      if (!timestamp) return 'Unknown';
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
      return formatDate(timestamp);
    };

    return (
      <div className="space-y-6">
        {/* Dispute Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-red-500 to-red-600 opacity-5 rounded-full -mr-16 -mt-16 group-hover:opacity-10 transition-opacity"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                  <AlertTriangle className="w-6 h-6 text-white" />
                </div>
                {totalDisputes > 0 && (
                  <Badge variant="danger" size="sm">{totalDisputes} active</Badge>
                )}
              </div>
              <div className="text-3xl font-extrabold text-gray-900 mb-1">{activeDisputes.length}</div>
              <div className="text-sm font-medium text-gray-600">Active Disputes</div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-orange-500 to-orange-600 opacity-5 rounded-full -mr-16 -mt-16 group-hover:opacity-10 transition-opacity"></div>
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <div className="text-3xl font-extrabold text-gray-900 mb-1">{recentDisputes}</div>
              <div className="text-sm font-medium text-gray-600">Last 7 Days</div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-500 to-green-600 opacity-5 rounded-full -mr-16 -mt-16 group-hover:opacity-10 transition-opacity"></div>
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <div className="text-3xl font-extrabold text-gray-900 mb-1">{resolvedDisputes}</div>
              <div className="text-sm font-medium text-gray-600">Resolved</div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-yellow-500 to-yellow-600 opacity-5 rounded-full -mr-16 -mt-16 group-hover:opacity-10 transition-opacity"></div>
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <div className="text-3xl font-extrabold text-gray-900 mb-1">
                R{totalDisputeValue.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-sm font-medium text-gray-600">Total Value at Risk</div>
            </div>
          </div>
        </div>

        {/* Disputes List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">All Disputes</h2>
                <p className="text-sm text-gray-600 mt-1">Review and resolve project disputes between SDPs and SMEs</p>
              </div>
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search disputes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent w-64"
                  />
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleExport('Disputes')}
                  className="hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-colors"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center space-x-2 pb-4 border-b border-gray-200">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  filterStatus === 'all' 
                    ? 'bg-red-600 text-white shadow-md' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All ({totalDisputes})
              </button>
              <button
                onClick={() => setFilterStatus('recent')}
                className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  filterStatus === 'recent' 
                    ? 'bg-red-600 text-white shadow-md' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Recent ({recentDisputes})
              </button>
              <button
                onClick={() => setFilterStatus('resolved')}
                className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  filterStatus === 'resolved' 
                    ? 'bg-red-600 text-white shadow-md' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Resolved ({resolvedDisputes})
              </button>
            </div>
          </div>

          <div className="p-6">
            {loading.engagements ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mb-4"></div>
                <p className="text-gray-500">Loading disputes...</p>
              </div>
            ) : filteredDisputes.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <p className="text-gray-600 font-medium">No disputes found</p>
                <p className="text-sm text-gray-500 mt-1">
                  {searchQuery ? 'Try adjusting your search criteria' : 'All projects are running smoothly!'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredDisputes.map((dispute: any) => {
                  const isResolved = dispute.disputeResolvedAt && dispute.status !== 'Disputed';
                  return (
                  <div 
                    key={dispute.id}
                    className={`p-6 rounded-xl hover:shadow-lg transition-all duration-200 border-2 ${
                      isResolved 
                        ? 'bg-gradient-to-r from-green-50 to-white border-green-200' 
                        : 'bg-gradient-to-r from-red-50 to-white border-red-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4 flex-1">
                        <div className={`w-16 h-16 rounded-xl flex items-center justify-center shadow-md ${
                          isResolved 
                            ? 'bg-gradient-to-br from-green-500 to-green-600' 
                            : 'bg-gradient-to-br from-red-500 to-red-600'
                        }`}>
                          {isResolved ? (
                            <CheckCircle className="w-8 h-8 text-white" />
                          ) : (
                            <AlertTriangle className="w-8 h-8 text-white" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-3">
                            <h3 className="font-bold text-lg text-gray-900">
                              {dispute.projectName || dispute.type || 'Project Dispute'}
                            </h3>
                            {isResolved ? (
                              <Badge variant="success" size="sm" className="font-medium">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Resolved
                              </Badge>
                            ) : (
                              <Badge variant="danger" size="sm" className="font-medium">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                Active Dispute
                              </Badge>
                            )}
                            {dispute.disputedAt && (
                              <Badge variant="outline" size="sm" className="text-xs">
                                {getTimeAgo(dispute.disputedAt)}
                              </Badge>
                            )}
                            {isResolved && dispute.disputeResolvedAt && (
                              <Badge variant="outline" size="sm" className="text-xs text-green-700 border-green-300">
                                Resolved {getTimeAgo(dispute.disputeResolvedAt)}
                              </Badge>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                              <p className="text-xs font-semibold text-blue-700 mb-1">SDP (Client)</p>
                              <p className="font-semibold text-gray-900">{dispute.sdpName || dispute.sdp || 'N/A'}</p>
                              {dispute.sdpId && (
                                <p className="text-xs text-gray-600 mt-1">ID: {dispute.sdpId}</p>
                              )}
                            </div>
                            <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                              <p className="text-xs font-semibold text-green-700 mb-1">SME (Service Provider)</p>
                              <p className="font-semibold text-gray-900">{dispute.smeName || dispute.sme || 'N/A'}</p>
                              {dispute.smeId && (
                                <p className="text-xs text-gray-600 mt-1">ID: {dispute.smeId}</p>
                              )}
                            </div>
                          </div>

                          {isResolved ? (
                            <div className="bg-green-50 border-l-4 border-green-600 rounded-lg p-4 mb-4">
                              <div className="flex items-start space-x-3">
                                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-sm font-semibold text-green-900">
                                      Resolved by: {dispute.disputeResolvedByName || 'Admin'}
                                    </p>
                                    {dispute.disputeResolvedAt && (
                                      <p className="text-xs text-green-700">
                                        {formatDate(dispute.disputeResolvedAt)}
                                      </p>
                                    )}
                                  </div>
                                  <p className="text-sm text-green-800 mb-2">
                                    <strong>Resolution:</strong> {dispute.disputeResolution === 'release' ? 'Funds Released to SME' : 'Project Cancelled & Refunded to SDP'}
                                  </p>
                                  {dispute.disputeResolutionComment && (
                                    <p className="text-sm text-green-700 bg-white rounded p-2 border border-green-200">
                                      <strong>Comment:</strong> {dispute.disputeResolutionComment}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-red-50 border-l-4 border-red-600 rounded-lg p-4 mb-4">
                              <div className="flex items-start space-x-3">
                                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-sm font-semibold text-red-900">
                                      Dispute Raised by: {dispute.disputedByName || 'Unknown'}
                                    </p>
                                    {dispute.disputedAt && (
                                      <p className="text-xs text-red-700">
                                        {formatDate(dispute.disputedAt)}
                                      </p>
                                    )}
                                  </div>
                                  <p className="text-sm text-red-800">
                                    <strong>Reason:</strong> {dispute.disputeReason || 'No reason provided'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-4">
                            <div className="bg-gray-50 rounded-lg p-3">
                              <p className="text-xs text-gray-500 mb-1">Project Period</p>
                              <p className="font-semibold text-gray-900">
                                {dispute.startDate ? new Date(dispute.startDate).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' }) : 'N/A'} - {dispute.endDate ? new Date(dispute.endDate).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' }) : 'N/A'}
                              </p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-3">
                              <p className="text-xs text-gray-500 mb-1">Project Value</p>
                              <p className="font-semibold text-gray-900 text-lg text-green-600">
                                {dispute.budget || dispute.fee || 'N/A'}
                              </p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-3">
                              <p className="text-xs text-gray-500 mb-1">Status</p>
                              <p className={`font-semibold ${isResolved ? 'text-green-600' : 'text-gray-900'}`}>
                                {isResolved ? (dispute.status === 'Completed' ? 'Completed' : 'Cancelled') : (dispute.status || 'Disputed')}
                              </p>
                            </div>
                          </div>

                          {dispute.description && (
                            <div className="mb-4">
                              <p className="text-xs text-gray-500 mb-1">Project Description</p>
                              <p className="text-sm text-gray-700 line-clamp-2">{dispute.description}</p>
                            </div>
                          )}

                          {dispute.documents && dispute.documents.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                                <FileText className="w-4 h-4 mr-2" />
                                Project Documents ({dispute.documents.length})
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {dispute.documents.slice(0, 3).map((doc: any, idx: number) => (
                                  <button
                                    key={idx}
                                    onClick={() => window.open(doc.url, '_blank')}
                                    className="flex items-center space-x-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors"
                                  >
                                    <FileText className="w-4 h-4 text-gray-600" />
                                    <span className="text-gray-900">{doc.name || 'Document'}</span>
                                    <Eye className="w-3 h-3 text-gray-500" />
                                  </button>
                                ))}
                                {dispute.documents.length > 3 && (
                                  <span className="text-xs text-gray-500 self-center px-2">
                                    +{dispute.documents.length - 3} more
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 ml-6">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedDispute(dispute);
                            setShowDisputeModal(true);
                          }}
                          className={isResolved 
                            ? "hover:bg-green-50 hover:border-green-300 hover:text-green-600 transition-colors"
                            : "hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-colors"
                          }
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          {isResolved ? 'View Details' : 'Review & Resolve'}
                        </Button>
                      </div>
      </div>
    </div>
  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Dispute Resolution Modal */}
        {showDisputeModal && selectedDispute && (() => {
          const isResolved = selectedDispute.disputeResolvedAt && selectedDispute.status !== 'Disputed';
          return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className={`${isResolved ? 'bg-gradient-to-r from-green-600 to-green-700' : 'bg-gradient-to-r from-red-600 to-red-700'} text-white p-6 rounded-t-2xl sticky top-0 z-10`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                      {isResolved ? (
                        <CheckCircle className="w-6 h-6" />
                      ) : (
                        <AlertTriangle className="w-6 h-6" />
                      )}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">{isResolved ? 'Dispute Resolution Details' : 'Resolve Dispute'}</h2>
                      <p className={`${isResolved ? 'text-green-100' : 'text-red-100'} text-sm`}>
                        {selectedDispute.projectName || selectedDispute.type || 'Project Dispute'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowDisputeModal(false);
                      setSelectedDispute(null);
                      setReviewComment('');
                    }}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Project Information */}
                <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                    <FileText className="w-5 h-5 mr-2" />
                    Project Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Project Name</p>
                      <p className="font-semibold text-gray-900">{selectedDispute.projectName || selectedDispute.type || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Project Value</p>
                      <p className="font-semibold text-green-600 text-lg">{selectedDispute.budget || selectedDispute.fee || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">SDP (Client)</p>
                      <p className="font-semibold text-gray-900">{selectedDispute.sdpName || selectedDispute.sdp || 'N/A'}</p>
                      {selectedDispute.sdpId && (
                        <p className="text-xs text-gray-500 mt-1">ID: {selectedDispute.sdpId}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">SME (Provider)</p>
                      <p className="font-semibold text-gray-900">{selectedDispute.smeName || selectedDispute.sme || 'N/A'}</p>
                      {selectedDispute.smeId && (
                        <p className="text-xs text-gray-500 mt-1">ID: {selectedDispute.smeId}</p>
                      )}
                    </div>
                    {selectedDispute.startDate && selectedDispute.endDate && (
                      <>
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-1">Start Date</p>
                          <p className="font-semibold text-gray-900">
                            {new Date(selectedDispute.startDate).toLocaleDateString('en-ZA', { 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-1">End Date</p>
                          <p className="font-semibold text-gray-900">
                            {new Date(selectedDispute.endDate).toLocaleDateString('en-ZA', { 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                  {selectedDispute.description && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-sm font-medium text-gray-600 mb-1">Description</p>
                      <p className="text-gray-700 text-sm">{selectedDispute.description}</p>
                    </div>
                  )}
                </div>

                {/* Dispute Information */}
                {isResolved ? (
                  <div className="bg-green-50 border-l-4 border-green-600 rounded-lg p-6">
                    <h3 className="text-lg font-bold text-green-900 mb-4 flex items-center">
                      <CheckCircle className="w-5 h-5 mr-2" />
                      Resolution Information
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-green-700 mb-1">Resolved by</p>
                        <p className="font-semibold text-green-900">{selectedDispute.disputeResolvedByName || 'Admin'}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-green-700 mb-1">Resolved Date</p>
                        <p className="font-semibold text-green-900">
                          {selectedDispute.disputeResolvedAt 
                            ? (selectedDispute.disputeResolvedAt.toDate 
                                ? selectedDispute.disputeResolvedAt.toDate().toLocaleString('en-ZA')
                                : new Date(selectedDispute.disputeResolvedAt).toLocaleString('en-ZA'))
                            : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-green-700 mb-1">Resolution</p>
                        <p className="text-green-900 bg-white rounded-lg p-3 border border-green-200 font-semibold">
                          {selectedDispute.disputeResolution === 'release' ? 'Funds Released to SME' : 'Project Cancelled & Refunded to SDP'}
                        </p>
                      </div>
                      {selectedDispute.disputeResolutionComment && (
                        <div>
                          <p className="text-sm font-medium text-green-700 mb-1">Resolution Comment</p>
                          <p className="text-green-900 bg-white rounded-lg p-3 border border-green-200">
                            {selectedDispute.disputeResolutionComment}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-red-50 border-l-4 border-red-600 rounded-lg p-6">
                    <h3 className="text-lg font-bold text-red-900 mb-4 flex items-center">
                      <AlertTriangle className="w-5 h-5 mr-2" />
                      Dispute Information
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-red-700 mb-1">Raised by</p>
                        <p className="font-semibold text-red-900">{selectedDispute.disputedByName || 'Unknown'}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-red-700 mb-1">Date</p>
                        <p className="font-semibold text-red-900">
                          {selectedDispute.disputedAt 
                            ? (selectedDispute.disputedAt.toDate 
                                ? selectedDispute.disputedAt.toDate().toLocaleString('en-ZA')
                                : new Date(selectedDispute.disputedAt).toLocaleString('en-ZA'))
                            : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-red-700 mb-1">Reason</p>
                        <p className="text-red-900 bg-white rounded-lg p-3 border border-red-200">
                          {selectedDispute.disputeReason || 'No reason provided'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Original Dispute Information (for resolved disputes) */}
                {isResolved && (
                  <div className="bg-gray-50 border-l-4 border-gray-400 rounded-lg p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                      <AlertTriangle className="w-5 h-5 mr-2" />
                      Original Dispute Information
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-1">Raised by</p>
                        <p className="font-semibold text-gray-900">{selectedDispute.disputedByName || 'Unknown'}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-1">Date</p>
                        <p className="font-semibold text-gray-900">
                          {selectedDispute.disputedAt 
                            ? (selectedDispute.disputedAt.toDate 
                                ? selectedDispute.disputedAt.toDate().toLocaleString('en-ZA')
                                : new Date(selectedDispute.disputedAt).toLocaleString('en-ZA'))
                            : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-1">Reason</p>
                        <p className="text-gray-900 bg-white rounded-lg p-3 border border-gray-200">
                          {selectedDispute.disputeReason || 'No reason provided'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Evidence/Documents */}
                {selectedDispute.documents && selectedDispute.documents.length > 0 && (
                  <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                      <FolderOpen className="w-5 h-5 mr-2" />
                      Evidence & Documents ({selectedDispute.documents.length})
                    </h3>
                    <div className="space-y-3">
                      {selectedDispute.documents.map((doc: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between bg-white rounded-lg p-4 border border-blue-200 hover:shadow-md transition-shadow">
                          <div className="flex items-center space-x-3 flex-1">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                              <FileText className="w-5 h-5 text-blue-600" />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{doc.name || 'Document'}</p>
                              {doc.uploadedByName && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Uploaded by {doc.uploadedByName} • {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString('en-ZA') : 'N/A'}
                                </p>
                              )}
                            </div>
                          </div>
                          {doc.url && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(doc.url, '_blank')}
                              className="hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600"
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Admin Decision - Only show for unresolved disputes */}
                {!isResolved && (
                  <div className="border-2 border-gray-300 rounded-xl p-6 bg-gray-50">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                      <Gavel className="w-5 h-5 mr-2" />
                      Admin Decision
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Resolution Comment <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          value={reviewComment}
                          onChange={(e) => setReviewComment(e.target.value)}
                          rows={5}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                          placeholder="Provide a detailed explanation for your decision. This comment will be visible to both parties..."
                        />
                      </div>

                      <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-lg p-4">
                        <div className="flex items-start space-x-3">
                          <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                          <div className="text-sm text-yellow-800">
                            <p className="font-semibold mb-2">Important Decision</p>
                            <ul className="space-y-1 list-disc list-inside">
                              <li><strong>Release Funds:</strong> Marks project as Completed, releases payment to SME.</li>
                              <li><strong>Reject & Refund:</strong> Cancels project, returns funds to SDP.</li>
                            </ul>
                            <p className="mt-2 text-xs">This action cannot be undone.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-gray-200 bg-gray-50 flex items-center justify-end space-x-3 sticky bottom-0">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDisputeModal(false);
                    setSelectedDispute(null);
                    setReviewComment('');
                  }}
                >
                  Close
                </Button>
                {!isResolved && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (!reviewComment.trim()) {
                          alert('Please provide a resolution comment.');
                          return;
                        }
                        if (confirm('Are you sure you want to REJECT this project and refund the SDP?\n\nThis action cannot be undone.')) {
                          handleResolveDispute(selectedDispute.id, 'reject', reviewComment);
                          setShowDisputeModal(false);
                          setSelectedDispute(null);
                          setReviewComment('');
                        }
                      }}
                      className="bg-red-600 hover:bg-red-700 text-white border-red-600"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject & Refund SDP
                    </Button>
                    <Button
                      onClick={() => {
                        if (!reviewComment.trim()) {
                          alert('Please provide a resolution comment.');
                          return;
                        }
                        if (confirm('Are you sure you want to RELEASE FUNDS to the SME?\n\nThis action cannot be undone.')) {
                          handleResolveDispute(selectedDispute.id, 'release', reviewComment);
                          setShowDisputeModal(false);
                          setSelectedDispute(null);
                          setReviewComment('');
                        }
                      }}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Release Funds to SME
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
          );
        })()}
      </div>
    );
  };

  // Load blogs
  useEffect(() => {
    if (activeView === 'blogs' && isFirebaseConfigured()) {
      const blogsRef = collection(db, 'blogs');
      const q = query(blogsRef, orderBy('createdAt', 'desc'));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const blogsData: Blog[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          blogsData.push({
            id: doc.id,
            ...data,
            publishedAt: data.publishedAt,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          } as Blog);
        });
        setBlogs(blogsData);
      });

      return () => unsubscribe();
    }
  }, [activeView]);

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleCreateBlog = () => {
    setBlogFormData({
      title: '',
      slug: '',
      content: '',
      excerpt: '',
      featuredImage: '',
      category: '',
      tags: [],
      status: 'draft'
    });
    setSelectedBlog(null);
    setShowBlogModal(true);
  };

  const handleEditBlog = (blog: Blog) => {
    setBlogFormData({
      title: blog.title,
      slug: blog.slug,
      content: blog.content,
      excerpt: blog.excerpt || '',
      featuredImage: blog.featuredImage || '',
      category: blog.category || '',
      tags: blog.tags || [],
      status: blog.status
    });
    setSelectedBlog(blog);
    setImagePreview(blog.featuredImage || null);
    setShowBlogModal(true);
  };

  const handleSaveBlog = async () => {
    if (!blogFormData.title.trim()) {
      alert('Please enter a title');
      return;
    }
    if (!blogFormData.content.trim()) {
      alert('Please enter content');
      return;
    }

    try {
      const slug = blogFormData.slug || generateSlug(blogFormData.title);
      const now = Timestamp.now();
      const blogData = {
        ...blogFormData,
        slug,
        authorId: user.id,
        authorName: user.profile?.name || user.email,
        authorEmail: user.email,
        updatedAt: now,
        ...(selectedBlog ? {} : { createdAt: now }),
        ...(blogFormData.status === 'published' && !selectedBlog?.publishedAt 
          ? { publishedAt: now } 
          : blogFormData.status === 'published' && selectedBlog?.publishedAt
          ? { publishedAt: selectedBlog.publishedAt }
          : {})
      };

      if (selectedBlog) {
        await updateDoc(doc(db, 'blogs', selectedBlog.id), blogData);
      } else {
        await addDoc(collection(db, 'blogs'), blogData);
      }

      setShowBlogModal(false);
      setSelectedBlog(null);
      setImagePreview(null);
      alert(selectedBlog ? 'Blog updated successfully!' : 'Blog created successfully!');
    } catch (error: any) {
      console.error('Error saving blog:', error);
      alert('Failed to save blog: ' + error.message);
    }
  };

  const handleDeleteBlog = async (blogId: string) => {
    if (!confirm('Are you sure you want to delete this blog? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'blogs', blogId));
      alert('Blog deleted successfully!');
    } catch (error: any) {
      console.error('Error deleting blog:', error);
      alert('Failed to delete blog: ' + error.message);
    }
  };

  const handleToggleBlogStatus = async (blog: Blog) => {
    try {
      const newStatus = blog.status === 'published' ? 'draft' : 'published';
      const updateData: any = {
        status: newStatus,
        updatedAt: Timestamp.now()
      };

      if (newStatus === 'published' && !blog.publishedAt) {
        updateData.publishedAt = Timestamp.now();
      }

      await updateDoc(doc(db, 'blogs', blog.id), updateData);
      alert(`Blog ${newStatus === 'published' ? 'published' : 'unpublished'} successfully!`);
    } catch (error: any) {
      console.error('Error updating blog status:', error);
      alert('Failed to update blog status: ' + error.message);
    }
  };

  const addTag = () => {
    if (blogTagInput.trim() && !blogFormData.tags.includes(blogTagInput.trim())) {
      setBlogFormData({
        ...blogFormData,
        tags: [...blogFormData.tags, blogTagInput.trim()]
      });
      setBlogTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setBlogFormData({
      ...blogFormData,
      tags: blogFormData.tags.filter(t => t !== tag)
    });
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }

    if (!isStorageConfigured()) {
      alert('Storage is not configured. Please use an image URL instead.');
      return;
    }

    try {
      setUploadingImage(true);
      
      // Create a preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Upload to Firebase Storage
      const timestamp = Date.now();
      const fileName = `blog-images/${user.id}/${timestamp}-${file.name}`;
      const storageRef = ref(storage, fileName);
      
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      
      setBlogFormData({
        ...blogFormData,
        featuredImage: downloadURL
      });
      
      alert('Image uploaded successfully!');
    } catch (error: any) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image: ' + error.message);
      setImagePreview(null);
    } finally {
      setUploadingImage(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const handleRemoveImage = () => {
    setBlogFormData({
      ...blogFormData,
      featuredImage: ''
    });
    setImagePreview(null);
  };

  const handleGenerateAIBlog = async () => {
    if (!isFirebaseConfigured()) {
      alert('Firebase is not configured');
      return;
    }

    try {
      setAiGenerating(true);
      const generateBlog = httpsCallable(functions, 'generateBlogWithAI');
      
      const result = await generateBlog({
        topic: selectedAITopic,
        category: aiCategory,
        customTopic: customAITopic.trim() || undefined
      });

      const data = result.data as any;
      if (data.success && data.blog) {
        // Populate form with generated blog
        setBlogFormData({
          title: data.blog.title,
          slug: data.blog.slug || generateSlug(data.blog.title),
          content: data.blog.content,
          excerpt: data.blog.excerpt || '',
          featuredImage: '',
          category: data.blog.category || aiCategory,
          tags: data.blog.tags || [],
          status: 'draft'
        });
        setShowAIGenerateModal(false);
        setShowBlogModal(true);
        setSelectedBlog(null);
        setSelectedAITopic('funding');
        setCustomAITopic('');
        setAiCategory('Education');
        alert('Blog generated successfully! Review and edit before publishing.');
      } else {
        alert('Failed to generate blog. Please try again.');
      }
    } catch (error: any) {
      console.error('Error generating blog:', error);
      alert('Error generating blog: ' + (error.message || 'Unknown error'));
    } finally {
      setAiGenerating(false);
    }
  };

  const renderBlogs = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Manage Blogs</h2>
          <div className="flex items-center space-x-3">
            <Button
              onClick={() => setShowAIGenerateModal(true)}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Generate with AI
            </Button>
            <Button
              onClick={handleCreateBlog}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Blog
            </Button>
          </div>
        </div>

        {blogs.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg mb-4">No blogs yet</p>
            <Button
              onClick={handleCreateBlog}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Blog
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {blogs.map((blog) => (
              <div
                key={blog.id}
                className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-all bg-white"
              >
                <div className="flex flex-col md:flex-row">
                  {/* Featured Image */}
                  {blog.featuredImage && (
                    <div className="md:w-64 w-full h-48 md:h-auto bg-gray-100 flex-shrink-0">
                      <img
                        src={blog.featuredImage}
                        alt={blog.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  
                  {/* Content */}
                  <div className="flex-1 p-5 flex flex-col">
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center flex-wrap gap-2 mb-2">
                            <h3 className="text-xl font-bold text-gray-900">{blog.title}</h3>
                            <Badge
                              variant={blog.status === 'published' ? 'default' : 'warning'}
                              size="sm"
                              className="font-semibold"
                            >
                              {blog.status === 'published' ? '✓ Published' : 'Draft'}
                            </Badge>
                            {blog.category && (
                              <Badge variant="outline" size="sm" className="border-blue-300 text-blue-700">
                                {blog.category}
                              </Badge>
                            )}
                          </div>
                          <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                            {blog.excerpt || blog.content.replace(/<[^>]*>/g, '').substring(0, 150) + '...'}
                          </p>
                        </div>
                      </div>
                      
                      {/* Tags */}
                      {blog.tags && blog.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {blog.tags.slice(0, 3).map((tag, idx) => (
                            <span key={idx} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                              #{tag}
                            </span>
                          ))}
                          {blog.tags.length > 3 && (
                            <span className="px-2 py-0.5 text-xs text-gray-400">+{blog.tags.length - 3} more</span>
                          )}
                        </div>
                      )}
                      
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span className="flex items-center">
                          <User className="w-3 h-3 mr-1" />
                          {blog.authorName}
                        </span>
                        <span className="flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {formatDateTime(blog.createdAt, 'N/A')}
                        </span>
                        {blog.views !== undefined && (
                          <span className="flex items-center">
                            <Eye className="w-3 h-3 mr-1" />
                            {blog.views} views
                          </span>
                        )}
                      </div>
                      </div>
                    
                    {/* Action Buttons */}
                    <div className="flex items-center space-x-2 mt-4 pt-4 border-t border-gray-200">
                      <Button
                        onClick={() => handleToggleBlogStatus(blog)}
                        size="sm"
                        className={blog.status === 'published' 
                          ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                          : 'bg-green-600 hover:bg-green-700 text-white'
                        }
                      >
                        {blog.status === 'published' ? (
                          <>
                            <EyeOff className="w-4 h-4 mr-1" />
                            Unpublish
                          </>
                        ) : (
                          <>
                            <Eye className="w-4 h-4 mr-1" />
                            Publish
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={() => handleEditBlog(blog)}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        onClick={() => {
                          if (blog.slug) {
                            window.open(`/blogs/${blog.slug}`, '_blank');
                          } else {
                            alert('Blog slug is missing. Please edit the blog and add a slug.');
                          }
                        }}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                        disabled={!blog.slug}
                      >
                        <ExternalLink className="w-4 h-4 mr-1" />
                        View
                      </Button>
                      <Button
                        onClick={() => handleDeleteBlog(blog.id)}
                        size="sm"
                        variant="outline"
                        className="border-red-300 text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Blog Modal */}
      {showBlogModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
            {/* Stunning Header */}
            <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">
                      {selectedBlog ? 'Edit Blog Post' : 'Create Stunning Blog'}
                    </h2>
                    <p className="text-blue-100 text-sm mt-1">
                      {selectedBlog ? 'Update your blog content' : 'Share your knowledge with the world'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowBlogModal(false);
                    setSelectedBlog(null);
                    setImagePreview(null);
                  }}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50">
              {/* Title */}
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <span className="text-red-500">*</span> Blog Title
                </label>
                <input
                  type="text"
                  value={blogFormData.title}
                  onChange={(e) => {
                    setBlogFormData({
                      ...blogFormData,
                      title: e.target.value,
                      slug: blogFormData.slug || generateSlug(e.target.value)
                    });
                  }}
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="Enter a captivating blog title..."
                />
              </div>

              {/* Slug and Excerpt Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    URL Slug
                  </label>
                  <input
                    type="text"
                    value={blogFormData.slug}
                    onChange={(e) => setBlogFormData({ ...blogFormData, slug: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="blog-url-slug"
                  />
                  <p className="text-xs text-gray-500 mt-1">Auto-generated from title</p>
                </div>

                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Category
                  </label>
                  <input
                    type="text"
                    value={blogFormData.category}
                    onChange={(e) => setBlogFormData({ ...blogFormData, category: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="e.g., Education, News"
                  />
                </div>
              </div>

              {/* Excerpt */}
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Excerpt / Summary
                </label>
                <textarea
                  value={blogFormData.excerpt}
                  onChange={(e) => setBlogFormData({ ...blogFormData, excerpt: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none"
                  rows={3}
                  placeholder="Write a compelling summary that will appear in blog listings..."
                />
                <p className="text-xs text-gray-500 mt-2">
                  This will be shown in blog previews and search results
                </p>
              </div>

              {/* Content Editor */}
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <span className="text-red-500">*</span> Blog Content
                </label>
                <textarea
                  value={blogFormData.content}
                  onChange={(e) => setBlogFormData({ ...blogFormData, content: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-mono text-sm"
                  rows={16}
                  placeholder="Write your blog content here... You can use HTML tags for formatting:

<h2>Heading</h2>
<p>Paragraph text</p>
<ul><li>List items</li></ul>
<strong>Bold</strong> and <em>italic</em> text"
                />
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    HTML formatting supported • Use &lt;h2&gt;, &lt;p&gt;, &lt;ul&gt;, &lt;li&gt;, &lt;strong&gt;, &lt;em&gt; tags
                  </p>
                  <span className="text-xs text-gray-400">
                    {blogFormData.content.length} characters
                  </span>
                </div>
              </div>

              {/* Featured Image Section */}
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  <ImageIcon className="w-4 h-4 inline mr-2" />
                  Featured Image
                </label>
                
                {/* Image Preview */}
                {(imagePreview || blogFormData.featuredImage) && (
                  <div className="mb-4 relative group">
                    <div className="relative rounded-xl overflow-hidden border-2 border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 shadow-inner">
                      <img
                        src={imagePreview || blogFormData.featuredImage}
                        alt="Featured"
                        className="w-full h-72 object-cover"
                        onError={() => {
                          setImagePreview(null);
                          setBlogFormData({ ...blogFormData, featuredImage: '' });
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <button
                        onClick={handleRemoveImage}
                        className="absolute top-3 right-3 p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-all shadow-lg opacity-0 group-hover:opacity-100"
                        type="button"
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Upload Section */}
                <div className="space-y-4">
                  <label
                    htmlFor="image-upload"
                    className={`flex items-center justify-center px-6 py-8 border-2 border-dashed rounded-xl cursor-pointer transition-all bg-gradient-to-br ${
                      uploadingImage
                        ? 'border-blue-400 bg-blue-50 from-blue-50 to-blue-100'
                        : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50 from-white to-gray-50'
                    }`}
                  >
                    {uploadingImage ? (
                      <div className="flex flex-col items-center space-y-3 text-blue-600">
                        <Loader2 className="w-8 h-8 animate-spin" />
                        <span className="font-semibold">Uploading image...</span>
                        <span className="text-sm text-blue-500">Please wait</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center space-y-3 text-gray-600">
                        <div className="p-4 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full shadow-lg">
                          <Upload className="w-8 h-8 text-blue-600" />
                        </div>
                        <div className="text-center">
                          <span className="font-semibold text-gray-900 block">Click to upload image</span>
                          <span className="text-sm text-gray-500 block mt-1">or drag and drop</span>
                          <span className="text-xs text-gray-400 block mt-2">PNG, JPG, GIF up to 5MB</span>
                        </div>
                      </div>
                    )}
                    <input
                      id="image-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                      className="hidden"
                    />
                  </label>

                  {/* Or use URL */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-3 bg-white text-gray-500 font-medium">OR</span>
                    </div>
                  </div>

                  <div>
                    <input
                      type="url"
                      value={blogFormData.featuredImage}
                      onChange={(e) => {
                        setBlogFormData({ ...blogFormData, featuredImage: e.target.value });
                        if (e.target.value) {
                          setImagePreview(e.target.value);
                        }
                      }}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      placeholder="Paste image URL here (e.g., https://example.com/image.jpg)"
                    />
                    <p className="text-xs text-gray-500 mt-2 flex items-center">
                      <ImageIcon className="w-3 h-3 mr-1" />
                      Use an external image URL if you prefer not to upload
                    </p>
                  </div>
                </div>
              </div>

              {/* Tags and Status */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Tags */}
                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Tags
                  </label>
                  <div className="flex flex-wrap gap-2 mb-3 min-h-[40px]">
                    {blogFormData.tags.length > 0 ? (
                      blogFormData.tags.map((tag, index) => (
                        <Badge key={index} variant="default" size="sm" className="flex items-center px-3 py-1 bg-blue-100 text-blue-800 border border-blue-300">
                          {tag}
                          <button
                            onClick={() => removeTag(tag)}
                            className="ml-2 hover:text-red-600 transition-colors"
                            type="button"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-gray-400 italic">No tags added yet</span>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={blogTagInput}
                      onChange={(e) => setBlogTagInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addTag();
                        }
                      }}
                      className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      placeholder="Type tag and press Enter"
                    />
                    <Button 
                      onClick={addTag} 
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4"
                      disabled={!blogTagInput.trim()}
                    >
                      Add
                    </Button>
                  </div>
                </div>

                {/* Status */}
                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Publication Status
                  </label>
                  <select
                    value={blogFormData.status}
                    onChange={(e) => setBlogFormData({ ...blogFormData, status: e.target.value as 'draft' | 'published' })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium"
                  >
                    <option value="draft">📝 Draft (Save for later)</option>
                    <option value="published">🚀 Published (Make live)</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-2">
                    {blogFormData.status === 'draft' 
                      ? 'Blog will be saved but not visible to public'
                      : 'Blog will be immediately visible to all visitors'}
                  </p>
                </div>
              </div>

            </div>

            {/* Footer with Action Buttons */}
            <div className="bg-white border-t border-gray-200 p-6 rounded-b-2xl">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  {blogFormData.title && (
                    <span className="flex items-center">
                      <CheckCircle className="w-4 h-4 mr-1 text-green-500" />
                      Ready to {selectedBlog ? 'update' : 'publish'}
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-3">
                  <Button
                    onClick={() => {
                      setShowBlogModal(false);
                      setSelectedBlog(null);
                      setImagePreview(null);
                    }}
                    variant="outline"
                    className="border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveBlog}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all px-6"
                  >
                    {selectedBlog ? (
                      <>
                        <Edit className="w-4 h-4 mr-2" />
                        Update Blog
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Create Blog
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Generate Blog Modal */}
      {showAIGenerateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Sparkles className="w-6 h-6" />
                  <h2 className="text-2xl font-bold">Generate Blog with AI</h2>
                </div>
                <button
                  onClick={() => {
                    setShowAIGenerateModal(false);
                    setSelectedAITopic('funding');
                    setCustomAITopic('');
                    setAiCategory('Education');
                  }}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  disabled={aiGenerating}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Custom Topic Input - Above Select Topic */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <span className="flex items-center">
                    Custom Topic (Optional)
                    <span className="ml-2 text-xs text-gray-500 font-normal">- Be specific about what you want the AI to focus on</span>
                  </span>
                </label>
                <input
                  type="text"
                  value={customAITopic}
                  onChange={(e) => setCustomAITopic(e.target.value)}
                  placeholder="e.g., 'How to become a QCTO accredited assessor in Gauteng' or 'SETA funding for small businesses in 2025'"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                  disabled={aiGenerating}
                />
                <p className="text-xs text-gray-500 mt-2">
                  Enter a specific topic to guide the AI. If left empty, the selected topic below will be used.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Topic Category
                </label>
                <select
                  value={selectedAITopic}
                  onChange={(e) => setSelectedAITopic(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  disabled={aiGenerating}
                >
                  <option value="funding">Funding Opportunities</option>
                  <option value="facilitation">Facilitation Services</option>
                  <option value="assessors">Becoming an Assessor</option>
                  <option value="qcto">QCTO Qualifications</option>
                  <option value="setas">SETAs Overview</option>
                  <option value="government">Government Programs</option>
                  <option value="bursaries">Bursaries & Scholarships</option>
                  <option value="accreditations">Accreditations</option>
                  <option value="sme_income">Making Money as an SME</option>
                </select>
                <p className="text-xs text-gray-500 mt-2">
                  Select a general topic category. The custom topic above will take priority if provided.
                </p>
              </div>


              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <input
                  type="text"
                  value={aiCategory}
                  onChange={(e) => setAiCategory(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="e.g., Education, News"
                  disabled={aiGenerating}
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>AI Blog Generation:</strong> The AI will research and write a comprehensive blog post about your selected topic, 
                  focusing on the South African education context. The generated content will include natural links back to the Scholarz platform 
                  and will be ready for review and editing before publishing.
                </p>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <Button
                  onClick={() => {
                    setShowAIGenerateModal(false);
                    setSelectedAITopic('funding');
                    setCustomAITopic('');
                    setAiCategory('Education');
                  }}
                  className="bg-gray-600 hover:bg-gray-700 text-white"
                  disabled={aiGenerating}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleGenerateAIBlog}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                  disabled={aiGenerating || (selectedAITopic === 'custom' && !customAITopic.trim())}
                >
                  {aiGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate Blog
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderSMEs = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Manage SMEs</h2>
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search SMEs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleExport('SMEs')}
              className="hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center space-x-2 mb-6">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All ({recentSMEs.length})
          </button>
          <button
            onClick={() => setFilterStatus('verified')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === 'verified' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Verified ({recentSMEs.filter((s: any) => s.verified).length})
          </button>
          <button
            onClick={() => setFilterStatus('pending')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === 'pending' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Pending ({recentSMEs.filter((s: any) => !s.verified).length})
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
              <tr className="border-b border-gray-200">
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Name</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Email</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Status</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Rating</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Join Date</th>
                <th className="text-right py-4 px-4 text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {loading.smes ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">Loading SMEs...</td>
                </tr>
              ) : recentSMEs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">No SMEs found.</td>
                </tr>
              ) : (
                recentSMEs
                  .filter((sme: any) => {
                    if (filterStatus === 'all') return true;
                    if (filterStatus === 'verified') return sme.verified;
                    if (filterStatus === 'pending') return !sme.verified;
                    return true;
                  })
                  .filter((sme: any) => {
                    if (!searchQuery) return true;
                    const query = searchQuery.toLowerCase();
                    return sme.name?.toLowerCase().includes(query) || 
                           sme.email?.toLowerCase().includes(query);
                  })
                  .map((sme) => (
                  <tr key={sme.id} className="hover:bg-blue-50 transition-colors">
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center shadow-sm">
                          <Users className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-medium text-gray-900">{sme.name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-600">{sme.email}</td>
                    <td className="py-4 px-4">
                      <Badge variant={sme.status === 'verified' ? 'success' : 'warning'} className="shadow-sm">
                        {sme.status}
                      </Badge>
                    </td>
                    <td className="py-4 px-4">
                      {sme.rating ? <span className="text-sm font-medium text-gray-900">{sme.rating}★</span> : <span className="text-gray-400">-</span>}
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-600">{sme.joinDate}</td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="shadow-sm hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors"
                          onClick={() => handleViewDetails((sme as any).id, 'SME')}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {(sme as any).status === 'pending' && (
                          <Button 
                            variant="primary" 
                            size="sm" 
                            className="shadow-sm hover:shadow-lg transition-shadow"
                            onClick={() => handleVerify((sme as any).id, 'SME')}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Verify
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderSDPs = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Manage SDPs</h2>
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search SDPs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleExport('SDPs')}
              className="hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center space-x-2 mb-6">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === 'all' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All ({recentSDPs.length})
          </button>
          <button
            onClick={() => setFilterStatus('verified')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === 'verified' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Verified ({recentSDPs.filter((s: any) => s.verified).length})
          </button>
          <button
            onClick={() => setFilterStatus('pending')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === 'pending' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Pending ({recentSDPs.filter((s: any) => !s.verified).length})
          </button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
              <tr className="border-b border-gray-200">
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Organization</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Email</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Status</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Learners</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Join Date</th>
                <th className="text-right py-4 px-4 text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {loading.sdps ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">Loading SDPs...</td>
                </tr>
              ) : recentSDPs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">No SDPs found.</td>
                </tr>
              ) : (
                recentSDPs
                  .filter((sdp: any) => {
                    if (filterStatus === 'all') return true;
                    if (filterStatus === 'verified') return sdp.verified;
                    if (filterStatus === 'pending') return !sdp.verified;
                    return true;
                  })
                  .filter((sdp: any) => {
                    if (!searchQuery) return true;
                    const query = searchQuery.toLowerCase();
                    return sdp.name?.toLowerCase().includes(query) || 
                           sdp.email?.toLowerCase().includes(query);
                  })
                  .map((sdp) => (
                  <tr key={sdp.id} className="hover:bg-green-50 transition-colors">
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center shadow-sm">
                          <Briefcase className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-medium text-gray-900">{sdp.name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-600">{sdp.email}</td>
                    <td className="py-4 px-4">
                      <Badge variant={sdp.status === 'verified' ? 'success' : 'warning'} className="shadow-sm">
                        {sdp.status}
                      </Badge>
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-600">{sdp.learners}</td>
                    <td className="py-4 px-4 text-sm text-gray-600">{sdp.joinDate}</td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleViewDetails((sdp as any).id, 'SDP')}
                          className="shadow-sm hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {(sdp as any).status === 'pending' && (
                          <Button 
                            variant="primary" 
                            size="sm"
                            onClick={() => handleVerify((sdp as any).id, 'SDP')}
                            className="shadow-sm hover:shadow-lg transition-shadow"
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Verify
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderEngagements = () => {
    // Calculate engagement stats
    const totalEngagements = recentEngagements.length;
    const inProgressCount = recentEngagements.filter((e: any) => e.status === 'In Progress').length;
    const completedCount = recentEngagements.filter((e: any) => e.status === 'Completed').length;
    const pendingCount = recentEngagements.filter((e: any) => e.status === 'Pending' || e.status === 'Accepted').length;
    const disputedCount = recentEngagements.filter((e: any) => e.status === 'Disputed' || e.disputeRaised).length;

    // Filter and sort engagements
    const filteredEngagements = recentEngagements
      .filter((e: any) => {
        if (filterStatus === 'all') return true;
        if (filterStatus === 'Pending') return e.status === 'Pending' || e.status === 'Accepted';
        return e.status === filterStatus;
      })
      .filter((e: any) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return e.projectName?.toLowerCase().includes(query) ||
               e.type?.toLowerCase().includes(query) ||
               e.smeName?.toLowerCase().includes(query) ||
               e.sdpName?.toLowerCase().includes(query) ||
               e.budget?.toLowerCase().includes(query) ||
               e.fee?.toLowerCase().includes(query);
      })
      .sort((a: any, b: any) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 
                      (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 
                      (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return dateB - dateA; // Newest first
      });

    const formatDate = (date: any) => {
      if (!date) return 'N/A';
      if (date.toDate) return date.toDate().toLocaleDateString('en-ZA', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
      if (typeof date === 'string') return new Date(date).toLocaleDateString('en-ZA', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
      return 'N/A';
    };

    return (
    <div className="space-y-6">
        {/* Engagement Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500 to-blue-600 opacity-5 rounded-full -mr-16 -mt-16 group-hover:opacity-10 transition-opacity"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Activity className="w-6 h-6 text-white" />
                </div>
                {inProgressCount > 0 && (
                  <Badge variant="info" size="sm">{inProgressCount} active</Badge>
                )}
              </div>
              <div className="text-3xl font-extrabold text-gray-900 mb-1">{totalEngagements}</div>
              <div className="text-sm font-medium text-gray-600">Total Engagements</div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-500 to-green-600 opacity-5 rounded-full -mr-16 -mt-16 group-hover:opacity-10 transition-opacity"></div>
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <div className="text-3xl font-extrabold text-gray-900 mb-1">{completedCount}</div>
              <div className="text-sm font-medium text-gray-600">Completed</div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500 to-purple-600 opacity-5 rounded-full -mr-16 -mt-16 group-hover:opacity-10 transition-opacity"></div>
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div className="text-3xl font-extrabold text-gray-900 mb-1">{inProgressCount}</div>
              <div className="text-sm font-medium text-gray-600">In Progress</div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-yellow-500 to-yellow-600 opacity-5 rounded-full -mr-16 -mt-16 group-hover:opacity-10 transition-opacity"></div>
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <div className="text-3xl font-extrabold text-gray-900 mb-1">{pendingCount}</div>
              <div className="text-sm font-medium text-gray-600">Pending</div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-red-500 to-red-600 opacity-5 rounded-full -mr-16 -mt-16 group-hover:opacity-10 transition-opacity"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                  <AlertTriangle className="w-6 h-6 text-white" />
                </div>
                {disputedCount > 0 && (
                  <Badge variant="danger" size="sm">{disputedCount} disputes</Badge>
                )}
              </div>
              <div className="text-3xl font-extrabold text-gray-900 mb-1">{disputedCount}</div>
              <div className="text-sm font-medium text-gray-600">Disputed</div>
            </div>
          </div>
        </div>

        {/* Engagements List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
            <div>
          <h2 className="text-xl font-bold text-gray-900">All Engagements</h2>
              <p className="text-sm text-gray-600 mt-1">View and manage all project engagements</p>
            </div>
          <div className="flex items-center space-x-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by project, SME, SDP..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
                />
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleExport('Engagements')}
                className="hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors"
              >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

          {/* Filter Tabs */}
          <div className="flex items-center space-x-2 mb-6 pb-4 border-b border-gray-200">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                filterStatus === 'all' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All ({totalEngagements})
            </button>
            <button
              onClick={() => setFilterStatus('In Progress')}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                filterStatus === 'In Progress' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              In Progress ({inProgressCount})
            </button>
            <button
              onClick={() => setFilterStatus('Completed')}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                filterStatus === 'Completed' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Completed ({completedCount})
            </button>
            <button
              onClick={() => setFilterStatus('Pending')}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                filterStatus === 'Pending' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Pending ({pendingCount})
            </button>
            {disputedCount > 0 && (
              <button
                onClick={() => setFilterStatus('Disputed')}
                className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  filterStatus === 'Disputed' 
                    ? 'bg-red-600 text-white shadow-md' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Disputed ({disputedCount})
              </button>
            )}
          </div>

          {/* Engagements List */}
        <div className="space-y-4">
          {loading.engagements ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-gray-500">Loading engagements...</p>
                  </div>
            ) : filteredEngagements.length === 0 ? (
              <div className="text-center py-12">
                <Activity className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 font-medium">No engagements found</p>
                <p className="text-sm text-gray-500 mt-1">
                  {searchQuery ? 'Try adjusting your search criteria' : 'Engagements will appear here once created'}
                </p>
                  </div>
            ) : (
              filteredEngagements.map((engagement: any) => {
                const createdDate = engagement.createdAt?.toDate ? engagement.createdAt.toDate() : 
                                   (engagement.createdAt ? new Date(engagement.createdAt) : new Date());
                const isDisputed = engagement.status === 'Disputed' || engagement.disputeRaised;
                
                // Try to get SME and SDP names from recent users if not in engagement
                let smeName = engagement.smeName;
                let sdpName = engagement.sdpName;
                
                if (!smeName && engagement.smeId) {
                  const sme = recentSMEs.find((s: any) => s.id === engagement.smeId);
                  smeName = sme?.name || sme?.profile?.name || 'N/A';
                }
                
                if (!sdpName && engagement.sdpId) {
                  const sdp = recentSDPs.find((s: any) => s.id === engagement.sdpId);
                  sdpName = sdp?.name || sdp?.profile?.name || 'N/A';
                }
                
                const statusColors = {
                  'Completed': 'success',
                  'In Progress': 'info',
                  'Pending': 'warning',
                  'Accepted': 'info',
                  'Rejected': 'danger',
                  'Disputed': 'danger'
                } as const;
                
                return (
                  <div 
                    key={engagement.id} 
                    className={`group relative p-6 rounded-xl hover:shadow-lg transition-all duration-300 border ${
                      isDisputed 
                        ? 'bg-gradient-to-br from-red-50 via-white to-red-50/30 border-red-300 shadow-red-100/50' 
                        : engagement.status === 'Completed'
                        ? 'bg-gradient-to-br from-green-50 via-white to-green-50/30 border-green-300 shadow-green-100/50'
                        : engagement.status === 'In Progress'
                        ? 'bg-gradient-to-br from-blue-50 via-white to-blue-50/30 border-blue-300 shadow-blue-100/50'
                        : 'bg-gradient-to-br from-gray-50 via-white to-gray-50/30 border-gray-300 shadow-gray-100/50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4 flex-1">
                        <div className={`w-16 h-16 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform ${
                          isDisputed
                            ? 'bg-gradient-to-br from-red-500 to-red-600'
                            : engagement.status === 'Completed' 
                            ? 'bg-gradient-to-br from-green-500 to-green-600' 
                            : engagement.status === 'In Progress'
                            ? 'bg-gradient-to-br from-blue-500 to-blue-600'
                            : 'bg-gradient-to-br from-yellow-500 to-yellow-600'
                        }`}>
                          {isDisputed ? (
                            <AlertTriangle className="w-8 h-8 text-white" />
                          ) : engagement.status === 'Completed' ? (
                            <CheckCircle className="w-8 h-8 text-white" />
                          ) : (
                            <Activity className="w-8 h-8 text-white" />
                          )}
                </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center flex-wrap gap-2 mb-3">
                            <h3 className="font-bold text-lg text-gray-900 truncate">
                              {engagement.projectName || engagement.type || 'Engagement'}
                            </h3>
                    <Badge 
                              variant={statusColors[engagement.status as keyof typeof statusColors] || 'warning'}
                      size="sm"
                              className="font-medium shrink-0"
                    >
                      {engagement.status}
                    </Badge>
                            {isDisputed && (
                              <Badge variant="danger" size="sm" className="shrink-0">
                                Disputed
                              </Badge>
                            )}
                            {engagement.paymentConfirmedByAdmin && (
                              <Badge variant="success" size="sm" className="shrink-0">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Payment Confirmed
                              </Badge>
                            )}
                  </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                            <div className="flex items-center space-x-2">
                              <Users className="w-4 h-4 text-gray-400 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs text-gray-500 font-medium">SME</p>
                                <p className="text-sm font-semibold text-gray-900 truncate">{smeName}</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Briefcase className="w-4 h-4 text-gray-400 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs text-gray-500 font-medium">SDP</p>
                                <p className="text-sm font-semibold text-gray-900 truncate">{sdpName}</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <DollarSign className="w-4 h-4 text-gray-400 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs text-gray-500 font-medium">Budget</p>
                                <p className="text-sm font-bold text-gray-900">{engagement.budget || engagement.fee || 'TBD'}</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs text-gray-500 font-medium">Created</p>
                                <p className="text-sm font-medium text-gray-700">{formatDate(engagement.createdAt)}</p>
                              </div>
                            </div>
                          </div>
                          {engagement.completedAt && (
                            <div className="flex items-center space-x-2 text-xs text-gray-500 pt-2 border-t border-gray-200">
                              <CheckCircle className="w-3 h-3 text-green-500" />
                              <span>Completed: {formatDate(engagement.completedAt)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 ml-4 shrink-0">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setSelectedEngagementForComment(engagement);
                            setShowCommentModal(true);
                          }}
                          className="hover:bg-purple-50 hover:border-purple-300 hover:text-purple-600 transition-colors shadow-sm"
                        >
                          <MessageSquare className="w-4 h-4 mr-2" />
                          Comment
                        </Button>
                      </div>
              </div>
                  </div>
                );
              })
          )}
        </div>
      </div>
    </div>
  );
  };

  const renderVerifications = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Pending Verifications ({systemStats.pendingVerifications})</h2>
          <Badge variant="warning" size="sm">
            Requires Action
          </Badge>
        </div>

        <div className="space-y-4">
          {loading.applications ? (
            <p className="text-center py-8 text-gray-500">Loading applications...</p>
          ) : allApplications.length === 0 ? (
            <p className="text-center py-8 text-gray-500">No pending verifications found.</p>
          ) : (
            allApplications.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    item.type === 'SME' ? 'bg-blue-100' : 'bg-green-100'
                  }`}>
                    {item.type === 'SME' ? <Users className="w-6 h-6 text-blue-600" /> : <Briefcase className="w-6 h-6 text-green-600" />}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{item.name}</p>
                    <p className="text-sm text-gray-500">{item.type} • Submitted {item.submitted}</p>
                    <p className="text-xs text-gray-400">{item.documents} documents</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleViewDetails((item as any).id, 'application')}
                    className="hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Review
                  </Button>
                  <Button 
                    variant="primary" 
                    size="sm"
                    onClick={() => handleApprove((item as any).id, 'Application')}
                    className="hover:shadow-lg transition-shadow"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approve
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleReject((item as any).id, 'Application')}
                    className="hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-colors"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  const renderApplications = () => {
    // Combine unverified users, rejected users, and applications collection
    const unverifiedSMEs = recentSMEs.filter((sme: any) => !sme.verified && !sme.rejected).map((sme: any) => ({
      id: sme.id,
      applicant: sme.name || sme.profile?.name || 'Unknown',
      applicantEmail: sme.email || sme.profile?.email || '',
      type: 'SME',
      appType: 'registration',
      status: 'pending',
      submitted: sme.createdAt?.toDate ? sme.createdAt.toDate().toLocaleDateString() : 
                (sme.joinDate || 'N/A'),
      documents: '0', // Will be calculated if needed
      fee: 'R0',
      createdAt: sme.createdAt,
      profile: sme.profile,
      location: sme.profile?.location || sme.location || 'N/A',
      specializations: sme.profile?.specializations || [],
      ...sme
    }));

    const unverifiedSDPs = recentSDPs.filter((sdp: any) => !sdp.verified && !sdp.rejected).map((sdp: any) => ({
      id: sdp.id,
      applicant: sdp.name || sdp.profile?.name || 'Unknown',
      applicantEmail: sdp.email || sdp.profile?.email || '',
      type: 'SDP',
      appType: 'registration',
      status: 'pending',
      submitted: sdp.createdAt?.toDate ? sdp.createdAt.toDate().toLocaleDateString() : 
                (sdp.joinDate || 'N/A'),
      documents: '0',
      fee: 'R0',
      createdAt: sdp.createdAt,
      profile: sdp.profile,
      location: sdp.profile?.location || sdp.location || 'N/A',
      ...sdp
    }));

    // Include rejected users
    const rejectedSMEs = recentSMEs.filter((sme: any) => sme.rejected).map((sme: any) => ({
      id: sme.id,
      applicant: sme.name || sme.profile?.name || 'Unknown',
      applicantEmail: sme.email || sme.profile?.email || '',
      type: 'SME',
      appType: 'registration',
      status: 'rejected',
      submitted: sme.createdAt?.toDate ? sme.createdAt.toDate().toLocaleDateString() : 
                (sme.joinDate || 'N/A'),
      documents: '0',
      fee: 'R0',
      createdAt: sme.createdAt,
      profile: sme.profile,
      location: sme.profile?.location || sme.location || 'N/A',
      specializations: sme.profile?.specializations || [],
      rejected: true,
      rejectedAt: sme.rejectedAt,
      rejectionReason: sme.rejectionReason,
      ...sme
    }));

    const rejectedSDPs = recentSDPs.filter((sdp: any) => sdp.rejected).map((sdp: any) => ({
      id: sdp.id,
      applicant: sdp.name || sdp.profile?.name || 'Unknown',
      applicantEmail: sdp.email || sdp.profile?.email || '',
      type: 'SDP',
      appType: 'registration',
      status: 'rejected',
      submitted: sdp.createdAt?.toDate ? sdp.createdAt.toDate().toLocaleDateString() : 
                (sdp.joinDate || 'N/A'),
      documents: '0',
      fee: 'R0',
      createdAt: sdp.createdAt,
      profile: sdp.profile,
      location: sdp.profile?.location || sdp.location || 'N/A',
      rejected: true,
      rejectedAt: sdp.rejectedAt,
      rejectionReason: sdp.rejectionReason,
      ...sdp
    }));

    // Verified applications
    const verifiedSMEs = recentSMEs.filter((sme: any) => sme.verified && !sme.rejected).map((sme: any) => ({
      id: sme.id,
      applicant: sme.name || sme.profile?.name || 'Unknown',
      applicantEmail: sme.email || sme.profile?.email || '',
      type: 'SME',
      appType: 'registration',
      status: 'verified',
      verified: true,
      rejected: false,
      submitted: sme.createdAt?.toDate ? sme.createdAt.toDate().toLocaleDateString() : 
                (sme.joinDate || 'N/A'),
      documents: '0',
      fee: 'R0',
      createdAt: sme.createdAt,
      profile: sme.profile,
      location: sme.profile?.location || sme.location || 'N/A',
      verifiedAt: sme.verifiedAt,
      verifiedBy: sme.verifiedBy,
      verifiedByName: sme.verifiedByName,
      ...sme
    }));

    const verifiedSDPs = recentSDPs.filter((sdp: any) => sdp.verified && !sdp.rejected).map((sdp: any) => ({
      id: sdp.id,
      applicant: sdp.name || sdp.profile?.name || 'Unknown',
      applicantEmail: sdp.email || sdp.profile?.email || '',
      type: 'SDP',
      appType: 'registration',
      status: 'verified',
      verified: true,
      rejected: false,
      submitted: sdp.createdAt?.toDate ? sdp.createdAt.toDate().toLocaleDateString() : 
                (sdp.joinDate || 'N/A'),
      documents: '0',
      fee: 'R0',
      createdAt: sdp.createdAt,
      profile: sdp.profile,
      location: sdp.profile?.location || sdp.location || 'N/A',
      verifiedAt: sdp.verifiedAt,
      verifiedBy: sdp.verifiedBy,
      verifiedByName: sdp.verifiedByName,
      ...sdp
    }));

    const combinedApplications = [...unverifiedSMEs, ...unverifiedSDPs, ...verifiedSMEs, ...verifiedSDPs, ...rejectedSMEs, ...rejectedSDPs, ...allApplications];
    
    // Calculate stats - ensure rejected applications are properly categorized
    const totalApplications = combinedApplications.length;
    // Pending: applications that are not verified AND not rejected
    const pendingCount = combinedApplications.filter(app => {
      const isPending = app.status === 'pending' || (!app.verified && !app.rejected);
      const isNotRejected = !app.rejected && app.status !== 'rejected';
      return isPending && isNotRejected;
    }).length;
    // Rejected: applications that are explicitly rejected
    const rejectedCount = combinedApplications.filter(app => {
      return app.rejected === true || app.status === 'rejected';
    }).length;
    // Verified: applications that are verified
    const verifiedCount = combinedApplications.filter(app => {
      return app.verified === true && !app.rejected;
    }).length;
    // SME and SDP counts include all (pending, verified, and rejected)
    const smeApplications = combinedApplications.filter(app => app.type === 'SME').length;
    const sdpApplications = combinedApplications.filter(app => app.type === 'SDP').length;

    // Filter applications
    const filteredApplications = combinedApplications
      .filter(app => {
        if (filterStatus === 'all') return true;
        if (filterStatus === 'rejected') return app.rejected || app.status === 'rejected';
        if (filterStatus === 'verified') return app.verified === true && !app.rejected;
        if (filterStatus === 'pending') return !app.verified && !app.rejected;
        return app.type === filterStatus;
      })
      .filter(app => {
        const searchLower = searchQuery.toLowerCase();
        return (app.applicant?.toLowerCase().includes(searchLower) || 
                app.applicantEmail?.toLowerCase().includes(searchLower) ||
                app.email?.toLowerCase().includes(searchLower) ||
                app.profile?.name?.toLowerCase().includes(searchLower));
      })
      .sort((a, b) => {
        // Sort by creation date, newest first
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 
                     (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 
                     (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return dateB - dateA;
      });

    const formatDate = (date: any) => {
      if (!date) return 'N/A';
      if (date.toDate) return date.toDate().toLocaleDateString('en-ZA', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
      if (typeof date === 'string') return new Date(date).toLocaleDateString('en-ZA', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
      return 'N/A';
    };

    return (
    <div className="space-y-6">
      {/* Application Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500 to-blue-600 opacity-5 rounded-full -mr-16 -mt-16 group-hover:opacity-10 transition-opacity"></div>
            <div className="relative">
          <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                  <FileText className="w-6 h-6 text-white" />
            </div>
                {pendingCount > 0 && (
                  <Badge variant="warning" size="sm">{pendingCount} pending</Badge>
                )}
          </div>
              <div className="text-3xl font-extrabold text-gray-900 mb-1">{totalApplications}</div>
              <div className="text-sm font-medium text-gray-600">Total Applications</div>
        </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-500 to-green-600 opacity-5 rounded-full -mr-16 -mt-16 group-hover:opacity-10 transition-opacity"></div>
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                <Users className="w-6 h-6 text-white" />
        </div>
              <div className="text-3xl font-extrabold text-gray-900 mb-1">{smeApplications}</div>
              <div className="text-sm font-medium text-gray-600">SME Applications</div>
          </div>
        </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500 to-purple-600 opacity-5 rounded-full -mr-16 -mt-16 group-hover:opacity-10 transition-opacity"></div>
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                <Briefcase className="w-6 h-6 text-white" />
          </div>
              <div className="text-3xl font-extrabold text-gray-900 mb-1">{sdpApplications}</div>
              <div className="text-sm font-medium text-gray-600">SDP Applications</div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-yellow-500 to-yellow-600 opacity-5 rounded-full -mr-16 -mt-16 group-hover:opacity-10 transition-opacity"></div>
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <div className="text-3xl font-extrabold text-gray-900 mb-1">{pendingCount}</div>
              <div className="text-sm font-medium text-gray-600">Pending Review</div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-500 to-green-600 opacity-5 rounded-full -mr-16 -mt-16 group-hover:opacity-10 transition-opacity"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                {verifiedCount > 0 && (
                  <Badge variant="success" size="sm">{verifiedCount} verified</Badge>
                )}
              </div>
              <div className="text-3xl font-extrabold text-gray-900 mb-1">{verifiedCount}</div>
              <div className="text-sm font-medium text-gray-600">Verified Applications</div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-red-500 to-red-600 opacity-5 rounded-full -mr-16 -mt-16 group-hover:opacity-10 transition-opacity"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                  <XCircle className="w-6 h-6 text-white" />
                </div>
                {rejectedCount > 0 && (
                  <Badge variant="danger" size="sm">{rejectedCount} rejected</Badge>
                )}
              </div>
              <div className="text-3xl font-extrabold text-gray-900 mb-1">{rejectedCount}</div>
              <div className="text-sm font-medium text-gray-600">Rejected Applications</div>
            </div>
        </div>
      </div>

      {/* Application Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
            <div>
          <h2 className="text-xl font-bold text-gray-900">All Applications</h2>
              <p className="text-sm text-gray-600 mt-1">Review and verify new user registrations</p>
            </div>
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                  placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
              />
            </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleExport('Applications')}
                className="hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors"
              >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Filter Tabs */}
          <div className="flex items-center space-x-2 mb-6 pb-4 border-b border-gray-200">
          <button
            onClick={() => setFilterStatus('all')}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                filterStatus === 'all' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
              All ({totalApplications})
          </button>
          <button
            onClick={() => setFilterStatus('SME')}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                filterStatus === 'SME' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
              SME ({smeApplications})
          </button>
          <button
            onClick={() => setFilterStatus('SDP')}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                filterStatus === 'SDP' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
              SDP ({sdpApplications})
            </button>
            <button
              onClick={() => setFilterStatus('verified')}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                filterStatus === 'verified' 
                  ? 'bg-green-600 text-white shadow-md' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Verified ({verifiedCount})
            </button>
            <button
              onClick={() => setFilterStatus('pending')}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                filterStatus === 'pending' 
                  ? 'bg-yellow-600 text-white shadow-md' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Pending ({pendingCount})
            </button>
            <button
              onClick={() => setFilterStatus('rejected')}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                filterStatus === 'rejected' 
                  ? 'bg-red-600 text-white shadow-md' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Rejected ({rejectedCount})
          </button>
        </div>

        {/* Applications List */}
        <div className="space-y-4">
            {loading.applications || loading.smes || loading.sdps ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-gray-500">Loading applications...</p>
              </div>
            ) : filteredApplications.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 font-medium">No applications found</p>
                <p className="text-sm text-gray-500 mt-1">
                  {searchQuery ? 'Try adjusting your search criteria' : 'All applications have been processed'}
                </p>
              </div>
            ) : (
              filteredApplications.map((application: any) => {
                const isRejected = application.rejected || application.status === 'rejected';
                const isVerified = application.verified === true && !isRejected;
                const status = isRejected ? 'rejected' : (isVerified ? 'verified' : 'pending');
                return (
                <div 
                  key={application.id} 
                  className={`p-6 rounded-xl hover:shadow-md transition-all duration-200 ${
                    isRejected 
                      ? 'bg-gradient-to-r from-red-50 to-white border-2 border-red-200' 
                      : isVerified
                        ? 'bg-gradient-to-r from-green-50 to-white border-2 border-green-200'
                        : 'bg-gradient-to-r from-gray-50 to-white border border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      <div className={`w-16 h-16 rounded-xl flex items-center justify-center shadow-md ${
                        isRejected
                          ? 'bg-gradient-to-br from-red-500 to-red-600'
                          : isVerified
                            ? 'bg-gradient-to-br from-green-500 to-green-600'
                            : application.type === 'SME' 
                              ? 'bg-gradient-to-br from-blue-500 to-blue-600' 
                              : 'bg-gradient-to-br from-green-500 to-green-600'
                  }`}>
                        {isRejected ? (
                          <XCircle className="w-8 h-8 text-white" />
                        ) : application.type === 'SME' ? (
                          <Users className="w-8 h-8 text-white" />
                    ) : (
                          <Briefcase className="w-8 h-8 text-white" />
                    )}
                  </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-bold text-lg text-gray-900">
                            {application.applicant || application.name || 'Unknown User'}
                          </h3>
                          <Badge 
                            variant={application.type === 'SME' ? 'info' : 'default'}
                            size="sm"
                            className="font-medium"
                          >
                        {application.type}
                      </Badge>
                          {isRejected ? (
                            <Badge variant="danger" size="sm">
                              Rejected
                            </Badge>
                          ) : isVerified ? (
                            <Badge variant="success" size="sm">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Verified
                            </Badge>
                          ) : (
                            <Badge variant="warning" size="sm">
                              Pending Verification
                            </Badge>
                          )}
                    </div>
                        {isRejected && application.rejectionReason && (
                          <div className="mb-3 p-3 bg-red-50 border-l-4 border-red-600 rounded-lg">
                            <p className="text-xs font-semibold text-red-700 mb-1">Rejection Reason:</p>
                            <p className="text-sm text-red-800">{application.rejectionReason}</p>
                            {application.rejectedAt && (
                              <p className="text-xs text-red-600 mt-1">
                                Rejected on: {application.rejectedAt?.toDate 
                                  ? application.rejectedAt.toDate().toLocaleDateString('en-ZA', { 
                                      year: 'numeric', 
                                      month: 'short', 
                                      day: 'numeric' 
                                    })
                                  : 'N/A'}
                              </p>
                            )}
                    </div>
                        )}
                        <div className="bg-gray-50 rounded-lg p-4 mb-3">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="flex flex-col">
                              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Email</span>
                              <span className="text-gray-900 font-medium break-words">{application.applicantEmail || application.email || 'N/A'}</span>
                            </div>
                            {application.location && application.location !== 'N/A' ? (
                              <div className="flex flex-col">
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Location</span>
                                <span className="text-gray-900 font-medium">{application.location}</span>
                              </div>
                            ) : (
                              <div className="flex flex-col">
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Submitted</span>
                                <span className="text-gray-900 font-medium">{formatDate(application.createdAt || application.submitted)}</span>
                              </div>
                          )}
                          {application.specializations && application.specializations.length > 0 && (
                              <div className="flex flex-col col-span-2">
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Specializations</span>
                                <div className="flex flex-wrap gap-1.5">
                                {application.specializations.slice(0, 3).map((spec: string, idx: number) => (
                                    <Badge key={idx} variant="outline" size="sm" className="text-xs bg-white border-gray-300">
                                    {spec}
                                  </Badge>
                                ))}
                                {application.specializations.length > 3 && (
                                    <span className="text-gray-500 text-xs self-center">+{application.specializations.length - 3} more</span>
                                )}
                                </div>
                              </div>
                          )}
                            {application.location && application.location !== 'N/A' && (
                              <div className="flex flex-col">
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Submitted</span>
                                <span className="text-gray-900 font-medium">{formatDate(application.createdAt || application.submitted)}</span>
                              </div>
                            )}
                          </div>
                  </div>
                </div>
                  </div>
                    <div className="flex items-center space-x-2 ml-6">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleViewDetails(application.id, 'application')}
                        className="hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors"
                      >
                    <Eye className="w-4 h-4 mr-2" />
                    View
                  </Button>
                      {isRejected ? (
                        <>
                          <Button 
                            variant="primary" 
                            size="sm"
                            onClick={() => {
                              if (confirm(`Are you sure you want to approve this previously rejected ${application.type} application?`)) {
                                handleVerify(application.id, application.type);
                              }
                            }}
                            className="bg-green-600 hover:bg-green-700 hover:shadow-lg transition-all"
                          >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approve
                  </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleReject(application.id, application.type)}
                            className="hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-colors"
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Reject Again
                          </Button>
                        </>
                      ) : isVerified ? (
                        <>
                          <Badge variant="success" size="sm" className="font-medium">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Verified
                          </Badge>
                          {application.verifiedAt && (
                            <p className="text-xs text-gray-500 mt-1">
                              Verified on: {application.verifiedAt?.toDate 
                                ? application.verifiedAt.toDate().toLocaleDateString('en-ZA', { 
                                    year: 'numeric', 
                                    month: 'short', 
                                    day: 'numeric' 
                                  })
                                : 'N/A'}
                            </p>
                          )}
                          {application.verifiedByName && (
                            <p className="text-xs text-gray-500">
                              By: {application.verifiedByName}
                            </p>
                          )}
                        </>
                      ) : (
                        <>
                          <Button 
                            variant="primary" 
                            size="sm"
                            onClick={() => handleVerify(application.id, application.type)}
                            className="bg-green-600 hover:bg-green-700 hover:shadow-lg transition-all"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Approve
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleReject(application.id, application.type)}
                            className="hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-colors"
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Reject
                          </Button>
                        </>
                      )}
                </div>
              </div>
            </div>
              )})
            )}
        </div>
      </div>
    </div>
  );
  };

  const renderEscrow = () => {
    // Calculate escrow stats from engagements
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Held in escrow: engagements with fundsReleasedAt but not yet confirmed by admin
    const heldInEscrow = recentEngagements.filter((e: any) => 
      e.fundsReleasedAt && !e.paymentConfirmedByAdmin
    );
    
    // In dispute: engagements with Disputed status
    const inDispute = recentEngagements.filter((e: any) => 
      e.status === 'Disputed' || e.disputeRaised
    );
    
    // Released this month: engagements confirmed by admin this month
    const releasedThisMonth = recentEngagements.filter((e: any) => {
      if (!e.paymentConfirmedByAdmin || !e.paymentConfirmedAt) return false;
      const confirmedDate = e.paymentConfirmedAt?.toDate ? e.paymentConfirmedAt.toDate() : 
                           (e.paymentConfirmedAt ? new Date(e.paymentConfirmedAt) : null);
      return confirmedDate && confirmedDate >= startOfMonth;
    });
    
    // Total released: all engagements confirmed by admin
    const totalReleased = recentEngagements.filter((e: any) => 
      e.paymentConfirmedByAdmin
    );
    
    // Calculate amounts
    const heldAmount = heldInEscrow.reduce((sum: number, e: any) => {
      const amount = parseFloat((e.budget || e.fee || '0').replace(/[^0-9.]/g, '')) || 0;
      return sum + amount;
    }, 0);
    
    const releasedThisMonthAmount = releasedThisMonth.reduce((sum: number, e: any) => {
      const amount = parseFloat((e.budget || e.fee || '0').replace(/[^0-9.]/g, '')) || 0;
      return sum + amount;
    }, 0);
    
    const totalReleasedAmount = totalReleased.reduce((sum: number, e: any) => {
      const amount = parseFloat((e.budget || e.fee || '0').replace(/[^0-9.]/g, '')) || 0;
      return sum + amount;
    }, 0);
    
    // Filter escrow transactions (held + disputed)
    const escrowItems = recentEngagements.filter((e: any) => 
      (e.fundsReleasedAt && !e.paymentConfirmedByAdmin) || 
      (e.status === 'Disputed' || e.disputeRaised)
    );
    
    // Apply search and filter
    const filteredEscrow = escrowItems
      .filter((e: any) => {
        if (filterStatus === 'all') return true;
        if (filterStatus === 'held') return e.fundsReleasedAt && !e.paymentConfirmedByAdmin;
        if (filterStatus === 'disputed') return e.status === 'Disputed' || e.disputeRaised;
        return true;
      })
      .filter((e: any) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (e.projectName?.toLowerCase().includes(query) ||
                e.type?.toLowerCase().includes(query) ||
                e.smeName?.toLowerCase().includes(query) ||
                e.sdpName?.toLowerCase().includes(query) ||
                e.budget?.toLowerCase().includes(query) ||
                e.fee?.toLowerCase().includes(query));
      })
      .sort((a: any, b: any) => {
        // Sort by fundsReleasedAt or disputedAt, newest first
        const dateA = a.fundsReleasedAt?.toDate ? a.fundsReleasedAt.toDate().getTime() : 
                     (a.disputedAt?.toDate ? a.disputedAt.toDate().getTime() : 
                      (a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0));
        const dateB = b.fundsReleasedAt?.toDate ? b.fundsReleasedAt.toDate().getTime() : 
                     (b.disputedAt?.toDate ? b.disputedAt.toDate().getTime() : 
                      (b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0));
        return dateB - dateA;
      });
    
    const formatDate = (date: any) => {
      if (!date) return 'N/A';
      if (date.toDate) return date.toDate().toLocaleDateString('en-ZA', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      if (typeof date === 'string') return new Date(date).toLocaleDateString('en-ZA', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      return 'N/A';
    };
    
    return (
    <div className="space-y-6">
      {/* Escrow Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-yellow-500 to-yellow-600 opacity-5 rounded-full -mr-16 -mt-16 group-hover:opacity-10 transition-opacity"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl flex items-center justify-center shadow-lg">
                <Lock className="w-6 h-6 text-white" />
              </div>
              {heldInEscrow.length > 0 && (
                <Badge variant="warning" size="sm">{heldInEscrow.length} held</Badge>
              )}
            </div>
            <div className="text-3xl font-extrabold text-gray-900 mb-1">
              R{heldAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-sm font-medium text-gray-600">Amount Held in Escrow</div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-red-500 to-red-600 opacity-5 rounded-full -mr-16 -mt-16 group-hover:opacity-10 transition-opacity"></div>
          <div className="relative">
            <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div className="text-3xl font-extrabold text-gray-900 mb-1">
              {inDispute.length}
            </div>
            <div className="text-sm font-medium text-gray-600">In Dispute</div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-500 to-green-600 opacity-5 rounded-full -mr-16 -mt-16 group-hover:opacity-10 transition-opacity"></div>
          <div className="relative">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
              <Unlock className="w-6 h-6 text-white" />
            </div>
            <div className="text-3xl font-extrabold text-gray-900 mb-1">
              {releasedThisMonth.length}
            </div>
            <div className="text-sm font-medium text-gray-600">Released This Month</div>
            <div className="text-xs text-gray-500 mt-1">
              R{releasedThisMonthAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500 to-blue-600 opacity-5 rounded-full -mr-16 -mt-16 group-hover:opacity-10 transition-opacity"></div>
          <div className="relative">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
              <CreditCard className="w-6 h-6 text-white" />
            </div>
            <div className="text-3xl font-extrabold text-gray-900 mb-1">
              R{totalReleasedAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-sm font-medium text-gray-600">Total Released</div>
            <div className="text-xs text-gray-500 mt-1">
              {totalReleased.length} transactions
            </div>
          </div>
        </div>
      </div>

      {/* Escrow Transactions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Escrow Transactions</h2>
              <p className="text-sm text-gray-600 mt-1">Monitor and manage held payments between SMEs and SDPs</p>
            </div>
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by project, SME, SDP..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent w-64"
                />
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleExport('Escrow')}
                className="hover:bg-yellow-50 hover:border-yellow-300 hover:text-yellow-600 transition-colors"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center space-x-2 pb-4 border-b border-gray-200">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                filterStatus === 'all' 
                  ? 'bg-yellow-600 text-white shadow-md' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All ({escrowItems.length})
            </button>
            <button
              onClick={() => setFilterStatus('held')}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                filterStatus === 'held' 
                  ? 'bg-yellow-600 text-white shadow-md' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Held ({heldInEscrow.length})
            </button>
            <button
              onClick={() => setFilterStatus('disputed')}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                filterStatus === 'disputed' 
                  ? 'bg-red-600 text-white shadow-md' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Disputed ({inDispute.length})
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="space-y-4">
            {loading.engagements ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600 mb-4"></div>
                <p className="text-gray-500">Loading escrow transactions...</p>
              </div>
            ) : filteredEscrow.length === 0 ? (
              <div className="text-center py-12">
                <Lock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 font-medium">No escrow transactions found</p>
                <p className="text-sm text-gray-500 mt-1">
                  {searchQuery ? 'Try adjusting your search criteria' : 'All funds have been released or confirmed'}
                </p>
              </div>
            ) : (
              filteredEscrow.map((engagement: any) => {
                const isDisputed = engagement.status === 'Disputed' || engagement.disputeRaised;
                const isHeld = engagement.fundsReleasedAt && !engagement.paymentConfirmedByAdmin;
                
                // Get SME and SDP names
                let smeName = engagement.smeName;
                if (!smeName && engagement.smeId) {
                  const sme = recentSMEs.find((s: any) => s.id === engagement.smeId);
                  smeName = sme?.name || sme?.profile?.name || 'N/A';
                }
                
                let sdpName = engagement.sdpName;
                if (!sdpName && engagement.sdpId) {
                  const sdp = recentSDPs.find((s: any) => s.id === engagement.sdpId);
                  sdpName = sdp?.name || sdp?.profile?.name || 'N/A';
                }
                
                return (
                  <div 
                    key={engagement.id}
                    className={`p-6 rounded-xl hover:shadow-lg transition-all duration-200 border-2 ${
                      isDisputed 
                        ? 'bg-gradient-to-r from-red-50 to-white border-red-200' 
                        : 'bg-gradient-to-r from-yellow-50 to-white border-yellow-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4 flex-1">
                        <div className={`w-16 h-16 rounded-xl flex items-center justify-center shadow-md ${
                          isDisputed 
                            ? 'bg-gradient-to-br from-red-500 to-red-600' 
                            : 'bg-gradient-to-br from-yellow-500 to-yellow-600'
                        }`}>
                          {isDisputed ? (
                            <AlertTriangle className="w-8 h-8 text-white" />
                          ) : (
                            <Lock className="w-8 h-8 text-white" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-3">
                            <h3 className="font-bold text-lg text-gray-900">
                              {engagement.projectName || engagement.type || 'Project'}
                            </h3>
                            {isDisputed ? (
                              <Badge variant="danger" size="sm" className="font-medium">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                In Dispute
                              </Badge>
                            ) : (
                              <Badge variant="warning" size="sm" className="font-medium">
                                <Lock className="w-3 h-3 mr-1" />
                                Held in Escrow
                              </Badge>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                              <p className="text-xs font-semibold text-blue-700 mb-1">SDP (Client)</p>
                              <p className="font-semibold text-gray-900">{sdpName || 'N/A'}</p>
                            </div>
                            <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                              <p className="text-xs font-semibold text-green-700 mb-1">SME (Provider)</p>
                              <p className="font-semibold text-gray-900">{smeName || 'N/A'}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-4">
                            <div className="bg-gray-50 rounded-lg p-3">
                              <p className="text-xs text-gray-500 mb-1">Amount</p>
                              <p className="font-bold text-gray-900 text-lg">
                                {engagement.budget || engagement.fee || 'TBD'}
                              </p>
                            </div>
                            {engagement.fundsReleasedAt && (
                              <div className="bg-gray-50 rounded-lg p-3">
                                <p className="text-xs text-gray-500 mb-1">Funds Released</p>
                                <p className="font-medium text-gray-900">
                                  {formatDate(engagement.fundsReleasedAt)}
                                </p>
                              </div>
                            )}
                            {isDisputed && engagement.disputedAt && (
                              <div className="bg-gray-50 rounded-lg p-3">
                                <p className="text-xs text-gray-500 mb-1">Disputed On</p>
                                <p className="font-medium text-red-600">
                                  {formatDate(engagement.disputedAt)}
                                </p>
                              </div>
                            )}
                          </div>

                          {isDisputed && engagement.disputeReason && (
                            <div className="bg-red-50 border-l-4 border-red-600 rounded-lg p-4 mb-4">
                              <p className="text-sm font-semibold text-red-900 mb-1">Dispute Reason</p>
                              <p className="text-sm text-red-800">{engagement.disputeReason}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 ml-6">
                        {isHeld && (
                          <Button 
                            variant="primary" 
                            size="sm"
                            onClick={() => {
                              setSelectedPayment(engagement);
                              setShowPaymentModal(true);
                            }}
                            className="bg-green-600 hover:bg-green-700 hover:shadow-lg transition-all"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Confirm Payment
                          </Button>
                        )}
                        {isDisputed && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedDispute(engagement);
                              setShowDisputeModal(true);
                            }}
                            className="hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-colors"
                          >
                            <Gavel className="w-4 h-4 mr-2" />
                            Resolve Dispute
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
    );
  };

  const renderDocuments = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Registration Uploads</h2>
          <p className="text-sm text-gray-600 mt-1">
            Browse every SME/SDP and inspect the documents they provided during onboarding.
          </p>
        </div>
        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={documentSearch}
                onChange={(e) => setDocumentSearch(e.target.value)}
                placeholder="Search by name, email, or company..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="border border-gray-100 rounded-2xl bg-gray-50 max-h-[520px] overflow-y-auto divide-y divide-gray-100">
              {filteredDocumentUsers.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-500">
                  No users match "{documentSearch}".
                </div>
              ) : (
                filteredDocumentUsers.map((user: any) => {
                  const isActive = selectedDocumentUser?.id === user.id;
                  return (
                    <button
                      key={user.id}
                      onClick={() => handleSelectDocumentUser(user)}
                      className={`w-full text-left p-4 transition-all ${
                        isActive
                          ? 'bg-white border-l-4 border-blue-500 shadow-sm'
                          : 'hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {user.profile?.name || user.profile?.companyName || user.name || user.email}
                          </p>
                          <p className="text-xs text-gray-500">{user.email || 'No email on record'}</p>
                        </div>
                        <Badge
                          variant={user.role === 'SME' ? 'info' : 'success'}
                          size="sm"
                        >
                          {user.role || 'User'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
                        <span>Status: {user.rejected ? 'Rejected' : user.verified ? 'Verified' : 'Pending'}</span>
                        {user.profile?.sectors?.length > 0 && (
                          <span>{user.profile.sectors.length} sectors</span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
          <div className="lg:col-span-2 border border-gray-100 rounded-2xl p-6 bg-gray-50">
            {!selectedDocumentUser ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 py-16">
                <FolderOpen className="w-16 h-16 text-gray-400 mb-4" />
                <p className="text-lg font-semibold text-gray-700">Select a user to view their documents</p>
                <p className="text-sm text-gray-500 mt-2">
                  Click on any SME or SDP on the left to load all documents they uploaded during registration.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      {selectedDocumentUser.profile?.name ||
                        selectedDocumentUser.profile?.companyName ||
                        selectedDocumentUser.name ||
                        'User'}
                    </h3>
                    <p className="text-sm text-gray-600">{selectedDocumentUser.email}</p>
                    {selectedDocumentUser.profile?.companyName && (
                      <p className="text-xs text-gray-500 mt-1">
                        {selectedDocumentUser.profile.companyName}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={selectedDocumentUser.role === 'SME' ? 'info' : 'success'} size="sm">
                      {selectedDocumentUser.role}
                    </Badge>
                    <Badge
                      variant={
                        selectedDocumentUser.rejected
                          ? 'danger'
                          : selectedDocumentUser.verified
                            ? 'success'
                            : 'warning'
                      }
                      size="sm"
                    >
                      {selectedDocumentUser.rejected
                        ? 'Rejected'
                        : selectedDocumentUser.verified
                          ? 'Verified'
                          : 'Pending'}
                    </Badge>
                  </div>
                </div>

                {userDocumentError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
                    {userDocumentError}
                  </div>
                )}

                {loadingUserDocuments ? (
                  <div className="py-16 flex flex-col items-center justify-center text-gray-500">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3"></div>
                    Loading documents...
                  </div>
                ) : userDocumentList.length === 0 ? (
                  <div className="py-12 text-center text-gray-500">
                    <FolderOpen className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    No documents uploaded yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {userDocumentList.map((doc: any) => (
                      <div
                        key={doc.id}
                        className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div>
                            <p className="font-semibold text-gray-900">
                              {doc.name || doc.fileName || doc.type || 'Document'}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {doc.type || doc.category || doc.documentType || 'Unspecified'} •{' '}
                              {doc.size || 'Size unknown'}
                            </p>
                          </div>
                          {doc.reviewStatus && (
                            <Badge
                              variant={
                                doc.reviewStatus === 'approved'
                                  ? 'success'
                                  : doc.reviewStatus === 'rejected'
                                    ? 'danger'
                                    : 'warning'
                              }
                              size="sm"
                            >
                              {doc.reviewStatus.charAt(0).toUpperCase() + doc.reviewStatus.slice(1)}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 flex flex-wrap gap-4 mt-3">
                          <span>Uploaded: {formatDateTime(doc.uploadedAt || doc.createdAt, 'Unknown')}</span>
                          {doc.category && <span>Category: {doc.category}</span>}
                          {doc.documentType && <span>Type: {doc.documentType}</span>}
                          {doc.certificationDate && (
                            <span>
                              Certified: {formatDateTime(doc.certificationDate, 'Date not supplied')}
                            </span>
                          )}
                        </div>
                        {doc.url && (
                          <div className="mt-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(doc.url, '_blank')}
                              className="hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600"
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View document
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Document Reviews</h2>
              <p className="text-sm text-gray-600 mt-1">Review and approve or reject uploaded documents</p>
              {documentSource === 'fallback' && (
                <p className="text-xs text-blue-600 mt-2">
                  Showing pending uploads pulled directly from SME/SDP registration folders
                  (scanning up to {MAX_USERS_FOR_PENDING_SCAN} users).
                </p>
              )}
              {documentSource === 'queue' && (
                <p className="text-xs text-gray-500 mt-2">
                  Powered by the real-time PayFast document review queue.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-3 min-w-[260px]">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant={documentSource === 'queue' ? 'success' : documentSource === 'fallback' ? 'warning' : 'outline'}
                  size="sm"
                >
                  {documentSource === 'queue'
                    ? 'Queue mode'
                    : documentSource === 'fallback'
                      ? 'User uploads'
                      : 'Idle'}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadPendingDocumentsFromUsers()}
                  disabled={scanningUserDocs}
                  className="hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
                >
                  Refresh pending uploads
                </Button>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={documentReviewSearch}
                    onChange={(e) => setDocumentReviewSearch(e.target.value)}
                    placeholder="Filter by user, company or document..."
                    className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
                <select
                  value={documentReviewRole}
                  onChange={(e) => setDocumentReviewRole(e.target.value as 'all' | 'SME' | 'SDP')}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All roles</option>
                  <option value="SME">SME only</option>
                  <option value="SDP">SDP only</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-6">
          {documentScanError && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
              {documentScanError}
            </div>
          )}
          {loading.documents ? (
            <p className="text-center py-8 text-gray-500">Loading documents...</p>
          ) : filteredPendingDocuments.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">
                {hasDocumentReviewFilters && pendingDocuments.length > 0
                  ? 'No pending documents match your filters.'
                  : documentSource === 'fallback'
                  ? 'No pending documents found across the scanned user profiles.'
                  : 'No pending documents to review'}
              </p>
              {hasDocumentReviewFilters && pendingDocuments.length > 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  Clear the filters to see all {pendingDocuments.length} pending documents.
                </p>
              )}
              {documentSource !== 'queue' && !hasDocumentReviewFilters && (
                <p className="text-xs text-gray-500 mt-2">
                  Need to re-check? Click "Refresh pending uploads" to rescan user folders.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPendingDocuments.map((doc: any) => (
                <div 
                  key={doc.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <FileText className="w-6 h-6 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="font-semibold text-gray-900">{doc.name}</h3>
                          <Badge variant="warning" size="sm">
                            <Clock className="w-3 h-3 mr-1" />
                            Pending
                          </Badge>
                        </div>
                        <div className="space-y-1 text-sm text-gray-600">
                          <p><strong>User:</strong> {doc.userName} ({doc.userRole})</p>
                          <p><strong>Email:</strong> {doc.userEmail}</p>
                          <p><strong>Type:</strong> {doc.type} • <strong>Size:</strong> {doc.size}</p>
                          <p><strong>Uploaded:</strong> {doc.uploadedAt?.toDate ? doc.uploadedAt.toDate().toLocaleString() : 'Unknown'}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (doc.url) {
                            window.open(doc.url, '_blank');
                          }
                        }}
                        className="hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleReviewDocument(doc)}
                        className="hover:shadow-md"
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Review
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Review Modal */}
      {showReviewModal && selectedDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Review Document</h2>
              <button
                onClick={() => {
                  setShowReviewModal(false);
                  setSelectedDocument(null);
                  setReviewComment('');
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4 mb-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">{selectedDocument.name}</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                  <p><strong>User:</strong> {selectedDocument.userName} ({selectedDocument.userRole})</p>
                  <p><strong>Email:</strong> {selectedDocument.userEmail}</p>
                  <p><strong>Type:</strong> {selectedDocument.type}</p>
                  <p><strong>Size:</strong> {selectedDocument.size}</p>
                  <p><strong>Uploaded:</strong> {selectedDocument.uploadedAt?.toDate ? selectedDocument.uploadedAt.toDate().toLocaleString() : 'Unknown'}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Review Comment {selectedDocument.reviewStatus === 'rejected' && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder={selectedDocument.reviewStatus === 'rejected' ? 'Please provide a reason for rejection...' : 'Optional comment (e.g., "Document approved" or reason for rejection)...'}
                />
              </div>

              {selectedDocument.url && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Document Preview</label>
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <a 
                      href={selectedDocument.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 underline flex items-center"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Open document in new tab
                    </a>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowReviewModal(false);
                  setSelectedDocument(null);
                  setReviewComment('');
                }}
                disabled={documentActionLoading !== null}
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  if (!reviewComment.trim()) {
                    alert('Please provide a reason for rejection');
                    return;
                  }
                  const success = await handleRejectDocument();
                  if (success) {
                    // Modal will be closed by handleRejectDocument
                  }
                }}
                className="bg-red-50 border-red-300 text-red-700 hover:bg-red-100"
                disabled={!reviewComment.trim() || documentActionLoading !== null}
              >
                {documentActionLoading === `reject-${selectedDocument?.id}` ? (
                  <>
                    <div className="w-4 h-4 mr-2 border-2 border-red-700 border-t-transparent rounded-full animate-spin"></div>
                    Rejecting...
                  </>
                ) : (
                  <>
                <XCircle className="w-4 h-4 mr-2" />
                Reject
                  </>
                )}
              </Button>
              <Button
                onClick={async () => {
                  const success = await handleApproveDocument();
                  if (success) {
                    // Modal will be closed by handleApproveDocument
                  }
                }}
                className="bg-green-600 hover:bg-green-700 text-white"
                disabled={documentActionLoading !== null}
              >
                {documentActionLoading === `approve-${selectedDocument?.id}` ? (
                  <>
                    <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Approving...
                  </>
                ) : (
                  <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Approve
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderAnalytics = () => {
    // Calculate analytics from Firebase data
    const totalUsers = systemStats.totalUsers || 0;
    const totalSMEs = systemStats.totalSMEs || 0;
    const totalSDPs = systemStats.totalSDPs || 0;
    const smePercentage = totalUsers > 0 ? ((totalSMEs / totalUsers) * 100).toFixed(1) : '0';
    const sdpPercentage = totalUsers > 0 ? ((totalSDPs / totalUsers) * 100).toFixed(1) : '0';
    
    // Calculate new users in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newUsers30Days = [...recentSMEs, ...recentSDPs].filter((u: any) => {
      const createdDate = u.createdAt?.toDate ? u.createdAt.toDate() : 
                         (u.createdAt ? new Date(u.createdAt) : null);
      return createdDate && createdDate >= thirtyDaysAgo;
    }).length;
    
    const activeEngagements = systemStats.activeEngagements || 0;
    const totalEngagements = systemStats.totalEngagements || 0;
    const engagementPercentage = totalEngagements > 0 ? ((activeEngagements / totalEngagements) * 100).toFixed(0) : '0';
    
    return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Platform Growth</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">New Users (30 days)</span>
                  <span className="font-medium text-gray-900">+{newUsers30Days} users</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all" 
                    style={{ width: `${Math.min((newUsers30Days / Math.max(totalUsers, 1)) * 100, 100)}%` }}
                  ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Active Engagements</span>
                  <span className="font-medium text-gray-900">{activeEngagements} active</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full transition-all" 
                    style={{ width: `${engagementPercentage}%` }}
                  ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Verified Users</span>
                  <span className="font-medium text-gray-900">{systemStats.verifiedUsers || 0} / {totalUsers}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-purple-600 h-2 rounded-full transition-all" 
                    style={{ width: `${totalUsers > 0 ? ((systemStats.verifiedUsers || 0) / totalUsers * 100) : 0}%` }}
                  ></div>
              </div>
            </div>
          </div>
        </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">User Distribution</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">SMEs</span>
                  <span className="font-medium text-gray-900">{smePercentage}% ({totalSMEs})</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all" 
                    style={{ width: `${smePercentage}%` }}
                  ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">SDPs</span>
                  <span className="font-medium text-gray-900">{sdpPercentage}% ({totalSDPs})</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full transition-all" 
                    style={{ width: `${sdpPercentage}%` }}
                  ></div>
                </div>
              </div>
              <div className="pt-4 border-t border-gray-200">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Total Users</span>
                  <span className="font-bold text-gray-900 text-lg">{totalUsers}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Amount Statistics */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-gray-900 flex items-center">
            <DollarSign className="w-5 h-5 mr-2 text-green-600" />
            Amount Statistics
          </h3>
          <Badge variant="success" size="sm">All Engagements</Badge>
        </div>
        
        {/* Calculate amount statistics */}
        {(() => {
          const parseAmount = (amountStr: string) => {
            if (!amountStr) return 0;
            return parseFloat(amountStr.replace(/[^0-9.]/g, '')) || 0;
          };

          // Amounts by status
          const completedAmount = recentEngagements
            .filter((e: any) => e.status === 'Completed')
            .reduce((sum: number, e: any) => sum + parseAmount(e.budget || e.fee || '0'), 0);
          
          const pendingAmount = recentEngagements
            .filter((e: any) => e.status === 'Pending' || e.status === 'Accepted')
            .reduce((sum: number, e: any) => sum + parseAmount(e.budget || e.fee || '0'), 0);
          
          const inProgressAmount = recentEngagements
            .filter((e: any) => e.status === 'In Progress')
            .reduce((sum: number, e: any) => sum + parseAmount(e.budget || e.fee || '0'), 0);
          
          const disputedAmount = recentEngagements
            .filter((e: any) => e.status === 'Disputed')
            .reduce((sum: number, e: any) => sum + parseAmount(e.budget || e.fee || '0'), 0);

          // Escrow amounts
          const escrowHeldAmount = recentEngagements
            .filter((e: any) => e.fundsReleasedAt && !e.paymentConfirmedByAdmin)
            .reduce((sum: number, e: any) => sum + parseAmount(e.budget || e.fee || '0'), 0);

          // All engagement amounts
          const allEngagementAmounts = recentEngagements
            .map((e: any) => parseAmount(e.budget || e.fee || '0'))
            .filter((amt: number) => amt > 0);

          const totalAllAmounts = allEngagementAmounts.reduce((sum: number, amt: number) => sum + amt, 0);
          const avgAmount = allEngagementAmounts.length > 0 ? totalAllAmounts / allEngagementAmounts.length : 0;
          const maxAmount = allEngagementAmounts.length > 0 ? Math.max(...allEngagementAmounts) : 0;
          const minAmount = allEngagementAmounts.length > 0 ? Math.min(...allEngagementAmounts) : 0;

          // Confirmed payments amount
          const confirmedAmount = recentEngagements
            .filter((e: any) => e.paymentConfirmedByAdmin)
            .reduce((sum: number, e: any) => sum + parseAmount(e.budget || e.fee || '0'), 0);

          return (
            <div className="space-y-6">
              {/* Amount by Status */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-4">Amount by Engagement Status</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <div className="flex items-center justify-between mb-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="text-lg font-extrabold text-green-600">
                        R{completedAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="text-xs font-medium text-gray-600">Completed</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {recentEngagements.filter((e: any) => e.status === 'Completed').length} engagements
                    </div>
                  </div>
                  
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <div className="flex items-center justify-between mb-2">
                      <Clock className="w-5 h-5 text-blue-600" />
                      <span className="text-lg font-extrabold text-blue-600">
                        R{inProgressAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="text-xs font-medium text-gray-600">In Progress</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {recentEngagements.filter((e: any) => e.status === 'In Progress').length} engagements
                    </div>
                  </div>
                  
                  <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                    <div className="flex items-center justify-between mb-2">
                      <AlertCircle className="w-5 h-5 text-yellow-600" />
                      <span className="text-lg font-extrabold text-yellow-600">
                        R{pendingAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="text-xs font-medium text-gray-600">Pending</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {recentEngagements.filter((e: any) => e.status === 'Pending' || e.status === 'Accepted').length} engagements
                    </div>
                  </div>
                  
                  <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                    <div className="flex items-center justify-between mb-2">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                      <span className="text-lg font-extrabold text-red-600">
                        R{disputedAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="text-xs font-medium text-gray-600">Disputed</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {recentEngagements.filter((e: any) => e.status === 'Disputed').length} engagements
                    </div>
                  </div>
                </div>
              </div>

              {/* Financial Summary */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-4">Financial Summary</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-5 border border-purple-200">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="text-xs text-gray-600 mb-1">Total All Amounts</div>
                        <div className="text-2xl font-extrabold text-purple-600">
                          R{totalAllAmounts.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                      <CreditCard className="w-8 h-8 text-purple-400" />
                    </div>
                    <div className="text-xs text-gray-500">
                      Across {allEngagementAmounts.length} engagements with amounts
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-5 border border-green-200">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="text-xs text-gray-600 mb-1">Confirmed Payments</div>
                        <div className="text-2xl font-extrabold text-green-600">
                          R{confirmedAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                      <CheckCircle className="w-8 h-8 text-green-400" />
                    </div>
                    <div className="text-xs text-gray-500">
                      {recentEngagements.filter((e: any) => e.paymentConfirmedByAdmin).length} confirmed transactions
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-5 border border-blue-200">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="text-xs text-gray-600 mb-1">Held in Escrow</div>
                        <div className="text-2xl font-extrabold text-blue-600">
                          R{escrowHeldAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                      <Lock className="w-8 h-8 text-blue-400" />
                    </div>
                    <div className="text-xs text-gray-500">
                      {recentEngagements.filter((e: any) => e.fundsReleasedAt && !e.paymentConfirmedByAdmin).length} engagements
                    </div>
                  </div>
                </div>
              </div>

              {/* Amount Statistics */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-4">Amount Statistics</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="text-xs text-gray-600 mb-1">Average Amount</div>
                    <div className="text-xl font-extrabold text-gray-900">
                      R{avgAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Per engagement</div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="text-xs text-gray-600 mb-1">Highest Amount</div>
                    <div className="text-xl font-extrabold text-gray-900">
                      R{maxAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Single engagement</div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="text-xs text-gray-600 mb-1">Lowest Amount</div>
                    <div className="text-xl font-extrabold text-gray-900">
                      R{minAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Single engagement</div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="text-xs text-gray-600 mb-1">Total Transactions</div>
                    <div className="text-xl font-extrabold text-gray-900">
                      {allEngagementAmounts.length}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">With amounts</div>
                  </div>
                </div>
              </div>

              {/* Amount Distribution */}
              {totalAllAmounts > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-4">Amount Distribution</h4>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs text-gray-600 mb-2">
                        <span>Completed ({((completedAmount / totalAllAmounts) * 100).toFixed(1)}%)</span>
                        <span className="font-semibold">R{completedAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div 
                          className="bg-green-500 h-2.5 rounded-full transition-all"
                          style={{ width: `${(completedAmount / totalAllAmounts) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-xs text-gray-600 mb-2">
                        <span>In Progress ({((inProgressAmount / totalAllAmounts) * 100).toFixed(1)}%)</span>
                        <span className="font-semibold">R{inProgressAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div 
                          className="bg-blue-500 h-2.5 rounded-full transition-all"
                          style={{ width: `${(inProgressAmount / totalAllAmounts) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-xs text-gray-600 mb-2">
                        <span>Pending ({((pendingAmount / totalAllAmounts) * 100).toFixed(1)}%)</span>
                        <span className="font-semibold">R{pendingAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div 
                          className="bg-yellow-500 h-2.5 rounded-full transition-all"
                          style={{ width: `${(pendingAmount / totalAllAmounts) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    {disputedAmount > 0 && (
                      <div>
                        <div className="flex justify-between text-xs text-gray-600 mb-2">
                          <span>Disputed ({((disputedAmount / totalAllAmounts) * 100).toFixed(1)}%)</span>
                          <span className="font-semibold">R{disputedAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div 
                            className="bg-red-500 h-2.5 rounded-full transition-all"
                            style={{ width: `${(disputedAmount / totalAllAmounts) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
        <div className="space-y-3">
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

              const colorClass = activity.type === 'success' ? 'bg-green-500' : 'bg-blue-500';

              return (
                <div key={activity.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className={`w-2 h-2 rounded-full ${colorClass}`}></div>
              <div className="flex-1">
                <p className="text-sm text-gray-900">{activity.action}</p>
                    <p className="text-xs text-gray-500">{activity.user || activity.amount} • {getTimeAgo(activity.timestamp)}</p>
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
  );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-purple-600 rounded-2xl shadow-xl p-8 mb-8 text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -mr-32 -mt-32"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full -ml-24 -mb-24"></div>
          </div>
          <div className="relative">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <Shield className="w-6 h-6" />
                </div>
                <h1 className="text-3xl font-bold">Admin Dashboard</h1>
              </div>
              <p className="text-blue-100 mt-1">Monitor and manage the Scholarz platform</p>
            </div>
            <div className="flex items-center space-x-3">
              <Badge variant="default" size="sm" className="bg-white/20 text-white border-white/30">
                <Shield className="w-3 h-3 mr-1" />
                Admin Access
              </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 mb-8 p-2 backdrop-blur-sm">
          <div className="flex space-x-2 overflow-x-auto">
            {views.map(view => {
              const Icon = view.icon;
              return (
                <button
                  key={view.id}
                  onClick={() => setActiveView(view.id)}
                  className={`flex items-center space-x-2 px-5 py-2.5 font-medium text-sm transition-all rounded-lg whitespace-nowrap ${
                    activeView === view.id
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{view.label}</span>
                  {view.badge && (
                    <Badge 
                      variant={activeView === view.id ? "default" : "warning"} 
                      size="sm"
                      className={activeView === view.id ? "bg-white/20 text-white border-white/30" : ""}
                    >
                      {view.badge}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div>
          {activeView === 'overview' && renderOverview()}
          {activeView === 'applications' && renderApplications()}
          {activeView === 'documents' && renderDocuments()}
          {activeView === 'disputes' && renderDisputes()}
          {activeView === 'payments' && renderPayments()}
          {activeView === 'blogs' && renderBlogs()}
          {activeView === 'smes' && renderSMEs()}
          {activeView === 'sdps' && renderSDPs()}
          {activeView === 'engagements' && renderEngagements()}
          {activeView === 'escrow' && renderEscrow()}
          {activeView === 'analytics' && renderAnalytics()}
        </div>
      </div>

      {/* Payment Confirmation Modal */}
      {showPaymentModal && selectedPayment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                    <DollarSign className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Confirm Payment</h2>
                    <p className="text-green-100 text-sm">Verify bank transfer completion</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setShowPaymentModal(false);
                    setSelectedPayment(null);
                    setReviewComment('');
                  }}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Project Details */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Project Details</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Project:</span>
                    <span className="text-sm font-semibold text-gray-900">{selectedPayment.projectName || selectedPayment.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">SME:</span>
                    <span className="text-sm font-semibold text-gray-900">{selectedPayment.sme}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">SDP:</span>
                    <span className="text-sm font-semibold text-gray-900">{selectedPayment.sdp}</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
                    <span className="text-sm font-semibold text-gray-700">Payment Amount:</span>
                    <span className="text-lg font-bold text-green-600">{selectedPayment.fee}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Funds Released:</span>
                    <span className="text-sm text-gray-700">
                      {selectedPayment.fundsReleasedAt ? new Date(selectedPayment.fundsReleasedAt.seconds * 1000).toLocaleString() : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Warning */}
              <div className="bg-amber-50 border-l-4 border-amber-600 p-4 rounded">
                <div className="flex items-start">
                  <AlertTriangle className="w-5 h-5 text-amber-600 mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold text-amber-900 mb-1">Important</h4>
                    <p className="text-xs text-amber-800">
                      Before confirming, please verify that the payment of <strong>{selectedPayment.fee}</strong> has been successfully transferred to the SME's bank account. This action cannot be undone.
                    </p>
                  </div>
                </div>
              </div>

              {/* Admin Comment */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Confirmation Note (Optional)
                </label>
                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Add a note about the payment verification..."
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                  rows={3}
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowPaymentModal(false);
                    setSelectedPayment(null);
                    setReviewComment('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleConfirmPayment(selectedPayment.id, reviewComment)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Confirm Payment Made
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Engagement Comment Modal */}
      {showCommentModal && selectedEngagementForComment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Add Comment</h2>
                    <p className="text-purple-100 text-sm">
                      {selectedEngagementForComment.projectName || selectedEngagementForComment.type || 'Engagement'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setShowCommentModal(false);
                    setSelectedEngagementForComment(null);
                    setEngagementComment('');
                  }}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Engagement Details */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Engagement Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">SME:</span>
                    <span className="font-semibold text-gray-900">
                      {(() => {
                        let smeName = selectedEngagementForComment.smeName;
                        if (!smeName && selectedEngagementForComment.smeId) {
                          const sme = recentSMEs.find((s: any) => s.id === selectedEngagementForComment.smeId);
                          smeName = sme?.name || sme?.profile?.name || 'N/A';
                        }
                        return smeName || 'N/A';
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">SDP:</span>
                    <span className="font-semibold text-gray-900">
                      {(() => {
                        let sdpName = selectedEngagementForComment.sdpName;
                        if (!sdpName && selectedEngagementForComment.sdpId) {
                          const sdp = recentSDPs.find((s: any) => s.id === selectedEngagementForComment.sdpId);
                          sdpName = sdp?.name || sdp?.profile?.name || 'N/A';
                        }
                        return sdpName || 'N/A';
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <Badge 
                      variant={
                        selectedEngagementForComment.status === 'Completed' ? 'success' :
                        selectedEngagementForComment.status === 'In Progress' ? 'info' :
                        selectedEngagementForComment.status === 'Disputed' ? 'danger' : 'warning'
                      }
                      size="sm"
                    >
                      {selectedEngagementForComment.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
                    <span className="text-gray-600">Budget:</span>
                    <span className="font-semibold text-gray-900">
                      {selectedEngagementForComment.budget || selectedEngagementForComment.fee || 'TBD'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Existing Comments */}
              {selectedEngagementForComment.adminComments && selectedEngagementForComment.adminComments.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Previous Comments ({selectedEngagementForComment.adminComments.length})
                  </h3>
                  <div className="space-y-3 max-h-48 overflow-y-auto">
                    {selectedEngagementForComment.adminComments
                      .sort((a: any, b: any) => {
                        const dateA = a.addedAt?.toDate ? a.addedAt.toDate().getTime() : 
                                     (a.addedAt ? new Date(a.addedAt).getTime() : 0);
                        const dateB = b.addedAt?.toDate ? b.addedAt.toDate().getTime() : 
                                     (b.addedAt ? new Date(b.addedAt).getTime() : 0);
                        return dateB - dateA; // Newest first
                      })
                      .map((comment: any, idx: number) => (
                        <div key={comment.id || idx} className="bg-white border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                                <MessageSquare className="w-4 h-4 text-purple-600" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{comment.addedBy || 'Admin'}</p>
                                <p className="text-xs text-gray-500">
                                  {comment.addedAt?.toDate 
                                    ? comment.addedAt.toDate().toLocaleString('en-ZA', {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })
                                    : 'Recently'}
                                </p>
                              </div>
                            </div>
                          </div>
                          <p className="text-sm text-gray-700 mt-2">{comment.comment}</p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* New Comment Input */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Add Comment
                </label>
                <textarea
                  value={engagementComment}
                  onChange={(e) => setEngagementComment(e.target.value)}
                  placeholder="Enter your comment about this engagement..."
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  rows={4}
                />
                <p className="text-xs text-gray-500 mt-2">
                  This comment will be saved to the engagement record and visible to admins.
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCommentModal(false);
                    setSelectedEngagementForComment(null);
                    setEngagementComment('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleAddEngagementComment(selectedEngagementForComment.id, engagementComment)}
                  className="bg-purple-600 hover:bg-purple-700"
                  disabled={!engagementComment.trim()}
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Add Comment
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Application Details Modal */}
      {showApplicationModal && selectedApplication && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className={`bg-gradient-to-r ${
              selectedApplication.rejected 
                ? 'from-red-600 to-red-700' 
                : selectedApplication.type === 'SME' 
                  ? 'from-blue-600 to-blue-700' 
                  : 'from-green-600 to-green-700'
            } text-white p-6 rounded-t-2xl sticky top-0 z-10`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                    {selectedApplication.rejected ? (
                      <XCircle className="w-6 h-6" />
                    ) : selectedApplication.type === 'SME' ? (
                      <Users className="w-6 h-6" />
                    ) : (
                      <Briefcase className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Application Details</h2>
                    <p className="text-white/90 text-sm">
                      {selectedApplication.profile?.name || selectedApplication.name || 'User'} - {selectedApplication.type}
                      {selectedApplication.rejected && ' (Rejected)'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setShowApplicationModal(false);
                    setSelectedApplication(null);
                    setApplicationDocuments([]);
                  }}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {loadingApplication ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                  <p className="text-gray-500">Loading application details...</p>
                </div>
              ) : (
                <>
                  {/* Rejection Information (if rejected) */}
                  {selectedApplication.rejected && (
                    <div className="bg-red-50 border-l-4 border-red-600 rounded-lg p-6">
                      <div className="flex items-start space-x-3">
                        <XCircle className="w-6 h-6 text-red-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-red-900 mb-2">Application Rejected</h3>
                          {selectedApplication.rejectionReason && (
                            <div className="mb-3">
                              <p className="text-sm font-semibold text-red-700 mb-1">Rejection Reason:</p>
                              <p className="text-sm text-red-800 bg-white rounded-lg p-3 border border-red-200">
                                {selectedApplication.rejectionReason}
                              </p>
                            </div>
                          )}
                          {selectedApplication.rejectedAt && (
                            <p className="text-xs text-red-600">
                              Rejected on: {selectedApplication.rejectedAt?.toDate 
                                ? selectedApplication.rejectedAt.toDate().toLocaleDateString('en-ZA', { 
                                    year: 'numeric', 
                                    month: 'long', 
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })
                                : 'N/A'}
                            </p>
                          )}
                          {selectedApplication.rejectedByName && (
                            <p className="text-xs text-red-600 mt-1">
                              Rejected by: {selectedApplication.rejectedByName}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Personal/Company Information */}
                  <div className="bg-gray-50 rounded-xl p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                      <FileText className="w-5 h-5 mr-2" />
                      {selectedApplication.type === 'SME' ? 'Personal Information' : 'Company Information'}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-600">Name</label>
                        <p className="text-gray-900 font-semibold mt-1">
                          {selectedApplication.profile?.name || selectedApplication.name || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Email</label>
                        <p className="text-gray-900 font-semibold mt-1">
                          {selectedApplication.email || selectedApplication.profile?.email || 'N/A'}
                        </p>
                      </div>
                      {selectedApplication.phone && (
                        <div>
                          <label className="text-sm font-medium text-gray-600">Phone</label>
                          <p className="text-gray-900 font-semibold mt-1">{selectedApplication.phone}</p>
                        </div>
                      )}
                      {selectedApplication.profile?.location && (
                        <div>
                          <label className="text-sm font-medium text-gray-600">Location</label>
                          <p className="text-gray-900 font-semibold mt-1">{selectedApplication.profile.location}</p>
                        </div>
                      )}
                      {selectedApplication.type === 'SDP' && selectedApplication.profile?.companyName && (
                        <div>
                          <label className="text-sm font-medium text-gray-600">Company Name</label>
                          <p className="text-gray-900 font-semibold mt-1">{selectedApplication.profile.companyName}</p>
                        </div>
                      )}
                      {selectedApplication.type === 'SDP' && selectedApplication.profile?.registrationNumber && (
                        <div>
                          <label className="text-sm font-medium text-gray-600">Registration Number</label>
                          <p className="text-gray-900 font-semibold mt-1">{selectedApplication.profile.registrationNumber}</p>
                        </div>
                      )}
                      {selectedApplication.createdAt && (
                        <div>
                          <label className="text-sm font-medium text-gray-600">Registration Date</label>
                          <p className="text-gray-900 font-semibold mt-1">
                            {selectedApplication.createdAt?.toDate 
                              ? selectedApplication.createdAt.toDate().toLocaleDateString('en-ZA', { 
                                  year: 'numeric', 
                                  month: 'long', 
                                  day: 'numeric' 
                                })
                              : 'N/A'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Professional Information */}
                  {(selectedApplication.profile?.specializations?.length > 0 || 
                    selectedApplication.profile?.sectors?.length > 0 ||
                    selectedApplication.profile?.qualifications?.length > 0 ||
                    selectedApplication.profile?.experience) && (
                    <div className="bg-gray-50 rounded-xl p-6">
                      <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                        <Award className="w-5 h-5 mr-2" />
                        Professional Information
                      </h3>
                      <div className="space-y-4">
                        {selectedApplication.profile?.specializations?.length > 0 && (
                          <div>
                            <label className="text-sm font-medium text-gray-600 block mb-2">Specializations</label>
                            <div className="flex flex-wrap gap-2">
                              {selectedApplication.profile.specializations.map((spec: string, idx: number) => (
                                <Badge key={idx} variant="outline" size="sm">
                                  {spec}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {selectedApplication.profile?.sectors?.length > 0 && (
                          <div>
                            <label className="text-sm font-medium text-gray-600 block mb-2">Sectors</label>
                            <div className="flex flex-wrap gap-2">
                              {selectedApplication.profile.sectors.map((sector: string, idx: number) => (
                                <Badge key={idx} variant="outline" size="sm">
                                  {sector}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {selectedApplication.profile?.qualifications?.length > 0 && (
                          <div>
                            <label className="text-sm font-medium text-gray-600 block mb-2">Qualifications</label>
                            <div className="flex flex-wrap gap-2">
                              {selectedApplication.profile.qualifications.map((qual: string, idx: number) => (
                                <Badge key={idx} variant="info" size="sm">
                                  {qual}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {selectedApplication.profile?.experience && (
                          <div>
                            <label className="text-sm font-medium text-gray-600">Experience</label>
                            <p className="text-gray-900 font-semibold mt-1">{selectedApplication.profile.experience}</p>
                          </div>
                        )}
                        {selectedApplication.profile?.aboutMe && (
                          <div>
                            <label className="text-sm font-medium text-gray-600 block mb-2">About</label>
                            <p className="text-gray-700 text-sm">{selectedApplication.profile.aboutMe}</p>
                          </div>
                        )}
                        {selectedApplication.type === 'SDP' && selectedApplication.profile?.learners && (
                          <div>
                            <label className="text-sm font-medium text-gray-600">Learner Capacity</label>
                            <p className="text-gray-900 font-semibold mt-1">{selectedApplication.profile.learners}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Billing & Banking Information */}
                  {billingInfo && (
                    <div className="bg-gray-50 rounded-xl p-6">
                      <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                        <CreditCard className="w-5 h-5 mr-2" />
                        Billing & Banking Details
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        {[
                          { label: 'Billing Name', value: billingInfo.companyName },
                          { label: 'Billing Email', value: billingInfo.contactEmail },
                          { label: 'Billing Phone', value: billingInfo.phone },
                          { label: 'VAT Number', value: billingInfo.vatNumber },
                          { label: 'Billing Reference', value: billingInfo.billingReference },
                          { label: 'Billing Address', value: billingInfo.address }
                        ].map((field, idx) => (
                          <div key={idx}>
                            <label className="text-sm font-medium text-gray-600">{field.label}</label>
                            <p className="text-gray-900 font-semibold mt-1">{formatDetailValue(field.value)}</p>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-gray-200 pt-4">
                        <h4 className="text-sm font-semibold text-gray-900 mb-3">Banking Details</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {[
                            { label: 'Bank Name', value: billingInfo.bankName },
                            { label: 'Account Holder', value: billingInfo.accountHolder },
                            { label: 'Account Number', value: billingInfo.accountNumber },
                            { label: 'Branch Code', value: billingInfo.branchCode },
                            { label: 'Account Type', value: billingInfo.accountType }
                          ].map((field, idx) => (
                            <div key={idx}>
                              <label className="text-sm font-medium text-gray-600">{field.label}</label>
                              <p className="text-gray-900 font-semibold mt-1">{formatDetailValue(field.value)}</p>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-3">
                          Only administrators can view these banking details. Handle with strict confidentiality.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Rates (for SME) */}
                  {selectedApplication.type === 'SME' && selectedApplication.profile?.rates && (
                    <div className="bg-gray-50 rounded-xl p-6">
                      <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                        <DollarSign className="w-5 h-5 mr-2" />
                        Service Rates
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {selectedApplication.profile.rates.facilitation && (
                          <div>
                            <label className="text-sm font-medium text-gray-600">Facilitation</label>
                            <p className="text-gray-900 font-semibold mt-1">{selectedApplication.profile.rates.facilitation}</p>
                          </div>
                        )}
                        {selectedApplication.profile.rates.assessment && (
                          <div>
                            <label className="text-sm font-medium text-gray-600">Assessment</label>
                            <p className="text-gray-900 font-semibold mt-1">{selectedApplication.profile.rates.assessment}</p>
                          </div>
                        )}
                        {selectedApplication.profile.rates.consultation && (
                          <div>
                            <label className="text-sm font-medium text-gray-600">Consultation</label>
                            <p className="text-gray-900 font-semibold mt-1">{selectedApplication.profile.rates.consultation}</p>
                          </div>
                        )}
                        {selectedApplication.profile.rates.moderation && (
                          <div>
                            <label className="text-sm font-medium text-gray-600">Moderation</label>
                            <p className="text-gray-900 font-semibold mt-1">{selectedApplication.profile.rates.moderation}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Documents */}
                  <div className="bg-gray-50 rounded-xl p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                      <FolderOpen className="w-5 h-5 mr-2" />
                      Uploaded Documents ({applicationDocuments.length})
                    </h3>
                    {applicationDocuments.length === 0 ? (
                      <div className="text-center py-8">
                        <FolderOpen className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-600">No documents uploaded</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {applicationDocuments.map((doc: any) => {
                          const approveLoading = documentActionLoading === `approve-${doc.id}`;
                          const rejectLoading = documentActionLoading === `reject-${doc.id}`;
                          return (
                            <div 
                              key={doc.id}
                              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                            >
                              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center space-x-3 flex-1">
                                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                    <FileText className="w-5 h-5 text-blue-600" />
                                  </div>
                                  <div className="flex-1">
                                    <h4 className="font-semibold text-gray-900">{doc.name || doc.fileName || 'Document'}</h4>
                                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                                      {doc.type && <span>Type: {doc.type}</span>}
                                      {doc.uploadedAt && (
                                        <span>
                                          Uploaded: {doc.uploadedAt?.toDate 
                                            ? doc.uploadedAt.toDate().toLocaleDateString('en-ZA')
                                            : 'N/A'}
                                        </span>
                                      )}
                                      {doc.size && <span>Size: {doc.size}</span>}
                                    </div>
                                    {doc.reviewStatus && (
                                      <div className="mt-2">
                                        <Badge 
                                          variant={doc.reviewStatus === 'approved' ? 'success' : 
                                                  doc.reviewStatus === 'rejected' ? 'danger' : 'warning'}
                                          size="sm"
                                        >
                                          {doc.reviewStatus}
                                        </Badge>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center flex-wrap gap-2">
                                  {doc.url && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => window.open(doc.url, '_blank')}
                                      className="hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600"
                                    >
                                      <Eye className="w-4 h-4 mr-2" />
                                      View
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    onClick={() => handleApplicationDocumentDecision(doc, 'approve')}
                                    disabled={approveLoading}
                                    className="bg-green-600 hover:bg-green-700 disabled:opacity-60"
                                  >
                                    {approveLoading ? (
                                      'Approving...'
                                    ) : (
                                      <>
                                        <Check className="w-4 h-4 mr-2" />
                                        Accept
                                      </>
                                    )}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleApplicationDocumentDecision(doc, 'reject')}
                                    disabled={rejectLoading}
                                    className="border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-60"
                                  >
                                    {rejectLoading ? (
                                      'Rejecting...'
                                    ) : (
                                      <>
                                        <XIcon className="w-4 h-4 mr-2" />
                                        Reject
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowApplicationModal(false);
                        setSelectedApplication(null);
                        setApplicationDocuments([]);
                      }}
                    >
                      Close
                    </Button>
                    <Button
                      variant="outline"
                      onClick={async () => {
                        await handleReject(selectedApplication.id, selectedApplication.type);
                        setShowApplicationModal(false);
                        setSelectedApplication(null);
                        setApplicationDocuments([]);
                      }}
                      className="hover:bg-red-50 hover:border-red-300 hover:text-red-600"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                    <Button
                      onClick={() => {
                        handleVerify(selectedApplication.id, selectedApplication.type);
                        setShowApplicationModal(false);
                        setSelectedApplication(null);
                        setApplicationDocuments([]);
                      }}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve & Verify
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

