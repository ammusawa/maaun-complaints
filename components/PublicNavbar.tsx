'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Menu, X } from 'lucide-react';
import logo from '../Logo.png';
import { useState } from 'react';

const linkClass = 'text-sm py-1.5 px-2 rounded transition-colors hover:text-[#c62828] hover:bg-white/5';
const registerClass = 'text-sm bg-[#c62828] text-white px-3 py-1.5 rounded-lg font-medium hover:opacity-90 transition-opacity';

export default function PublicNavbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="relative bg-[#1e3a5f] text-white shadow-lg">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex justify-between items-center h-12 min-h-12">
          <Link href="/" className="font-semibold text-base flex items-center gap-2 shrink-0">
            <Image src={logo} alt="MAAUN" width={32} height={32} className="object-contain" />
            Complaints Portal
          </Link>

          <button className="md:hidden p-2 -mr-1" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div
            className={`md:flex md:flex-wrap items-center gap-1 md:gap-3 ${
              open
                ? 'flex flex-col absolute top-12 left-0 right-0 bg-[#1e3a5f] py-3 z-50 shadow-lg border-t border-white/10 [&>a]:py-2.5 [&>a]:px-4 [&>a]:block'
                : 'hidden md:flex'
            }`}
          >
            <Link href="/complaints/new" className={linkClass} onClick={() => setOpen(false)}>
              Submit
            </Link>
            <Link href="/track" className={linkClass} onClick={() => setOpen(false)}>
              Track
            </Link>
            <Link href="/login" className={linkClass} onClick={() => setOpen(false)}>
              Login
            </Link>
            <Link href="/register" className={registerClass} onClick={() => setOpen(false)}>
              Register
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
