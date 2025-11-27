import React, { useState, useEffect } from 'react';
import { Bell, Check, X, MessageSquare, Briefcase, DollarSign, AlertCircle, CheckCircle } from 'lucide-react';
import { collection, query, where, onSnapshot, doc, updateDoc, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';

interface Notification {
  id: string;
  userId: string;
  type: 'engagement' | 'message' | 'payment' | 'rating' | 'document' | 'system';
  title: string;
  message: string;
  read: boolean;
  createdAt: any;
  link?: string;
  metadata?: any;
}

interface NotificationDropdownProps {
  userId: string;
}

export function NotificationDropdown({ userId }: NotificationDropdownProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured() || !userId) return;

    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
      const notifs: Notification[] = [];
      snapshot.forEach((docSnap) => {
        notifs.push({
          id: docSnap.id,
          ...docSnap.data()
        } as Notification);
      });
      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.read).length);
    }, (error: any) => {
      if (error.code === 'failed-precondition') {
        // Index missing - try without orderBy
        console.log('ℹ️ Notifications index missing. Using fallback query.');
        const fallbackQuery = query(
          collection(db, 'notifications'),
          where('userId', '==', userId)
        );
        const fallbackUnsubscribe = onSnapshot(fallbackQuery, (snapshot) => {
          const notifs: Notification[] = [];
          snapshot.forEach((docSnap) => {
            notifs.push({
              id: docSnap.id,
              ...docSnap.data()
            } as Notification);
          });
          // Sort manually
          notifs.sort((a, b) => {
            const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
            const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
            return bTime - aTime;
          });
          setNotifications(notifs);
          setUnreadCount(notifs.filter(n => !n.read).length);
        }, (fallbackError) => {
          console.error('Error loading notifications (fallback):', fallbackError);
        });
        return () => fallbackUnsubscribe();
      } else {
        console.error('Error loading notifications:', error);
      }
    });

    return () => unsubscribe();
  }, [userId]);

  const markAsRead = async (notificationId: string) => {
    if (!isFirebaseConfigured()) return;
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        read: true,
        readAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!isFirebaseConfigured()) return;
    try {
      const unreadNotifications = notifications.filter(n => !n.read);
      const promises = unreadNotifications.map(notif => 
        updateDoc(doc(db, 'notifications', notif.id), {
          read: true,
          readAt: Timestamp.now()
        })
      );
      await Promise.all(promises);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'engagement':
        return <Briefcase className="w-4 h-4" />;
      case 'message':
        return <MessageSquare className="w-4 h-4" />;
      case 'payment':
        return <DollarSign className="w-4 h-4" />;
      case 'rating':
        return <CheckCircle className="w-4 h-4" />;
      case 'document':
        return <CheckCircle className="w-4 h-4" />;
      default:
        return <Bell className="w-4 h-4" />;
    }
  };

  const getTimeAgo = (timestamp: any) => {
    if (!timestamp) return 'Recently';
    const now = new Date();
    const time = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return time.toLocaleDateString();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-600 hover:text-blue-600 transition-colors relative"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-96 overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Mark all as read
                </button>
              )}
            </div>

            {/* Notifications List */}
            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">No notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                        !notification.read ? 'bg-blue-50/50' : ''
                      }`}
                      onClick={() => {
                        if (!notification.read) {
                          markAsRead(notification.id);
                        }
                        if (notification.link) {
                          window.location.href = notification.link;
                        }
                        setIsOpen(false);
                      }}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                          notification.type === 'engagement' ? 'bg-blue-100 text-blue-600' :
                          notification.type === 'message' ? 'bg-green-100 text-green-600' :
                          notification.type === 'payment' ? 'bg-purple-100 text-purple-600' :
                          notification.type === 'rating' ? 'bg-yellow-100 text-yellow-600' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${
                            !notification.read ? 'text-gray-900' : 'text-gray-700'
                          }`}>
                            {notification.title}
                          </p>
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {getTimeAgo(notification.createdAt)}
                          </p>
                        </div>
                        {!notification.read && (
                          <div className="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full mt-2" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

