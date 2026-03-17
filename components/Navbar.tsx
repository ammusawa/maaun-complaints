'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Bell, LogOut, Menu, X } from 'lucide-react';
import logo from '../Logo.png';
import { useState, useEffect } from 'react';
import { notificationsApi } from '@/lib/api';
import LogoutModal from '@/components/LogoutModal';

const navLinkClass = (pathname: string, href: string) => {
  const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
  return `text-sm py-1.5 px-1 transition-colors whitespace-nowrap rounded ${isActive ? 'text-[#c62828] font-medium' : 'hover:text-[#c62828] hover:bg-white/5'}`;
};

export default function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnread = () => {
    notificationsApi.unreadCount()
      .then((res) => setUnreadCount(res.data.count))
      .catch(() => {});
  };

  useEffect(() => {
    if (!user) return;
    refreshUnread();
    const handler = () => refreshUnread();
    window.addEventListener('notifications-updated', handler);
    return () => window.removeEventListener('notifications-updated', handler);
  }, [user]);

  if (!user) return null;

  return (
    <nav className="bg-[#1e3a5f] text-white shadow-lg">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex justify-between items-center h-12 min-h-12">
          <Link href="/dashboard" className="font-semibold text-base flex items-center gap-2 shrink-0">
            <Image src={logo} alt="MAAUN" width={32} height={32} className="object-contain" />
            Complaints Portal
          </Link>

          <button className="md:hidden p-2 -mr-1" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div className={`md:flex md:flex-wrap items-center gap-1 md:gap-3 ${open ? 'flex flex-col absolute top-12 left-0 right-0 bg-[#1e3a5f] py-3 z-50 shadow-lg border-t border-white/10 [&>a]:py-2.5 [&>a]:px-4 [&>a]:block' : 'hidden md:flex'}`}>
            <Link href="/notifications" className={`relative p-1 ${navLinkClass(pathname, '/notifications')}`} title="Notifications">
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 flex items-center justify-center text-[10px] font-semibold bg-[#c62828] text-white rounded-full">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
            <Link href="/dashboard" className={navLinkClass(pathname, '/dashboard')}>Dashboard</Link>
            {['student', 'staff'].includes(user.role) && (
              <>
                <Link href="/complaints/new" className={navLinkClass(pathname, '/complaints/new')}>Submit</Link>
                <Link href="/my-complaints" className={navLinkClass(pathname, '/my-complaints')}>My Complaints</Link>
              </>
            )}
            {['management', 'admin'].includes(user.role) && (
              <>
                <Link href="/management" className={navLinkClass(pathname, '/management')} title="Manage Complaints">Complaints</Link>
                <Link href="/analytics" className={navLinkClass(pathname, '/analytics')}>Analytics</Link>
                <Link href="/users" className={navLinkClass(pathname, '/users')} title="User Management">Users</Link>
              </>
            )}
            {['auditor', 'admin'].includes(user.role) && (
              <Link href="/auditor" className={navLinkClass(pathname, '/auditor')}>Audits</Link>
            )}
            {['maintenance_officer', 'admin'].includes(user.role) && (
              <Link href="/maintenance" className={navLinkClass(pathname, '/maintenance')}>Assignments</Link>
            )}
            <span className="text-stone-300 text-xs truncate max-w-[100px] md:max-w-[120px]" title={user.full_name}>{user.full_name}</span>
            <button
              onClick={() => { setOpen(false); setLogoutModalOpen(true); }}
              className="flex items-center gap-1.5 text-sm hover:text-red-300 transition-colors shrink-0"
            >
              <LogOut size={16} /> Logout
            </button>
          </div>
        </div>
      </div>
      <LogoutModal
        open={logoutModalOpen}
        onClose={() => setLogoutModalOpen(false)}
        onConfirm={() => { setLogoutModalOpen(false); logout(); }}
      />
    </nav>
  );
}
