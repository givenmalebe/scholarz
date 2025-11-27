export interface SMEWorkExperience {
  id: string;
  company: string;
  position: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description?: string;
}

export interface SMELanguage {
  language: string;
  proficiency: 'Basic' | 'Conversational' | 'Fluent' | 'Native';
}

export interface SMEReference {
  id: string;
  name: string;
  position?: string;
  company?: string;
  email: string;
  phone: string;
}

export interface SMECV {
  professionalSummary: string;
  workExperience: SMEWorkExperience[];
  languages: SMELanguage[];
  references: SMEReference[];
}

export interface SME {
  id: string;
  name: string;
  email: string;
  roles: string[];
  role?: string; // legacy single role support
  specializations: string[];
  sectors: string[];
  location: string;
  locations?: string[];
  experience: string;
  qualifications: string[];
  qualificationSpecs?: { [key: string]: string };
  otherRole?: string;
  rates: {
    facilitation?: string;
    assessment?: string;
    consultation?: string;
    moderation?: string;
  };
  availability: 'Available' | 'Busy' | 'Offline' | 'Away';
  rating: number;
  reviews: number;
  verified: boolean;
  profileImage: string;
  aboutMe?: string;
  phone?: string;
  setaRegistration?: string;
  setaRegistrations?: { [sector: string]: string };
  documentCertificationDate?: string;
  documentCertificationDates?: {
    idDocuments?: string;
    qualificationCerts?: string;
    setaCertificates?: string;
  };
  documentsCertificationConfirmed?: boolean;
  cv?: SMECV;
  testimonials?: Testimonial[];
  planType?: 'free' | 'monthly' | 'annual';
  planStatus?: 'trial_active' | 'active' | 'pending';
  planActivatedAt?: string;
  planExpiresAt?: string;
  planReference?: string;
}

export interface SDP {
  id: string;
  name: string;
  email: string;
  type: string;
  accreditation: string;
  setaAccreditation?: string;
  accreditationNumber?: string;
  sectorAccreditations?: { [sector: string]: string };
  isAccredited?: 'yes' | 'no';
  accreditationIssueDate?: string;
  accreditationExpiryDate?: string;
  sectors: string[];
  location: string;
  establishedYear: string;
  learners: string;
  verified: boolean;
  assessmentCentre: boolean;
  aboutUs: string;
  services?: string[];
  planType?: 'free' | 'monthly' | 'annual';
  planStatus?: 'trial_active' | 'active' | 'pending';
  planActivatedAt?: string;
  planExpiresAt?: string;
  planReference?: string;
}

export interface ProjectMilestone {
  id: string;
  title: string;
  description: string;
  order: number;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  completedAt?: string;
  completedBy?: string;
  requiresDocument?: boolean;
  documentId?: string;
}

export interface ProjectDocument {
  id: string;
  name: string;
  url: string;
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt: string;
  type: 'general' | 'milestone' | 'signature_required';
  milestoneId?: string;
  signedBy?: string[];
  signedByNames?: string[];
  signedAt?: string;
  requiresSignature?: boolean;
  status: 'pending' | 'uploaded' | 'signed' | 'approved';
}

export interface Engagement {
  id: string;
  sdp: string;
  sdpId?: string;
  sme: string;
  smeId?: string;
  type: string;
  status: 'Pending' | 'In Progress' | 'Awaiting SDP Confirmation' | 'Completed' | 'Cancelled' | 'Disputed';
  startDate: string;
  endDate: string;
  fee: string;
  description: string;
  projectName?: string;
  deliverables?: string;
  milestones?: ProjectMilestone[];
  documents?: ProjectDocument[];
  progressPercentage?: number;
  projectStartedAt?: any;
  smeCompletedAt?: any;
  sdpConfirmedAt?: any;
  fundsReleasedAt?: any;
  paymentConfirmedByAdmin?: boolean;
  paymentConfirmedAt?: any;
  paymentConfirmedBy?: string;
  paymentConfirmationComment?: string;
  disputedAt?: any;
  disputedBy?: string;
  disputedByName?: string;
  disputeReason?: string;
}

export interface Testimonial {
  client: string;
  rating: number;
  comment: string;
}

export interface SearchFilters {
  role?: string;
  sector?: string;
  location?: string;
  availability?: string;
  specialization?: string;
}

export interface User {
  id: string;
  email: string;
  role: 'SME' | 'SDP' | 'Admin';
  profile: SME | SDP;
  verified: boolean;
}

export interface PricingPlan {
  amount: number;
  currency: string;
  description: string;
}

export interface Pricing {
  sme: {
    verification: PricingPlan;
    listing: {
      monthly: PricingPlan;
      annual: PricingPlan;
    };
  };
  sdp: {
    verification: PricingPlan;
    listing: {
      annual: PricingPlan;
    };
    assessmentCentre: {
      monthly: PricingPlan;
    };
  };
  engagement: {
    baseAmount: number;
    platformFee: number;
    currency: string;
    description: string;
  };
}

export interface Project {
  id: string;
  sdpId: string;
  sdpName: string;
  projectName: string;
  projectType: string;
  description: string;
  deliverables: string;
  milestones: ProjectMilestone[];
  budget: string;
  startDate: string;
  endDate: string;
  status: 'open' | 'closed' | 'filled';
  thumbnail?: string; // URL to project thumbnail image
  createdAt: any;
  updatedAt: any;
  applicationsCount?: number;
}

export interface ProjectApplication {
  id: string;
  projectId: string;
  projectName: string;
  smeId: string;
  smeName: string;
  smeEmail: string;
  coverLetter?: string;
  cvUrl?: string; // URL to uploaded CV
  applicationForm?: {
    experience?: string;
    qualifications?: string;
    availability?: string;
    whyInterested?: string;
    relevantSkills?: string;
  };
  status: 'pending' | 'accepted' | 'rejected' | 'invited';
  appliedAt: any;
  reviewedAt?: any;
  reviewedBy?: string;
  rejectionReason?: string;
  invitedBy?: string;
  invitedAt?: any;
}