"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from 'next/link';
import type { UserConfig, InvoiceSettings } from "../db/schema";

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userConfig, setUserConfig] = useState<Partial<UserConfig>>({});
  const [invoiceSettings, setInvoiceSettings] = useState<Partial<InvoiceSettings>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/signin");
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.id) {
      fetchSettings();
    }
  }, [session]);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/user-config');
      const data = await response.json();
      setUserConfig(data.userConfig || {});
      setInvoiceSettings(data.invoiceSettings || {});
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);

    try {
      await fetch('/api/user-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userConfig,
          invoiceSettings,
        }),
      });
      setSaved(true);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  if (status === "loading" || loading) {
    return <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#1e1b4b] text-[#f1f5f9] flex items-center justify-center">
      <div className="animate-pulse flex flex-col items-center">
        <div className="flex items-center space-x-3 mb-4">
          <img src="/logo.png" alt="NextTime Logo" className="w-8 h-8" />
          <div className="h-8 w-28 bg-[#334155] rounded-md"></div>
        </div>
        <div className="h-4 w-48 bg-[#334155] rounded"></div>
      </div>
    </div>;
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#1e1b4b] text-[#f1f5f9] py-6">
      <header className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <img src="/logo.png" alt="NextTime Logo" className="w-8 h-8" />
            <h1 className="text-3xl tracking-tight font-instrument-serif bg-clip-text text-transparent bg-gradient-to-r from-[#f9a8d4] to-[#93c5fd]">NextTime Settings</h1>
          </div>
          
          {session?.user && (
            <div className="flex items-center space-x-4">
              {session.user.image && (
                <img 
                  src={session.user.image} 
                  alt={session.user.name || 'User'} 
                  className="w-8 h-8 rounded-full border-2 border-[#64748b]/20"
                />
              )}
              <Link 
                href="/"
                className="text-[#94a3b8] hover:text-[#f1f5f9] transition-colors cursor-pointer flex items-center space-x-2 group"
              >
                <span>{session.user.name}</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" clipRule="evenodd" />
                </svg>
              </Link>
              <button
                onClick={() => signOut()}
                className="text-sm text-[#94a3b8] hover:text-[#f1f5f9] transition-colors"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Business Information */}
          <div className="bg-[#1e293b]/70 backdrop-blur-md rounded-xl border border-[#64748b]/20 p-6">
            <div className="flex items-center space-x-2 mb-6">
              <img src="/logo.png" alt="NextTime Logo" className="w-5 h-5" />
              <h2 className="text-xl font-instrument-serif">Business Information</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm text-[#94a3b8] mb-2">Business Name</label>
                <input
                  type="text"
                  value={userConfig.businessName || ''}
                  onChange={(e) => setUserConfig(prev => ({ ...prev, businessName: e.target.value }))}
                  className="w-full bg-[#0f172a] text-[#f1f5f9] rounded-md px-3 py-2 border border-[#64748b]/20 focus:border-[#60a5fa] focus:ring focus:ring-[#60a5fa]/10 transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-[#94a3b8] mb-2">Full Name</label>
                <input
                  type="text"
                  value={userConfig.fullName || ''}
                  onChange={(e) => setUserConfig(prev => ({ ...prev, fullName: e.target.value }))}
                  className="w-full bg-[#0f172a] text-[#f1f5f9] rounded-md px-3 py-2 border border-[#64748b]/20 focus:border-[#60a5fa] focus:ring focus:ring-[#60a5fa]/10 transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-[#94a3b8] mb-2">Email</label>
                <input
                  type="email"
                  value={userConfig.email || ''}
                  onChange={(e) => setUserConfig(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full bg-[#0f172a] text-[#f1f5f9] rounded-md px-3 py-2 border border-[#64748b]/20 focus:border-[#60a5fa] focus:ring focus:ring-[#60a5fa]/10 transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-[#94a3b8] mb-2">Phone</label>
                <input
                  type="tel"
                  value={userConfig.phone || ''}
                  onChange={(e) => setUserConfig(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full bg-[#0f172a] text-[#f1f5f9] rounded-md px-3 py-2 border border-[#64748b]/20 focus:border-[#60a5fa] focus:ring focus:ring-[#60a5fa]/10 transition-all outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-[#94a3b8] mb-2">Address</label>
                <input
                  type="text"
                  value={userConfig.address || ''}
                  onChange={(e) => setUserConfig(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full bg-[#0f172a] text-[#f1f5f9] rounded-md px-3 py-2 border border-[#64748b]/20 focus:border-[#60a5fa] focus:ring focus:ring-[#60a5fa]/10 transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-[#94a3b8] mb-2">City</label>
                <input
                  type="text"
                  value={userConfig.city || ''}
                  onChange={(e) => setUserConfig(prev => ({ ...prev, city: e.target.value }))}
                  className="w-full bg-[#0f172a] text-[#f1f5f9] rounded-md px-3 py-2 border border-[#64748b]/20 focus:border-[#60a5fa] focus:ring focus:ring-[#60a5fa]/10 transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-[#94a3b8] mb-2">State/Province</label>
                <input
                  type="text"
                  value={userConfig.state || ''}
                  onChange={(e) => setUserConfig(prev => ({ ...prev, state: e.target.value }))}
                  className="w-full bg-[#0f172a] text-[#f1f5f9] rounded-md px-3 py-2 border border-[#64748b]/20 focus:border-[#60a5fa] focus:ring focus:ring-[#60a5fa]/10 transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-[#94a3b8] mb-2">ZIP/Postal Code</label>
                <input
                  type="text"
                  value={userConfig.zipCode || ''}
                  onChange={(e) => setUserConfig(prev => ({ ...prev, zipCode: e.target.value }))}
                  className="w-full bg-[#0f172a] text-[#f1f5f9] rounded-md px-3 py-2 border border-[#64748b]/20 focus:border-[#60a5fa] focus:ring focus:ring-[#60a5fa]/10 transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-[#94a3b8] mb-2">Country</label>
                <input
                  type="text"
                  value={userConfig.country || ''}
                  onChange={(e) => setUserConfig(prev => ({ ...prev, country: e.target.value }))}
                  className="w-full bg-[#0f172a] text-[#f1f5f9] rounded-md px-3 py-2 border border-[#64748b]/20 focus:border-[#60a5fa] focus:ring focus:ring-[#60a5fa]/10 transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-[#94a3b8] mb-2">Tax ID (VAT/GST/EIN)</label>
                <input
                  type="text"
                  value={userConfig.taxId || ''}
                  onChange={(e) => setUserConfig(prev => ({ ...prev, taxId: e.target.value }))}
                  className="w-full bg-[#0f172a] text-[#f1f5f9] rounded-md px-3 py-2 border border-[#64748b]/20 focus:border-[#60a5fa] focus:ring focus:ring-[#60a5fa]/10 transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-[#94a3b8] mb-2">Website</label>
                <input
                  type="url"
                  value={userConfig.website || ''}
                  onChange={(e) => setUserConfig(prev => ({ ...prev, website: e.target.value }))}
                  className="w-full bg-[#0f172a] text-[#f1f5f9] rounded-md px-3 py-2 border border-[#64748b]/20 focus:border-[#60a5fa] focus:ring focus:ring-[#60a5fa]/10 transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-[#94a3b8] mb-2">Logo URL</label>
                <input
                  type="url"
                  value={userConfig.logoUrl || ''}
                  onChange={(e) => setUserConfig(prev => ({ ...prev, logoUrl: e.target.value }))}
                  className="w-full bg-[#0f172a] text-[#f1f5f9] rounded-md px-3 py-2 border border-[#64748b]/20 focus:border-[#60a5fa] focus:ring focus:ring-[#60a5fa]/10 transition-all outline-none"
                />
              </div>
            </div>
          </div>

          {/* Invoice Settings */}
          <div className="bg-[#1e293b]/70 backdrop-blur-md rounded-xl border border-[#64748b]/20 p-6">
            <div className="flex items-center space-x-2 mb-6">
              <img src="/logo.png" alt="NextTime Logo" className="w-5 h-5" />
              <h2 className="text-xl font-instrument-serif">Invoice Settings</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm text-[#94a3b8] mb-2">Default Hourly Rate</label>
                <input
                  type="number"
                  step="0.01"
                  value={invoiceSettings.defaultHourlyRate || ''}
                  onChange={(e) => setInvoiceSettings(prev => ({ ...prev, defaultHourlyRate: e.target.value }))}
                  className="w-full bg-[#0f172a] text-[#f1f5f9] rounded-md px-3 py-2 border border-[#64748b]/20 focus:border-[#60a5fa] focus:ring focus:ring-[#60a5fa]/10 transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-[#94a3b8] mb-2">Currency</label>
                <select
                  value={invoiceSettings.currency || 'USD'}
                  onChange={(e) => setInvoiceSettings(prev => ({ ...prev, currency: e.target.value }))}
                  className="w-full bg-[#0f172a] text-[#f1f5f9] rounded-md px-3 py-2 border border-[#64748b]/20 focus:border-[#60a5fa] focus:ring focus:ring-[#60a5fa]/10 transition-all outline-none"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="CAD">CAD ($)</option>
                  <option value="AUD">AUD ($)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-[#94a3b8] mb-2">Default Due Date (Days)</label>
                <input
                  type="number"
                  value={invoiceSettings.defaultDueDate || 30}
                  onChange={(e) => setInvoiceSettings(prev => ({ ...prev, defaultDueDate: parseInt(e.target.value) }))}
                  className="w-full bg-[#0f172a] text-[#f1f5f9] rounded-md px-3 py-2 border border-[#64748b]/20 focus:border-[#60a5fa] focus:ring focus:ring-[#60a5fa]/10 transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-[#94a3b8] mb-2">Invoice Number Prefix</label>
                <input
                  type="text"
                  value={invoiceSettings.invoiceNumberPrefix || 'INV-'}
                  onChange={(e) => setInvoiceSettings(prev => ({ ...prev, invoiceNumberPrefix: e.target.value }))}
                  className="w-full bg-[#0f172a] text-[#f1f5f9] rounded-md px-3 py-2 border border-[#64748b]/20 focus:border-[#60a5fa] focus:ring focus:ring-[#60a5fa]/10 transition-all outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-[#94a3b8] mb-2">Default Payment Terms</label>
                <textarea
                  value={invoiceSettings.paymentTerms || ''}
                  onChange={(e) => setInvoiceSettings(prev => ({ ...prev, paymentTerms: e.target.value }))}
                  rows={3}
                  className="w-full bg-[#0f172a] text-[#f1f5f9] rounded-md px-3 py-2 border border-[#64748b]/20 focus:border-[#60a5fa] focus:ring focus:ring-[#60a5fa]/10 transition-all outline-none"
                  placeholder="e.g., Net 30, Payment due within 30 days"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-[#94a3b8] mb-2">Default Notes</label>
                <textarea
                  value={invoiceSettings.defaultNotes || ''}
                  onChange={(e) => setInvoiceSettings(prev => ({ ...prev, defaultNotes: e.target.value }))}
                  rows={3}
                  className="w-full bg-[#0f172a] text-[#f1f5f9] rounded-md px-3 py-2 border border-[#64748b]/20 focus:border-[#60a5fa] focus:ring focus:ring-[#60a5fa]/10 transition-all outline-none"
                  placeholder="Thank you for your business!"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 text-[#94a3b8] hover:text-[#f1f5f9] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-gradient-to-r from-[#3b82f6] to-[#60a5fa] text-white rounded-md hover:from-[#2563eb] hover:to-[#3b82f6] transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg hover:shadow-[#3b82f6]/20"
            >
              Save Settings
            </button>
          </div>
        </form>

        {saved && (
          <div className="fixed bottom-4 right-4 bg-[#059669] text-white px-4 py-2 rounded-md shadow-lg animate-fadeIn">
            Settings saved successfully!
          </div>
        )}
      </div>
    </div>
  );
} 