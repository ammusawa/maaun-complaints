'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import Navbar from '@/components/Navbar';
import { notificationsApi } from '@/lib/api';

type Notification = {
  id: number;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  complaint_id: number | null;
  is_read: number;
  created_at: string;
};

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (!user) return;

    const load = async () => {
      try {
        const { data } = await notificationsApi.list();
        setNotifications(data);
      } catch {
        setNotifications([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, authLoading, router]);

  const handleMarkRead = async (id: number) => {
    try {
      await notificationsApi.markRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n)));
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('notifications-updated'));
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('notifications-updated'));
    } catch {}
  };

  const typeIcon = (type: string) => {
    if (type === 'complaint_created') return '📥';
    if (type === 'assigned') return '📋';
    if (type === 'case_assigned') return '👤';
    if (type === 'case_audited') return '✅';
    if (type === 'case_repaired') return '🔧';
    if (type === 'case_resolved') return '✔️';
    if (type === 'status_changed') return '🔄';
    if (type === 'response_added') return '💬';
    return '📌';
  };

  if (authLoading) return null;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-[#1e3a5f]">Notifications</h1>
          {notifications.some((n) => !n.is_read) && (
            <button onClick={handleMarkAllRead} className="text-sm text-[#1e3a5f] hover:underline">
              Mark all as read
            </button>
          )}
        </div>

        <div className="card">
          {loading ? (
            <p className="text-stone-500 py-8 text-center">Loading...</p>
          ) : notifications.length === 0 ? (
            <p className="text-stone-500 py-8 text-center">No notifications yet.</p>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => {
                const Wrapper = n.link ? Link : 'div';
                const wrapperProps = n.link ? { href: n.link } : {};
                return (
                  <Wrapper
                    key={n.id}
                    {...wrapperProps}
                    onClick={() => !n.is_read && handleMarkRead(n.id)}
                    className={`block py-4 px-4 -mx-4 hover:bg-stone-50 transition-colors cursor-pointer ${!n.is_read ? 'bg-[#1e3a5f]/5' : ''}`}
                  >
                    <div className="flex gap-3">
                      <span className="text-xl">{typeIcon(n.type)}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium ${!n.is_read ? 'text-stone-900' : 'text-stone-700'}`}>
                          {n.title}
                        </p>
                        {n.message && (
                          <p className="text-sm text-stone-600 mt-0.5 truncate">{n.message}</p>
                        )}
                        <p className="text-xs text-stone-400 mt-1">
                          {new Date(n.created_at).toLocaleString()}
                        </p>
                      </div>
                      {!n.is_read && (
                        <span className="flex-shrink-0 w-2 h-2 rounded-full bg-[#1e3a5f] mt-2" />
                      )}
                    </div>
                  </Wrapper>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
