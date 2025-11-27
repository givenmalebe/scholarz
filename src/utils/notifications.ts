import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';

export interface CreateNotificationParams {
  userId: string;
  type: 'engagement' | 'message' | 'payment' | 'rating' | 'document' | 'system' | 'rejection' | 'verification';
  title: string;
  message: string;
  link?: string;
  metadata?: any;
}

export async function createNotification(params: CreateNotificationParams) {
  if (!isFirebaseConfigured()) {
    console.log('Firebase not configured, skipping notification');
    return;
  }

  try {
    await addDoc(collection(db, 'notifications'), {
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      link: params.link || '',
      metadata: params.metadata || {},
      read: false,
      createdAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Error creating notification:', error);
  }
}

