import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';

admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();

// Configure email transporter
// For production, use environment variables or a service like SendGrid
const createTransporter = () => {
  // Check if email credentials are configured
  const emailUser = functions.config().email?.user || process.env.EMAIL_USER;
  const emailPass = functions.config().email?.password || process.env.EMAIL_PASSWORD;
  const emailHost = functions.config().email?.host || process.env.EMAIL_HOST || 'smtp.gmail.com';
  const emailPort = functions.config().email?.port || process.env.EMAIL_PORT || 587;

  if (!emailUser || !emailPass) {
    console.warn('Email credentials not configured. Email notifications will be skipped.');
    return null;
  }

  return nodemailer.createTransport({
    host: emailHost,
    port: parseInt(emailPort.toString()),
    secure: false, // true for 465, false for other ports
    auth: {
      user: emailUser,
      pass: emailPass
    }
  });
};

// Helper function to format email HTML
const formatEmailHTML = (notification: any, userName: string): string => {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'engagement': return '📋';
      case 'message': return '💬';
      case 'payment': return '💰';
      case 'rating': return '⭐';
      case 'document': return '📄';
      case 'system': return '🔔';
      case 'rejection': return '❌';
      case 'verification': return '✅';
      default: return '🔔';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'engagement': return '#6366f1';
      case 'message': return '#3b82f6';
      case 'payment': return '#10b981';
      case 'rating': return '#f59e0b';
      case 'document': return '#8b5cf6';
      case 'system': return '#6b7280';
      case 'rejection': return '#ef4444';
      case 'verification': return '#10b981';
      default: return '#6b7280';
    }
  };

  const typeColor = getTypeColor(notification.type);
  const typeIcon = getTypeIcon(notification.type);
  const dashboardUrl = notification.link 
    ? `https://link-my-skills.web.app${notification.link}` 
    : 'https://link-my-skills.web.app';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${notification.title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-collapse: collapse;">
          <!-- Header -->
          <tr>
            <td style="padding: 30px 30px 20px; background: linear-gradient(135deg, ${typeColor} 0%, ${typeColor}dd 100%); border-radius: 8px 8px 0 0;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td>
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600; display: flex; align-items: center; gap: 10px;">
                      <span style="font-size: 32px;">${typeIcon}</span>
                      <span>Scholarz</span>
                    </h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                    Hello ${userName},
              </p>
              
              <div style="background-color: #f9fafb; border-left: 4px solid ${typeColor}; padding: 20px; margin: 20px 0; border-radius: 4px;">
                <h2 style="margin: 0 0 10px; color: #111827; font-size: 20px; font-weight: 600;">
                  ${notification.title}
                </h2>
                <p style="margin: 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                  ${notification.message}
                </p>
              </div>
              
              ${notification.link ? `
              <table role="presentation" style="width: 100%; margin: 30px 0; border-collapse: collapse;">
                <tr>
                  <td align="center">
                    <a href="${dashboardUrl}" style="display: inline-block; padding: 14px 28px; background-color: ${typeColor}; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                      View Details
                    </a>
                  </td>
                </tr>
              </table>
              ` : ''}
              
              <p style="margin: 30px 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                This is an automated notification from Scholarz. You can manage your notification preferences in your dashboard settings.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 30px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-align: center; line-height: 1.6;">
                © ${new Date().getFullYear()} Scholarz. All rights reserved.<br>
                <a href="https://link-my-skills.web.app" style="color: ${typeColor}; text-decoration: none;">Visit Dashboard</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

// Interface for demo user data
interface DemoUser {
  email: string;
  password: string;
  role: 'SME' | 'SDP' | 'Admin';
  profile: any;
  verified: boolean;
}

// Demo users data
const demoUsers: DemoUser[] = [
  {
    email: 'thabo.mthembu@email.com',
    password: 'demo123',
    role: 'SME',
    verified: true,
    profile: {
      id: 'sme-001',
      name: 'Dr. Thabo Mthembu',
      email: 'thabo.mthembu@email.com',
      role: 'Senior Facilitator & Assessor',
      specializations: ['Business Management', 'Leadership Development', 'Project Management'],
      sectors: ['Manufacturing', 'Services', 'Mining'],
      location: 'Johannesburg, Gauteng',
      experience: '15+ years',
      qualifications: [
        'PhD in Business Administration',
        'ETDP SETA Registered Facilitator',
        'PMP Certified Project Manager',
        'NQF Level 8 Qualification'
      ],
      rates: {
        facilitation: 'R1,500/day',
        assessment: 'R800/day',
        consultation: 'R1,200/day',
        moderation: 'R1,000/day'
      },
      availability: 'Available',
      rating: 0.0,
      reviews: 0,
      verified: true,
      profileImage: '/images/profile-1.jpg',
      aboutMe: 'Experienced facilitator with a passion for developing leadership capabilities in emerging managers.'
    }
  },
  {
    email: 'admin@sdi.co.za',
    password: 'demo123',
    role: 'SDP',
    verified: true,
    profile: {
      id: 'sdp-001',
      name: 'Skills Development Institute',
      email: 'admin@sdi.co.za',
      type: 'Private Training Provider',
      accreditation: 'ETDP SETA Accredited',
      sectors: ['Business', 'Management', 'Leadership'],
      location: 'Johannesburg, Gauteng',
      establishedYear: '2015',
      learners: '2,500+ annually',
      verified: true,
      assessmentCentre: true,
      aboutUs: 'Leading provider of business and management skills development programs.',
      services: ['Learnerships', 'Skills Programmes', 'Short Courses', 'Assessment Services']
    }
  },
  {
    email: 'admin@edulinker.co.za',
    password: 'demo123',
    role: 'Admin',
    verified: true,
    profile: {
      id: 'admin-001',
      name: 'Admin User',
      email: 'admin@edulinker.co.za',
      role: 'Administrator',
      specializations: ['Platform Management', 'User Support'],
      sectors: ['Administration'],
      location: 'Head Office',
      experience: 'Admin',
      qualifications: ['Platform Administrator'],
      rates: {},
      availability: 'Available',
      rating: 0.0,
      reviews: 0,
      verified: true,
      profileImage: '/images/profile-admin.jpg',
      aboutMe: 'Platform administrator for Scholarz'
    }
  }
];

/**
 * Initialize demo users - creates Firebase Auth users and Firestore documents
 * This function should be called once to set up the demo accounts
 */
export const initializeDemoUsers = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated and is admin
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to initialize demo users'
    );
  }

  // Check if user is admin (you can add more sophisticated admin check)
  const userDoc = await db.collection('users').doc(context.auth.uid).get();
  const userData = userDoc.data();
  
  if (userData?.role !== 'Admin') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only admin users can initialize demo users'
    );
  }

  const results = [];

  for (const demoUser of demoUsers) {
    try {
      // Check if user already exists
      let userRecord;
      try {
        userRecord = await auth.getUserByEmail(demoUser.email);
      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          // User doesn't exist, create it
          userRecord = await auth.createUser({
            email: demoUser.email,
            password: demoUser.password,
            emailVerified: true,
            displayName: demoUser.profile.name
          });
        } else {
          throw error;
        }
      }

      // Update password if user exists (in case it was changed)
      await auth.updateUser(userRecord.uid, {
        password: demoUser.password
      });

      // Set custom claims for role-based access
      await auth.setCustomUserClaims(userRecord.uid, {
        role: demoUser.role,
        verified: demoUser.verified
      });

      // Create or update user document in Firestore
      await db.collection('users').doc(userRecord.uid).set({
        id: userRecord.uid,
        email: demoUser.email,
        role: demoUser.role,
        profile: demoUser.profile,
        verified: demoUser.verified,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      results.push({
        email: demoUser.email,
        role: demoUser.role,
        status: 'success',
        uid: userRecord.uid
      });
    } catch (error: any) {
      results.push({
        email: demoUser.email,
        role: demoUser.role,
        status: 'error',
        error: error.message
      });
    }
  }

  return {
    message: 'Demo users initialization completed',
    results
  };
});

/**
 * Public function to initialize demo users (for first-time setup)
 * This can be called without authentication for initial setup
 * CORS is automatically handled for onCall functions
 */
export const initializeDemoUsersPublic = functions.https.onCall(async (data, context) => {
  // Only allow if no users exist yet (first-time setup)
  const usersSnapshot = await db.collection('users').limit(1).get();
  
  if (!usersSnapshot.empty) {
    throw new functions.https.HttpsError(
      'already-exists',
      'Users already exist. Use initializeDemoUsers function instead.'
    );
  }

  const results = [];

  for (const demoUser of demoUsers) {
    try {
      // Create Firebase Auth user
      const userRecord = await auth.createUser({
        email: demoUser.email,
        password: demoUser.password,
        emailVerified: true,
        displayName: demoUser.profile.name
      });

      // Set custom claims for role-based access
      await auth.setCustomUserClaims(userRecord.uid, {
        role: demoUser.role,
        verified: demoUser.verified
      });

      // Create user document in Firestore
      await db.collection('users').doc(userRecord.uid).set({
        id: userRecord.uid,
        email: demoUser.email,
        role: demoUser.role,
        profile: demoUser.profile,
        verified: demoUser.verified,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      results.push({
        email: demoUser.email,
        role: demoUser.role,
        status: 'success',
        uid: userRecord.uid
      });
    } catch (error: any) {
      results.push({
        email: demoUser.email,
        role: demoUser.role,
        status: 'error',
        error: error.message
      });
    }
  }

  return {
    message: 'Demo users initialized successfully',
    results
  };
});

interface PayfastInitRequest {
  amount: number;
  currency?: string;
  planId: string;
  billingType: 'trial' | 'subscription' | 'once_off';
  role: 'sme' | 'sdp';
  customer?: {
    name?: string;
    email?: string;
  };
  returnUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, any>;
}

export const initiatePayfastPayment = functions.https.onCall(async (data: PayfastInitRequest, context) => {
  if (!data || typeof data.amount !== 'number' || !data.planId || !data.billingType) {
    throw new functions.https.HttpsError('invalid-argument', 'Amount, planId and billingType are required.');
  }

  // TODO: Replace this mock implementation with actual PayFast API integration once
  // merchant credentials are configured. For now we simply simulate the response so
  // that the frontend payment step can be completed.
  const paymentId = `PF-${Date.now()}`;
  const paymentUrl = `https://sandbox.payfast.co.za/eng/process?token=${paymentId}`;
  const currency = data.currency || 'ZAR';
  const isFreePlan = data.amount === 0;

  const responsePayload = {
    paymentId,
    paymentUrl,
    paymentStatus: isFreePlan ? 'PAID' : 'PENDING',
    amount: data.amount,
    currency,
    billingType: data.billingType,
    role: data.role,
    planId: data.planId,
    customer: data.customer || null,
    // Free & trial plans get a default 30-day expiry to support dashboard timers
    expiresAt: data.billingType === 'trial'
      ? admin.firestore.Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
      : null,
    message: isFreePlan
      ? 'Trial activated. No payment required.'
      : 'Redirect the user to PayFast to complete payment.'
  };

  return responsePayload;
});

/**
 * Get user profile from Firestore
 */
export const getUserProfile = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated'
    );
  }

  const userDoc = await db.collection('users').doc(context.auth.uid).get();
  
  if (!userDoc.exists) {
    throw new functions.https.HttpsError(
      'not-found',
      'User profile not found'
    );
  }

  return {
    id: userDoc.id,
    ...userDoc.data()
  };
});

/**
 * Set admin custom claims for a user
 * This is called when a new admin account is created via the registration form
 * Note: This function can be called without authentication during registration,
 * but requires an admin key for security
 */
export const setAdminClaims = functions.https.onCall(async (data, context) => {
  const { uid, adminKey } = data;
  
  if (!uid) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'UID is required'
    );
  }

  // If user is authenticated, verify they're setting claims for themselves or are an admin
  if (context.auth) {
    if (context.auth.uid !== uid) {
      // Check if the caller is already an admin
      const callerDoc = await db.collection('users').doc(context.auth.uid).get();
      const callerData = callerDoc.data();
      
      if (callerData?.role !== 'Admin') {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Only admins can set claims for other users'
        );
      }
    }
  } else {
    // If not authenticated, require admin key for security
    const validAdminKey = process.env.ADMIN_REGISTRATION_KEY || 'ADMIN2024';
    if (!adminKey || adminKey !== validAdminKey) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Admin registration key required'
      );
    }
  }

  // Verify the target user has Admin role in Firestore
  const userDoc = await db.collection('users').doc(uid).get();
  const userData = userDoc.data();
  
  if (userData?.role !== 'Admin') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'User must have Admin role in Firestore'
    );
  }

  try {
    // Set custom claims
    await auth.setCustomUserClaims(uid, {
      role: 'Admin',
      verified: true,
      admin: true
    });

    return {
      success: true,
      message: 'Admin claims set successfully'
    };
  } catch (error: any) {
    throw new functions.https.HttpsError(
      'internal',
      `Failed to set admin claims: ${error.message}`
    );
  }
});

/**
 * Send email notification when a notification is created
 * This function triggers automatically when a new document is added to the notifications collection
 */
export const sendNotificationEmail = functions.firestore
  .document('notifications/{notificationId}')
  .onCreate(async (snap, context) => {
    const notification = snap.data();
    
    // Skip if email sending is disabled or credentials not configured
    const transporter = createTransporter();
    if (!transporter) {
      console.log('Email transporter not configured, skipping email notification');
      return null;
    }

    try {
      // Fetch user data to get email and name
      const userDoc = await db.collection('users').doc(notification.userId).get();
      
      if (!userDoc.exists) {
        console.error(`User ${notification.userId} not found`);
        return null;
      }

      const userData = userDoc.data();
      const userEmail = userData?.email || userData?.profile?.email;
      const userName = userData?.profile?.name || userData?.email?.split('@')[0] || 'User';

      if (!userEmail) {
        console.error(`No email found for user ${notification.userId}`);
        return null;
      }

      // Prepare email
      const emailHTML = formatEmailHTML(notification, userName);
      const dashboardUrl = notification.link 
        ? `https://link-my-skills.web.app${notification.link}` 
        : 'https://link-my-skills.web.app';

      const mailOptions = {
        from: `"Scholarz" <${functions.config().email?.user || process.env.EMAIL_USER}>`,
        to: userEmail,
        subject: `🔔 ${notification.title}`,
        html: emailHTML,
        text: `Hello ${userName},\n\n${notification.title}\n\n${notification.message}\n\n${notification.link ? `View Details: ${dashboardUrl}` : ''}\n\nThis is an automated notification from Scholarz.`
      };

      // Send email
      const info = await transporter.sendMail(mailOptions);
      console.log(`Email sent successfully to ${userEmail}:`, info.messageId);
      
      return null;
    } catch (error: any) {
      console.error('Error sending notification email:', error);
      // Don't throw error to prevent retries - log and continue
      return null;
    }
  });

