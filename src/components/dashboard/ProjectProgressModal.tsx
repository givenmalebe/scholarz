import React, { useState } from 'react';
import {
  X,
  Upload,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  FileSignature,
  Download,
  Trash2,
  PlayCircle,
  CheckSquare,
  Edit,
  Star
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc, Timestamp, collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { db, storage, isFirebaseConfigured } from '../../firebase/config';
import { createNotification } from '../../utils/notifications';

interface ProjectProgressModalProps {
  engagement: any;
  userRole: 'SDP' | 'SME';
  userId: string;
  userName: string;
  onClose: () => void;
  onUpdate: () => void;
}

export const ProjectProgressModal: React.FC<ProjectProgressModalProps> = ({
  engagement,
  userRole,
  userId,
  userName,
  onClose,
  onUpdate
}) => {
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [requiresSignature, setRequiresSignature] = useState(false);
  const [milestoneForUpload, setMilestoneForUpload] = useState<string>('');
  
  // Rating modal state
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [hoveredRating, setHoveredRating] = useState(0);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [ratingSuccess, setRatingSuccess] = useState(false);
  const [isUpdatingExistingRating, setIsUpdatingExistingRating] = useState(false);

  // Get milestones array
  const milestones = engagement.milestones || [];

  // Debug logging
  console.log('ProjectProgressModal rendered:', {
    engagementId: engagement.id,
    status: engagement.status,
    userRole,
    projectStartedAt: engagement.projectStartedAt,
    smeCompletedAt: engagement.smeCompletedAt,
    showStartButton: userRole === 'SME' && engagement.status === 'In Progress' && !engagement.projectStartedAt,
    showCompleteButton: userRole === 'SME' && engagement.status === 'In Progress' && engagement.projectStartedAt && !engagement.smeCompletedAt,
    showConfirmButton: userRole === 'SDP' && engagement.status === 'Awaiting SDP Confirmation'
  });

  // Calculate progress percentage based on time and completion status
  const calculateProgressPercentage = () => {
    // If SME marked complete, show 100%
    if (engagement.smeCompletedAt) {
      return 100;
    }
    
    // If not started yet, show 0%
    if (!engagement.projectStartedAt) {
      return 0;
    }
    
    // Calculate based on time elapsed
    const startDate = new Date(engagement.startDate);
    const endDate = new Date(engagement.endDate);
    const now = new Date();
    
    // If we're before start date, 0%
    if (now < startDate) {
      return 0;
    }
    
    // If we're past end date and not completed, show 90% (needs completion)
    if (now > endDate) {
      return 90;
    }
    
    // Calculate percentage based on time elapsed
    const totalDuration = endDate.getTime() - startDate.getTime();
    const elapsed = now.getTime() - startDate.getTime();
    const percentage = Math.round((elapsed / totalDuration) * 100);
    
    // Cap at 90% until SME marks complete
    return Math.min(percentage, 90);
  };
  
  const progressPercentage = calculateProgressPercentage();

  // Debug logging
  console.log('ProjectProgressModal rendering:', {
    userRole,
    status: engagement.status,
    projectStartedAt: engagement.projectStartedAt,
    smeCompletedAt: engagement.smeCompletedAt,
    progressPercentage,
    showStartButton: userRole === 'SME' && engagement.status === 'In Progress' && !engagement.projectStartedAt,
    showCompleteButton: userRole === 'SME' && engagement.status === 'In Progress' && engagement.projectStartedAt && !engagement.smeCompletedAt
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUploadDocument = async () => {
    if (!selectedFile || !isFirebaseConfigured()) return;

    setUploadingDocument(true);
    try {
      // Upload to Firebase Storage
      const fileRef = ref(storage, `project-documents/${engagement.id}/${Date.now()}_${selectedFile.name}`);
      await uploadBytes(fileRef, selectedFile);
      const downloadURL = await getDownloadURL(fileRef);

      // Create document object
      const newDocument: any = {
        id: `doc_${Date.now()}`,
        name: selectedFile.name,
        url: downloadURL,
        uploadedBy: userId,
        uploadedByName: userName,
        uploadedAt: new Date().toISOString(),
        type: milestoneForUpload ? 'milestone' : 'general',
        requiresSignature,
        status: requiresSignature ? 'uploaded' : 'approved',
        signedBy: [],
        signedByNames: []
      };
      
      // Only add milestoneId if it exists (Firestore doesn't accept undefined)
      if (milestoneForUpload) {
        newDocument.milestoneId = milestoneForUpload;
      }

      // Update engagement in Firestore
      const updatedDocuments = [...(engagement.documents || []), newDocument];
      await updateDoc(doc(db, 'engagements', engagement.id), {
        documents: updatedDocuments,
        updatedAt: Timestamp.now()
      });

      // If document is for a milestone, update milestone
      if (milestoneForUpload) {
        const updatedMilestones = milestones.map((m: any) => 
          m.id === milestoneForUpload 
            ? { ...m, documentId: newDocument.id }
            : m
        );
        await updateDoc(doc(db, 'engagements', engagement.id), {
          milestones: updatedMilestones
        });
      }

      console.log('Document uploaded successfully:', newDocument);
      
      // Reset form
      setSelectedFile(null);
      setMilestoneForUpload('');
      setRequiresSignature(false);
      
      // Close and reopen modal to show new document
      onClose();
      
      // Show success message
      setTimeout(() => {
        alert('✅ Document uploaded successfully! Reopening to show the document...');
      }, 300);
      
      // Trigger refresh
      setTimeout(() => {
        onUpdate();
      }, 500);
    } catch (error: any) {
      console.error('Error uploading document:', error);
      alert(`❌ Failed to upload document: ${error.message || 'Please try again.'}`);
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleSignDocument = async (documentId: string) => {
    if (!isFirebaseConfigured()) return;

    try {
      const updatedDocuments = (engagement.documents || []).map((doc: any) => 
        doc.id === documentId
          ? {
              ...doc,
              signedBy: [...(doc.signedBy || []), userId],
              signedByNames: [...(doc.signedByNames || []), userName],
              signedAt: new Date().toISOString(),
              status: 'signed'
            }
          : doc
      );

      await updateDoc(doc(db, 'engagements', engagement.id), {
        documents: updatedDocuments,
        updatedAt: Timestamp.now()
      });

      console.log('Document signed successfully!');
      
      // Close and reopen modal to show signature
      onClose();
      
      setTimeout(() => {
        alert('✅ Document signed successfully! Reopening to show the signature...');
      }, 300);
      
      setTimeout(() => {
        onUpdate();
      }, 500);
    } catch (error: any) {
      console.error('Error signing document:', error);
      alert(`❌ Failed to sign document: ${error.message || 'Please try again.'}`);
    }
  };

  const handleMarkMilestoneComplete = async (milestoneId: string) => {
    if (!isFirebaseConfigured() || userRole !== 'SME') return;

    try {
      const updatedMilestones = milestones.map((m: any) => 
        m.id === milestoneId
          ? {
              ...m,
              status: 'completed',
              completedAt: new Date().toISOString(),
              completedBy: userId
            }
          : m
      );

      const completedCount = updatedMilestones.filter((m: any) => m.status === 'completed').length;
      const newProgress = Math.round((completedCount / updatedMilestones.length) * 100);

      await updateDoc(doc(db, 'engagements', engagement.id), {
        milestones: updatedMilestones,
        progressPercentage: newProgress,
        updatedAt: Timestamp.now()
      });

      alert('Milestone marked as complete!');
      onUpdate();
    } catch (error) {
      console.error('Error updating milestone:', error);
      alert('Failed to update milestone. Please try again.');
    }
  };

  const handleMarkMilestoneInProgress = async (milestoneId: string) => {
    if (!isFirebaseConfigured() || userRole !== 'SME') return;

    try {
      const updatedMilestones = milestones.map((m: any) => 
        m.id === milestoneId
          ? { ...m, status: 'in_progress' }
          : m
      );

      await updateDoc(doc(db, 'engagements', engagement.id), {
        milestones: updatedMilestones,
        updatedAt: Timestamp.now()
      });

      alert('Milestone started!');
      onUpdate();
    } catch (error) {
      console.error('Error updating milestone:', error);
      alert('Failed to update milestone. Please try again.');
    }
  };

  const handleSMEStartProject = async () => {
    if (!isFirebaseConfigured()) {
      alert('Firebase is not configured.');
      return;
    }
    
    if (userRole !== 'SME') {
      alert('Only SMEs can start projects.');
      return;
    }

    const confirmed = window.confirm(
      'Are you ready to start this project? This will begin tracking your progress.'
    );

    if (!confirmed) return;

    console.log('Starting project...', {
      engagementId: engagement.id,
      userRole,
      userId,
      startDate: engagement.startDate,
      endDate: engagement.endDate
    });

    try {
      const engagementRef = doc(db, 'engagements', engagement.id);
      
      // Update the engagement with start timestamp
      await updateDoc(engagementRef, {
        projectStartedAt: Timestamp.now(),
        progressPercentage: 0,
        updatedAt: Timestamp.now()
      });

      console.log('Project started successfully!');
      
      // Close modal first
      onClose();
      
      // Show success message
      setTimeout(() => {
        alert('✅ Project started! Progress tracking is now active. Please reopen to see the updated progress.');
      }, 300);
      
      // Trigger data refresh
      onUpdate();
    } catch (error: any) {
      console.error('Error starting project:', error);
      alert(`❌ Failed to start project: ${error.message || 'Please check your permissions and try again.'}`);
    }
  };

  const handleSMEMarkComplete = async () => {
    if (!isFirebaseConfigured() || userRole !== 'SME') return;

    const confirmed = window.confirm(
      'Are you sure you want to mark this project as complete? This will notify the SDP for confirmation.'
    );

    if (!confirmed) return;

    try {
      await updateDoc(doc(db, 'engagements', engagement.id), {
        status: 'Awaiting SDP Confirmation',
        smeCompletedAt: Timestamp.now(),
        progressPercentage: 100,
        updatedAt: Timestamp.now()
      });

      alert('Project marked as complete! Awaiting SDP confirmation to release funds.');
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error marking project complete:', error);
      alert('Failed to mark project as complete. Please try again.');
    }
  };

  const handleSDPDispute = async () => {
    if (!isFirebaseConfigured() || userRole !== 'SDP') return;

    const reason = prompt(
      '⚠️ Please describe the issue or concern with the completed work:\n\n(This will notify the SME and hold funds until the dispute is resolved)'
    );

    if (!reason || !reason.trim()) {
      alert('Please provide a reason for the dispute.');
      return;
    }

    const confirmed = window.confirm(
      'Are you sure you want to raise a dispute?\n\nThis will:\n- Hold the payment\n- Notify the SME\n- Change status to "Disputed"\n\nYou can resolve this through chat with the SME.'
    );

    if (!confirmed) return;

    try {
      await updateDoc(doc(db, 'engagements', engagement.id), {
        status: 'Disputed',
        disputedAt: Timestamp.now(),
        disputedBy: userId,
        disputedByName: userName,
        disputeReason: reason.trim(),
        updatedAt: Timestamp.now()
      });

      // Send notification to SME
      if (engagement.smeId) {
        const chatId = [userId, engagement.smeId].sort().join('_');
        await addDoc(collection(db, 'chats', chatId, 'messages'), {
          senderId: userId,
          senderName: userName,
          receiverId: engagement.smeId,
          receiverName: engagement.sme,
          message: `⚠️ DISPUTE RAISED on "${engagement.projectName || engagement.type}"\n\nReason: ${reason}\n\nPlease review the concerns and let's resolve this issue. The payment is currently on hold.`,
          timestamp: Timestamp.now(),
          read: false,
          isDispute: true
        });
      }

      alert('⚠️ Dispute raised. The SME has been notified and funds are on hold. Please discuss with the SME to resolve this issue.');
      onUpdate();
      onClose();
    } catch (error: any) {
      console.error('Error raising dispute:', error);
      alert(`❌ Failed to raise dispute: ${error.message || 'Please try again.'}`);
    }
  };

  const handleSDPResolveDispute = async () => {
    if (!isFirebaseConfigured() || userRole !== 'SDP') return;

    const resolution = prompt(
      '✅ How was the dispute resolved?\n\nPlease describe what was fixed or agreed upon:'
    );

    if (!resolution || !resolution.trim()) {
      alert('Please provide a description of how the dispute was resolved.');
      return;
    }

    const confirmed = window.confirm(
      'Mark this dispute as resolved?\n\nThis will:\n- Change status back to "Awaiting SDP Confirmation"\n- Allow you to confirm completion and release funds\n- Notify the SME that the issues have been addressed'
    );

    if (!confirmed) return;

    try {
      await updateDoc(doc(db, 'engagements', engagement.id), {
        status: 'Awaiting SDP Confirmation',
        disputeResolvedBySDP: true,
        disputeResolutionNotes: resolution.trim(),
        disputeResolvedAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      // Send notification to SME
      if (engagement.smeId) {
        const chatId = [userId, engagement.smeId].sort().join('_');
        await addDoc(collection(db, 'chats', chatId, 'messages'), {
          senderId: userId,
          senderName: userName,
          receiverId: engagement.smeId,
          receiverName: engagement.sme,
          message: `✅ DISPUTE RESOLVED on "${engagement.projectName || engagement.type}"\n\n` +
                   `The SDP has marked the dispute as resolved.\n\n` +
                   `Resolution notes: ${resolution}\n\n` +
                   `The project is now awaiting final confirmation for fund release.`,
          timestamp: Timestamp.now(),
          read: false,
          isResolution: true
        });
      }

      alert('✅ Dispute marked as resolved! You can now confirm completion and release funds.');
      onUpdate();
      onClose();
    } catch (error: any) {
      console.error('Error resolving dispute:', error);
      alert(`❌ Failed to resolve dispute: ${error.message || 'Please try again.'}`);
    }
  };

  const handleSDPConfirmComplete = async () => {
    if (!isFirebaseConfigured() || userRole !== 'SDP') return;

    const confirmed = window.confirm(
      'Are you sure you want to confirm project completion? The admin will verify and confirm the payment to the SME\'s bank account.'
    );

    if (!confirmed) return;

    try {
      await updateDoc(doc(db, 'engagements', engagement.id), {
        status: 'Completed',
        sdpConfirmedAt: Timestamp.now(),
        fundsReleasedAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      // Show rating modal after completion
      setShowRatingModal(true);
      setRating(0);
      setRatingComment('');
      setHoveredRating(0);
      setRatingSuccess(false);
      setIsSubmittingRating(false);
      setIsUpdatingExistingRating(false);

      // Check if user has already rated this SME
      try {
        const existingRatingQuery = query(
          collection(db, 'smeRatings'),
          where('smeId', '==', engagement.smeId),
          where('sdpId', '==', userId)
        );
        const existingRatingSnapshot = await getDocs(existingRatingQuery);
        
        if (!existingRatingSnapshot.empty) {
          const existingRating = existingRatingSnapshot.docs[0].data();
          setRating(existingRating.rating || 0);
          setRatingComment(existingRating.comment || '');
          setIsUpdatingExistingRating(true);
        }
      } catch (error) {
        console.error('Error loading existing rating:', error);
      }

      onUpdate();
    } catch (error) {
      console.error('Error confirming project:', error);
      alert('Failed to confirm project completion. Please try again.');
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
      });

      // Calculate average from unique users' LATEST ratings only
      let totalRating = 0;
      latestRatings.forEach((rating) => {
        totalRating += rating;
      });

      const count = latestRatings.size;
      const averageRating = count > 0 ? Number((totalRating / count).toFixed(1)) : 0.0;

      // Update SME profile in Firestore
      try {
        const smeDocRef = doc(db, 'users', smeId);
        await updateDoc(smeDocRef, {
          'profile.rating': averageRating,
          'profile.reviews': count,
          updatedAt: Timestamp.now()
        });
      } catch (updateError: any) {
        // If direct update fails, try to find the document
        console.warn('Direct update failed, trying alternative method:', updateError);
        const usersSnapshot = await getDocs(collection(db, 'users'));
        let found = false;
        usersSnapshot.forEach((userDoc) => {
          if (userDoc.id === smeId || userDoc.data().profile?.id === smeId) {
            updateDoc(doc(db, 'users', userDoc.id), {
              'profile.rating': averageRating,
              'profile.reviews': count,
              updatedAt: Timestamp.now()
            });
            found = true;
          }
        });
        if (!found) {
          console.error('SME document not found for rating update:', smeId);
        }
      }
    } catch (error) {
      console.error('Error updating SME rating:', error);
    }
  };

  const handleSubmitRating = async () => {
    if (!engagement.smeId || !userId || rating === 0) {
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
        where('smeId', '==', engagement.smeId),
        where('sdpId', '==', userId)
      );
      const existingRatingSnapshot = await getDocs(existingRatingQuery);

      const ratingData = {
        smeId: engagement.smeId,
        sdpId: userId,
        sdpName: userName,
        rating: rating,
        comment: ratingComment || '',
        updatedAt: Timestamp.now()
      };

      if (!existingRatingSnapshot.empty) {
        // Update existing rating
        const existingRatingDoc = existingRatingSnapshot.docs[0];
        await updateDoc(doc(db, 'smeRatings', existingRatingDoc.id), ratingData);
      } else {
        // Create new rating
        await addDoc(collection(db, 'smeRatings'), {
          ...ratingData,
          createdAt: Timestamp.now()
        });
      }

      // Update SME's average rating and review count
      await updateSMERating(engagement.smeId);

      // Create notification for SME
      await createNotification({
        userId: engagement.smeId,
        type: 'rating',
        title: 'New Rating Received',
        message: `${userName} gave you a ${rating} star rating${ratingComment ? ': ' + ratingComment.substring(0, 50) + (ratingComment.length > 50 ? '...' : '') : ''}`,
        link: `/dashboard?tab=profile`,
        metadata: { rating, sdpId: userId, sdpName: userName }
      });

      // Show success state
      setRatingSuccess(true);

      // Close modal after short delay
      setTimeout(() => {
        setShowRatingModal(false);
        setRating(0);
        setRatingComment('');
        setRatingSuccess(false);
        setIsSubmittingRating(false);
        onClose();
      }, 1500);

    } catch (error: any) {
      console.error('Error submitting rating:', error);
      alert('Error submitting rating: ' + error.message);
      setIsSubmittingRating(false);
      setRatingSuccess(false);
    }
  };

  const getMilestoneStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="success" size="sm">Completed</Badge>;
      case 'in_progress':
        return <Badge variant="info" size="sm">In Progress</Badge>;
      case 'pending':
        return <Badge variant="warning" size="sm">Pending</Badge>;
      case 'skipped':
        return <Badge variant="default" size="sm">Skipped</Badge>;
      default:
        return <Badge variant="default" size="sm">{status}</Badge>;
    }
  };

  const isDocumentSigned = (doc: any) => {
    return doc.signedBy && doc.signedBy.includes(userId);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white p-6 border-b border-gray-200 rounded-t-2xl z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {engagement.projectName || engagement.type} - Progress
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {userRole === 'SDP' ? `SME: ${engagement.sme}` : `SDP: ${engagement.sdp}`}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Dispute Alert Banner - Prominent at Top */}
        {engagement.status === 'Disputed' && (engagement as any).disputeReason && (
          <div className="p-6 bg-red-600 border-b-4 border-red-800">
            <div className="flex items-start">
              <AlertCircle className="w-8 h-8 text-white mr-4 mt-1 flex-shrink-0 animate-pulse" />
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white mb-2">
                  ⚠️ PROJECT DISPUTED {userRole === 'SME' ? '- ACTION REQUIRED' : ''}
                </h3>
                <div className="bg-red-700 rounded-lg p-4 mb-3">
                  <p className="text-sm font-semibold text-red-100 mb-2">
                    Raised by: {(engagement as any).disputedByName || 'SDP'} on {(engagement as any).disputedAt ? new Date((engagement as any).disputedAt.seconds * 1000).toLocaleDateString() : 'N/A'}
                  </p>
                  <div className="bg-white rounded p-3">
                    <p className="text-xs font-semibold text-red-900 mb-1">SDP's Concerns:</p>
                    <p className="text-sm text-gray-900 leading-relaxed">
                      "{(engagement as any).disputeReason}"
                    </p>
                  </div>
                </div>
                {userRole === 'SME' ? (
                  <div className="bg-yellow-400 text-yellow-900 rounded-lg p-3 text-sm">
                    <strong>📢 What you need to do:</strong>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li>Review the SDP's concerns carefully</li>
                      <li>Address the issues mentioned above</li>
                      <li>Contact the SDP via chat to discuss and confirm fixes</li>
                      <li>Once resolved, the SDP will mark the dispute as resolved</li>
                    </ul>
                  </div>
                ) : (
                  <p className="text-sm text-red-100">
                    💬 Please discuss with the SME via chat to resolve this dispute. Once issues are fixed, you can mark it as resolved.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        <div className="p-6 bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-lg font-semibold text-gray-900">Project Progress</span>
            <span className="text-2xl font-bold text-blue-600">{progressPercentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-600 h-4 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
              style={{ width: `${progressPercentage}%` }}
            >
              {progressPercentage > 10 && (
                <span className="text-xs font-bold text-white">{progressPercentage}%</span>
              )}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-600 mb-1">Start Date</p>
              <p className="font-semibold text-gray-900">{engagement.startDate}</p>
            </div>
            <div>
              <p className="text-gray-600 mb-1">End Date</p>
              <p className="font-semibold text-gray-900">{engagement.endDate}</p>
            </div>
            <div>
              <p className="text-gray-600 mb-1">Status</p>
              {engagement.status === 'Disputed' ? (
                <Badge variant="danger" className="animate-pulse">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Disputed
                </Badge>
              ) : engagement.status === 'Awaiting SDP Confirmation' ? (
                <Badge variant="warning" className="animate-pulse">
                  <Clock className="w-3 h-3 mr-1" />
                  Awaiting Confirmation
                </Badge>
              ) : engagement.projectStartedAt ? (
                <Badge variant="info">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  In Progress
                </Badge>
              ) : (
                <Badge variant="warning">
                  <Clock className="w-3 h-3 mr-1" />
                  Not Started
                </Badge>
              )}
            </div>
          </div>
          {engagement.projectStartedAt ? (
            <div className="mt-3 text-xs text-green-700 bg-green-50 rounded px-3 py-2">
              ✅ Project Started: {new Date(engagement.projectStartedAt.seconds ? engagement.projectStartedAt.seconds * 1000 : engagement.projectStartedAt).toLocaleString()}
            </div>
          ) : (
            <div className="mt-3 text-xs text-orange-700 bg-orange-50 rounded px-3 py-2">
              ⏳ Project not started yet. {userRole === 'SME' ? 'Click "Start Project" below to begin.' : 'Waiting for SME to start.'}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Milestones Section */}
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <CheckSquare className="w-6 h-6 mr-2 text-blue-600" />
              Project Milestones
            </h3>
            <div className="space-y-3">
              {milestones.length > 0 ? (
                milestones.map((milestone: any, index: number) => (
                  <div
                    key={milestone.id}
                    className={`border rounded-lg p-4 ${
                      milestone.status === 'completed'
                        ? 'bg-green-50 border-green-200'
                        : milestone.status === 'in_progress'
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <span className="text-lg font-semibold text-gray-900">
                            {index + 1}. {milestone.title}
                          </span>
                          {getMilestoneStatusBadge(milestone.status)}
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{milestone.description}</p>
                        {milestone.requiresDocument && (
                          <div className="flex items-center text-xs text-orange-600 mt-2">
                            <FileText className="w-3 h-3 mr-1" />
                            Requires document upload
                          </div>
                        )}
                        {milestone.completedAt && (
                          <p className="text-xs text-gray-500 mt-1">
                            Completed: {new Date(milestone.completedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        {userRole === 'SME' && milestone.status === 'pending' && (
                          <Button
                            size="sm"
                            onClick={() => handleMarkMilestoneInProgress(milestone.id)}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            <PlayCircle className="w-4 h-4 mr-1" />
                            Start
                          </Button>
                        )}
                        {userRole === 'SME' && milestone.status === 'in_progress' && (
                          <Button
                            size="sm"
                            onClick={() => handleMarkMilestoneComplete(milestone.id)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Complete
                          </Button>
                        )}
                        {milestone.status === 'completed' && (
                          <CheckCircle className="w-6 h-6 text-green-600" />
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">No milestones defined for this project.</p>
              )}
            </div>
          </div>

          {/* Documents Section */}
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <FileText className="w-6 h-6 mr-2 text-purple-600" />
              Project Documents
            </h3>

            {/* Upload Document */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <h4 className="font-semibold text-gray-900 mb-3">Upload Document</h4>
              <div className="space-y-3">
                <input
                  type="file"
                  onChange={handleFileSelect}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {milestones.length > 0 && (
                  <select
                    value={milestoneForUpload}
                    onChange={(e) => setMilestoneForUpload(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">General Document (not linked to milestone)</option>
                    {milestones.map((m: any) => (
                      <option key={m.id} value={m.id}>
                        For Milestone: {m.title}
                      </option>
                    ))}
                  </select>
                )}
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={requiresSignature}
                    onChange={(e) => setRequiresSignature(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Requires signature from both parties</span>
                </label>
                <Button
                  onClick={handleUploadDocument}
                  disabled={!selectedFile || uploadingDocument}
                  className="w-full"
                >
                  {uploadingDocument ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Document
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Documents List */}
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center justify-between">
                <span>Uploaded Documents</span>
                <span className="text-sm text-gray-500">
                  {(engagement.documents || []).length} document{(engagement.documents || []).length !== 1 ? 's' : ''}
                </span>
              </h4>
              {(engagement.documents || []).length > 0 ? (
                (engagement.documents || []).map((doc: any) => (
                  <div
                    key={doc.id}
                    className={`border rounded-lg p-4 ${
                      doc.requiresSignature && doc.status === 'uploaded'
                        ? 'bg-yellow-50 border-yellow-200'
                        : doc.status === 'signed'
                        ? 'bg-green-50 border-green-200'
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <FileText className="w-5 h-5 text-gray-600" />
                          <span className="font-semibold text-gray-900">{doc.name}</span>
                          {doc.requiresSignature && (
                            <Badge variant="warning" size="sm">
                              <FileSignature className="w-3 h-3 mr-1" />
                              Signature Required
                            </Badge>
                          )}
                          {doc.status === 'signed' && (
                            <Badge variant="success" size="sm">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Signed
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">
                          Uploaded by: {doc.uploadedByName} • {new Date(doc.uploadedAt).toLocaleDateString()}
                        </p>
                        {doc.milestoneId && (
                          <p className="text-xs text-blue-600 mt-1">
                            Linked to milestone: {milestones.find((m: any) => m.id === doc.milestoneId)?.title}
                          </p>
                        )}
                        {doc.signedByNames && doc.signedByNames.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-semibold text-gray-700">Signed by:</p>
                            <p className="text-xs text-gray-600">{doc.signedByNames.join(', ')}</p>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(doc.url, '_blank')}
                        >
                          <Download className="w-4 h-4 mr-1" />
                          View
                        </Button>
                        {doc.requiresSignature && !isDocumentSigned(doc) && doc.status !== 'signed' && (
                          <Button
                            size="sm"
                            onClick={() => handleSignDocument(doc.id)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <FileSignature className="w-4 h-4 mr-1" />
                            Sign
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">No documents uploaded yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200 rounded-b-2xl flex items-center justify-between">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>

          <div className="flex items-center space-x-3">
            {/* SDP: Edit Project Button (when Pending or not started) */}
            {userRole === 'SDP' && (engagement.status === 'Pending' || (engagement.status === 'In Progress' && !engagement.projectStartedAt)) && (
              <Button
                onClick={() => {
                  onClose();
                  // Trigger edit mode - you can pass the engagement to handleOpenStartProject
                  window.dispatchEvent(new CustomEvent('editProject', { detail: engagement }));
                }}
                className="bg-orange-600 hover:bg-orange-700"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Project Details
              </Button>
            )}

            {/* SME: Start Project Button */}
            {userRole === 'SME' && engagement.status === 'In Progress' && !engagement.projectStartedAt && (
              <Button
                onClick={handleSMEStartProject}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <PlayCircle className="w-4 h-4 mr-2" />
                Start Project
              </Button>
            )}
            
            {/* SME: Mark Complete Button */}
            {userRole === 'SME' && engagement.status === 'In Progress' && engagement.projectStartedAt && !engagement.smeCompletedAt && (
              <Button
                onClick={handleSMEMarkComplete}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Mark Project Complete
              </Button>
            )}
            
            {/* SDP: Resolve Dispute Button (when disputed) */}
            {userRole === 'SDP' && engagement.status === 'Disputed' && (
              <Button
                onClick={handleSDPResolveDispute}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Mark Dispute as Resolved
              </Button>
            )}

            {/* SDP: Dispute & Confirm Buttons */}
            {userRole === 'SDP' && engagement.status === 'Awaiting SDP Confirmation' && (
              <>
                <Button
                  onClick={handleSDPDispute}
                  variant="outline"
                  className="border-red-300 text-red-600 hover:bg-red-50"
                >
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Raise Dispute
                </Button>
                <Button
                  onClick={handleSDPConfirmComplete}
                  className="bg-blue-600 hover:bg-blue-700 animate-pulse"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Confirm & Release Funds
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Rating Modal */}
      {showRatingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Rate SME</h2>
              <button
                onClick={() => {
                  setShowRatingModal(false);
                  setRating(0);
                  setRatingComment('');
                  setRatingSuccess(false);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-gray-700 font-medium mb-2">Rating for: {engagement.sme || engagement.smeName || 'SME'}</p>
              
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
                  setShowRatingModal(false);
                  setRating(0);
                  setRatingComment('');
                  setRatingSuccess(false);
                }}
                disabled={isSubmittingRating}
              >
                Skip
              </Button>
              <Button
                onClick={handleSubmitRating}
                disabled={rating === 0 || isSubmittingRating}
                className={rating === 0 || isSubmittingRating ? 'opacity-50 cursor-not-allowed' : ''}
              >
                {isSubmittingRating ? 'Submitting...' : 'Submit Rating'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

