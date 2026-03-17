'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/auth-context';
import logo from '../../Logo.png';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/dashboard';
  const justLoggedIn = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      justLoggedIn.current = true;
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { detail?: string | Array<{ msg?: string }> }; status?: number }; message?: string; code?: string };
      let msg = 'Login failed';
      if (!ax.response) {
        if (ax.code === 'ECONNABORTED' || ax.message?.toLowerCase().includes('timeout')) {
          msg = 'Request timed out. Please check your connection and try again.';
        } else {
          msg = 'Unable to connect. Please check your connection and try again.';
        }
      } else if (ax.response.status && ax.response.status >= 500) {
        msg = 'Server error. Please try again later.';
      } else {
        const detail = ax.response?.data?.detail;
        if (typeof detail === 'string') msg = detail;
        else if (Array.isArray(detail) && detail.length > 0) {
          const first = detail[0];
          msg = (typeof first === 'object' && first?.msg) ? first.msg : String(first);
        } else if (ax.response?.status === 401) {
          msg = 'Incorrect email or password.';
        }
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && justLoggedIn.current) {
      justLoggedIn.current = false;
      router.replace(returnTo);
    }
  }, [user, router, returnTo]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100 px-4">
      <div className="card w-full max-w-md">
        <div className="text-center mb-8">
          <Image src={logo} alt="MAAUN" width={48} height={48} className="mx-auto mb-3 object-contain" />
          <h1 className="text-2xl font-bold text-[#1e3a5f]">Complaints Portal</h1>
          <p className="text-stone-600 mt-1">Sign in to your account</p>
        </div>

        {returnTo === '/complaints/new' && (
          <div className="bg-green-50 text-green-800 px-3 py-2 rounded-lg text-sm mb-4">
            Your complaint data has been saved. Login to submit.
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              required
              placeholder="you@maaun.edu.ng"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              required
            />
          </div>
          <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-6 text-center text-stone-600 text-sm">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-[#1e3a5f] font-medium hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
