'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { authApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import logo from '../../Logo.png';

export default function RegisterPage() {
  const [form, setForm] = useState({
    email: '',
    password: '',
    full_name: '',
    matric_number: '',
    department: '',
    role: 'student',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setToken, setUser, user } = useAuth();
  const router = useRouter();
  const justRegistered = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await authApi.register({
        ...form,
        matric_number: form.matric_number || undefined,
        department: form.department || undefined,
        role: form.role,
      });
      setToken(data.access_token);
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('user', JSON.stringify(data.user));
      }
      setUser(data.user);
      justRegistered.current = true;
    } catch (err: unknown) {
      const res = err as { response?: { data?: { detail?: string | Array<{ msg?: string }> } } };
      const detail = res?.response?.data?.detail;
      let msg = 'Registration failed';
      if (typeof detail === 'string') msg = detail;
      else if (Array.isArray(detail) && detail.length > 0) {
        const first = detail[0];
        msg = (typeof first === 'object' && first?.msg) ? first.msg : String(first);
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && justRegistered.current) {
      justRegistered.current = false;
      router.replace('/dashboard');
    }
  }, [user, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100 px-4 py-12">
      <div className="card w-full max-w-md">
        <div className="text-center mb-8">
          <Image src={logo} alt="MAAUN" width={48} height={48} className="mx-auto mb-3 object-contain" />
          <h1 className="text-2xl font-bold text-[#1e3a5f]">Complaints Portal</h1>
          <p className="text-stone-600 mt-1">Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Full Name</label>
            <input
              type="text"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="input-field"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input-field"
              required
              placeholder="you@maaun.edu.ng"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="input-field"
              required
              minLength={6}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Matric Number (optional)</label>
            <input
              type="text"
              value={form.matric_number}
              onChange={(e) => setForm({ ...form, matric_number: e.target.value })}
              className="input-field"
              placeholder="e.g. MAAUN/2021/001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Department (optional)</label>
            <input
              type="text"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              className="input-field"
              placeholder="e.g. Computer Science"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="input-field"
            >
              <option value="student">Student</option>
              <option value="staff">Staff</option>
            </select>
          </div>
          <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="mt-6 text-center text-stone-600 text-sm">
          Already have an account?{' '}
          <Link href="/login" className="text-[#1e3a5f] font-medium hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
