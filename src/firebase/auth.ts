import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser,
  updateProfile,
  getIdTokenResult
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions, isFirebaseConfigured } from './config';
import { User, SME, SDP } from '../types';

// Auth service functions
export const authService = {
  // Sign up with email and password
  async signUp(email: string, password: string, userData: Partial<User>) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Update display name
      await updateProfile(user, {
        displayName: userData.profile?.name || email
      });
      
      // Save user data to Firestore
      await setDoc(doc(db, 'users', user.uid), {
        ...userData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      return { user, error: null };
    } catch (error: any) {
      return { user: null, error: error.message };
    }
  },

  // Sign in with email and password
  async signIn(email: string, password: string) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Get user data from Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (!userDoc.exists()) {
        throw new Error('User profile not found in database');
      }

      const userData = userDoc.data();
      
      // Get custom claims (role, verified status)
      const tokenResult = await getIdTokenResult(user);
      const customClaims = tokenResult.claims;
      
      // Return user data as-is from Firebase (ratings managed there)
      return { 
        user: {
          id: user.uid,
          ...userData,
          role: customClaims.role || userData.role,
          verified: customClaims.verified !== undefined ? customClaims.verified : userData.verified
        }, 
        error: null 
      };
    } catch (error: any) {
      return { user: null, error: error.message };
    }
  },

  // Sign out
  async signOutUser() {
    try {
      await signOut(auth);
      return { error: null };
    } catch (error: any) {
      return { error: error.message };
    }
  },

  // Get current user
  getCurrentUser() {
    return auth.currentUser;
  },

  // Get current user data from Firestore
  async getCurrentUserData(): Promise<User | null> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return null;
    }

    try {
      let userDoc;
      try {
        userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      } catch (docError: any) {
        // Ignore AbortError
        if (docError.name === 'AbortError' || docError.message?.includes('aborted')) {
          return null;
        }
        throw docError;
      }
      if (!userDoc.exists()) {
        return null;
      }

      const userData = userDoc.data();
      let tokenResult;
      try {
        tokenResult = await getIdTokenResult(currentUser);
      } catch (tokenError: any) {
        // Ignore AbortError
        if (tokenError.name === 'AbortError' || tokenError.message?.includes('aborted')) {
          return null;
        }
        throw tokenError;
      }
      const customClaims = tokenResult?.claims || {};

      // Return user data as-is from Firebase (ratings managed there)
      return {
        id: currentUser.uid,
        ...userData,
        role: customClaims.role || userData.role,
        verified: customClaims.verified !== undefined ? customClaims.verified : userData.verified
      } as User;
    } catch (error: any) {
      // Ignore AbortError
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        return null;
      }
      console.error('Error fetching user data:', error);
      return null;
    }
  },

  // Listen to auth state changes
  onAuthStateChanged(callback: (user: FirebaseUser | null) => void) {
    return onAuthStateChanged(auth, callback);
  },

  // Initialize demo users (calls Firebase Function)
  async initializeDemoUsers() {
    if (!isFirebaseConfigured()) {
      return { result: null, error: 'Firebase not configured' };
    }
    
    try {
      const initializeDemoUsersPublic = httpsCallable(functions, 'initializeDemoUsersPublic');
      const result = await initializeDemoUsersPublic();
      return { result: result.data, error: null };
    } catch (error: any) {
      return { result: null, error: error.message };
    }
  }
};
