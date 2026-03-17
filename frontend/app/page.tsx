import Link from 'next/link';
import Image from 'next/image';
import homeImage from '../Home.webp';
import PublicNavbar from '@/components/PublicNavbar';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-stone-100">
      <PublicNavbar />

      <main>
        <div className="relative min-h-[60vh] flex items-center justify-center">
          <Image src={homeImage} alt="MAAUN Campus" className="absolute inset-0 w-full h-full object-cover" priority fill sizes="100vw" />
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative z-10 max-w-4xl mx-auto px-6 py-20 text-center text-white">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 drop-shadow-lg">
              Maryam Abacha American University Nigeria
            </h2>
            <p className="text-xl md:text-2xl text-stone-100 mb-8 drop-shadow-md">
              A structured platform for submitting, tracking, and resolving complaints and feedback.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/login"
                className="btn-primary inline-block py-3 px-8 text-lg bg-white text-[#1e3a5f] hover:bg-stone-100 border-0"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="btn-secondary inline-block py-3 px-8 text-lg bg-[#c62828] text-white hover:bg-red-700 border-0"
              >
                Create Account
              </Link>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-16">
          <div className="grid md:grid-cols-3 gap-8 text-left">
            <Link href="/complaints/new" className="card block hover:shadow-md hover:border-[#1e3a5f]/20 transition-all">
            <h3 className="font-semibold text-[#1e3a5f] mb-2">Submit Complaints</h3>
            <p className="text-stone-600 text-sm">Report issues formally with categories and priority levels. No login required to start.</p>
          </Link>
            <Link href="/track" className="card block hover:shadow-md hover:border-[#1e3a5f]/20 transition-all">
            <h3 className="font-semibold text-[#1e3a5f] mb-2">Track Status</h3>
            <p className="text-stone-600 text-sm">Enter your ticket number to monitor complaint status. No login required.</p>
          </Link>
            <div className="card">
            <h3 className="font-semibold text-[#1e3a5f] mb-2">Transparent Process</h3>
            <p className="text-stone-600 text-sm">Get timely responses and updates from administrators.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
