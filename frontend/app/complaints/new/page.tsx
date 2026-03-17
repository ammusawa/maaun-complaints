'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import Navbar from '@/components/Navbar';
import PublicNavbar from '@/components/PublicNavbar';
import { complaintsApi, CATEGORIES, FEEDBACK_TYPES } from '@/lib/api';
import Image from 'next/image';
import { ImagePlus, X } from 'lucide-react';

const ACCEPTED_TYPES = 'image/jpeg,image/png,image/gif,image/webp';
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const DRAFT_KEY = 'complaint_draft';

function fileToBase64(file: File): Promise<{ base64: string; name: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ base64: reader.result as string, name: file.name });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function base64ToFile(base64: string, filename: string): File {
  const arr = base64.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  const u8arr = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
  return new File([u8arr], filename, { type: mime });
}


export default function NewComplaintPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const LOCATION_OPTIONS: Record<string, string[]> = {
    hostel: [
      'Zainab Najjash Hostel',
      'Hameef Hostel',
      'Dr Bala Hostel',
      'Al ansar Hostel',
    ],
    auditorium: ['Franco British Theatre'],
  };
  const categoryHasPresetLocation = (category: string) =>
    Boolean(LOCATION_OPTIONS[category as keyof typeof LOCATION_OPTIONS]?.length);

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'academic',
    feedback_type: 'complaint',
    department: '',
    location: '',
  });
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Restore draft and auto-submit after login
  useEffect(() => {
    if (!user || authLoading) return;
    const raw = typeof window !== 'undefined' ? sessionStorage.getItem(DRAFT_KEY) : null;
    if (!raw) return;
    let cancelled = false;
    (async () => {
      try {
        const draft = JSON.parse(raw);
        sessionStorage.removeItem(DRAFT_KEY);
        if (!draft.images?.length) {
          setError('Draft had no images. Please fill the form again.');
          return;
        }
        if (categoryHasPresetLocation(draft.category || '')) {
          if (!draft.location) {
            setError('Draft had no location selected. Please fill the form again.');
            return;
          }
        }

        const files = draft.images.map((i: { base64: string; name: string }) =>
          base64ToFile(i.base64, i.name || 'image.jpg')
        );
        setLoading(true);
        const formData = new FormData();
        formData.append('title', draft.title || '');
        formData.append('description', draft.description || '');
        formData.append('category', draft.category || 'academic');
        formData.append('feedback_type', draft.feedback_type || 'complaint');
        if (categoryHasPresetLocation(draft.category || '') && draft.location) {
          formData.append('department', draft.location);
        } else if (draft.department) {
          formData.append('department', draft.department);
        }
        files.forEach((img: File) => formData.append('images', img));
        const { data } = await complaintsApi.create(formData);
        if (!cancelled) router.push(`/complaints/${data.id}`);
      } catch (err: unknown) {
        if (!cancelled) {
          const status = (err as { response?: { status?: number } })?.response?.status;
          setError(status === 429
            ? 'Too many requests. Please wait a moment and try again.'
            : 'Failed to submit saved complaint. Please try again.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, authLoading]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const valid: File[] = [];
    const previews: string[] = [];
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue;
      if (f.size > MAX_SIZE) continue;
      valid.push(f);
      previews.push(URL.createObjectURL(f));
    }
    setImages((prev) => [...prev, ...valid].slice(0, 5));
    setImagePreviews((prev) => [...prev, ...previews].slice(0, 5));
    e.target.value = '';
  };

  const removeImage = (i: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== i));
    URL.revokeObjectURL(imagePreviews[i]);
    setImagePreviews((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (images.length === 0) {
      setError('Please upload at least one proof image (jpg, png, gif, webp, max 5MB each)');
      return;
    }

    if (categoryHasPresetLocation(form.category) && !form.location) {
      setError(`Please select the ${form.category === 'hostel' ? 'hostel' : 'auditorium'} for this complaint.`);
      return;
    }

    if (!user) {
      setLoading(true);
      try {
        const imageData = await Promise.all(images.map((f) => fileToBase64(f)));
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
          ...form,
          images: imageData,
        }));
        router.push('/login?returnTo=/complaints/new');
      } catch {
        setError('Could not save your data. Please try again.');
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('title', form.title);
      formData.append('description', form.description);
      formData.append('category', form.category);
      formData.append('feedback_type', form.feedback_type);
      if (categoryHasPresetLocation(form.category) && form.location) {
        formData.append('department', form.location);
      } else if (form.department) {
        formData.append('department', form.department);
      }
      images.forEach((img) => formData.append('images', img));
      const { data } = await complaintsApi.create(formData);
      router.push(`/complaints/${data.id}`);
    } catch (err: unknown) {
      const res = err as { response?: { status?: number; data?: { detail?: string | Array<{ msg?: string }> } } };
      const status = res?.response?.status;
      const detail = res?.response?.data?.detail;
      let msg = 'Failed to submit complaint';
      if (status === 429) {
        msg = 'Too many requests. Please wait a moment and try again.';
      } else if (typeof detail === 'string') {
        msg = detail;
      } else if (Array.isArray(detail) && detail.length > 0) {
        const first = detail[0];
        msg = (typeof first === 'object' && first?.msg) ? first.msg : String(first);
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="animate-pulse text-stone-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {user ? <Navbar /> : <PublicNavbar />}
      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-[#1e3a5f] mb-2">Submit Complaint / Feedback</h1>
        <p className="text-stone-600 mb-8">
          Report an issue, suggestion, or commendation. {!user && 'You will be prompted to login before submitting.'}
        </p>

        <form onSubmit={handleSubmit} className="card space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Type</label>
            <select
              value={form.feedback_type}
              onChange={(e) => setForm({ ...form, feedback_type: e.target.value })}
              className="input-field"
            >
              {FEEDBACK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Category</label>
            <select
              value={form.category}
              onChange={(e) => {
                const value = e.target.value;
                const hasPreset = categoryHasPresetLocation(value);
                setForm((prev) => ({
                  ...prev,
                  category: value,
                  location: hasPreset ? '' : prev.location,
                  department: hasPreset ? '' : prev.department,
                }));
              }}
              className="input-field"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </div>
          {categoryHasPresetLocation(form.category) ? (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                {form.category === 'hostel' ? 'Hostel' : 'Auditorium'} <span className="text-red-500">*</span>
              </label>
              <select
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="input-field"
                required
              >
                <option value="">Select {form.category === 'hostel' ? 'hostel' : 'auditorium'}</option>
                {LOCATION_OPTIONS[form.category].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <p className="text-xs text-stone-500 mt-1">
                Select the specific {form.category === 'hostel' ? 'hostel' : 'auditorium'} related to this complaint.
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Department / Location (optional)</label>
              <input
                type="text"
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                className="input-field"
                placeholder={form.category === 'class' ? 'e.g. Lecture Hall A' : 'e.g. Computer Science'}
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="input-field"
              required
              placeholder="Brief summary of the issue"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input-field min-h-[120px]"
              required
              placeholder="Provide detailed description..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Proof Images <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-stone-500 mb-2">
              Upload at least one image as proof (jpg, png, gif, webp, max 5MB each, up to 5 images)
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES}
              multiple
              onChange={handleImageChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-stone-300 rounded-lg py-6 flex flex-col items-center gap-2 text-stone-500 hover:border-[#1e3a5f] hover:text-[#1e3a5f] transition-colors"
            >
              <ImagePlus size={32} />
              <span>Click to add proof images</span>
            </button>
            {imagePreviews.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-3">
                {imagePreviews.map((url, i) => (
                  <div key={i} className="relative group">
                    <img src={url} alt={`Preview ${i + 1}`} className="w-20 h-20 object-cover rounded-lg border" />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary flex-1 py-3" disabled={loading}>
              {loading ? 'Submitting...' : !user ? 'Continue to Login' : 'Submit'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="btn-secondary py-3"
            >
              Cancel
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
