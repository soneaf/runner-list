'use client';
import { useState, useEffect } from 'react';
import Modal from '../components/Modal';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<null | 'success' | 'warning' | 'error'>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [warningMessage, setWarningMessage] = useState('');
  const [departments, setDepartments] = useState(['Audio', 'Lighting', 'Video', 'Production', 'Catering', 'Wardrobe']);
  const [todayInfo, setTodayInfo] = useState<{ City: string; Venue: string; Date: string } | null>(null);
  // Form State
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [dept, setDept] = useState('Audio');
  const [phone, setPhone] = useState('');

  // Phone number formatter: (000) 000-0000
  const formatPhone = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');

    // Format based on length
    if (digits.length <= 3) {
      return digits.length > 0 ? `(${digits}` : '';
    } else if (digits.length <= 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    } else {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setPhone(formatted);
  };

  // Fetch dynamic settings (departments & today info)
  useEffect(() => {
    const storedSheetId = localStorage.getItem('custom_sheet_id');
    const headers: HeadersInit = storedSheetId ? { 'x-custom-sheet-id': storedSheetId } : {};

    fetch('/api/settings', { headers, cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (data.departments && data.departments.length > 0) {
          setDepartments(data.departments);
          setDept(data.departments[0]);
        }
        if (data.todayInfo) setTodayInfo(data.todayInfo);
      })
      .catch(console.error);
  }, []);

  // State for items
  const [items, setItems] = useState([{ id: 1, name: '', desc: '', store: '', link: '', asap: false, imageBase64: '' }]);

  const addItem = () => {
    setItems([...items, { id: Date.now(), name: '', desc: '', store: '', link: '', asap: false, imageBase64: '' }]);
  };

  const removeItem = (id: number) => {
    if (items.length > 1) {
      setItems(items.filter(i => i.id !== id));
    }
  };

  const updateItemName = (id: number, text: string) => {
    setItems(items.map(i => i.id === id ? { ...i, name: text } : i));
  };

  const updateItemDesc = (id: number, text: string) => {
    setItems(items.map(i => i.id === id ? { ...i, desc: text } : i));
  };

  const updateItemStore = (id: number, text: string) => {
    setItems(items.map(i => i.id === id ? { ...i, store: text } : i));
  };

  const updateItemLink = (id: number, text: string) => {
    setItems(items.map(i => i.id === id ? { ...i, link: text } : i));
  };

  const updateItemAsap = (id: number, val: boolean) => {
    setItems(items.map(i => i.id === id ? { ...i, asap: val } : i));
  };

  const handleImageUpload = (id: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setItems(items.map(i => i.id === id ? { ...i, imageBase64: reader.result as string } : i));
      };
      reader.readAsDataURL(file);
    }
  };

  // Step Navigation
  const nextStep = () => {
    if (!name.trim()) return alert("Please enter your name");
    if (!phone.trim()) return alert("Please enter your mobile number");
    setStep(2);
  };

  const prevStep = () => {
    setStep(1);
  };

  async function handleSubmit(e: any) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    // Validate: Item Name is required
    const validItems = items.filter(i => i.name.trim() !== '');
    if (validItems.length === 0) {
      alert("Please enter at least one item name.");
      setLoading(false);
      return;
    }

    const payload = {
      name,
      mobile: phone,
      dept,
      items: validItems.map(({ name, desc, store, link, asap, imageBase64 }) => ({
        desc: (asap ? '🚨 ASAP ' : '') + (desc ? `${name} - ${desc}${link ? `\nLink: ${link}` : ''}` : `${name}${link ? `\nLink: ${link}` : ''}`),
        store: store,
        imageBase64
      })),
    };

    const storedSheetId = localStorage.getItem('custom_sheet_id');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };

    // Sanitize ID to prevent "The string did not match the expected pattern" error
    if (storedSheetId) {
      const cleanId = storedSheetId.trim().replace(/[^\x20-\x7E]/g, ''); // Remove non-printable chars
      if (cleanId) headers['x-custom-sheet-id'] = cleanId;
    }

    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.tip || data.details || 'Failed to submit');

      if (data.warnings && data.warnings.length > 0) {
        setStatus('warning');
        setWarningMessage(data.warnings.join('. '));
      } else {
        setShowSuccessModal(true);
      }

      // Reset Form
      setStep(1);
      setName('');
      setPhone('');
      setDept(departments[0] || 'Audio');
      setItems([{ id: Date.now(), name: '', desc: '', store: '', link: '', asap: false, imageBase64: '' }]); // Reset items
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-transparent bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0b0c15] to-[#0b0c15]">
      <div className="glass-panel w-full max-w-2xl p-8 rounded-2xl border-t border-white/10 shadow-2xl relative overflow-hidden my-10">
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <header className="mb-8 text-center">
            <div className="mb-4 text-white font-bold text-lg animate-in fade-in slide-in-from-top-4 tracking-wide">
              {todayInfo ? (
                <>
                  {(() => {
                    try {
                      const d = new Date(todayInfo.Date);
                      return isNaN(d.getTime()) ? todayInfo.Date : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    } catch { return todayInfo.Date; }
                  })()} • <span className="text-indigo-300">{todayInfo.City}</span> • <span className="text-purple-300">{todayInfo.Venue}</span>
                </>
              ) : (
                <span className="text-gray-300">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
              )}
            </div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
              Runner Request
            </h1>
            <p className="text-gray-400 mt-2 text-sm">Submit your production needs directly to the logistics team.</p>
          </header>

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">

            {/* STEP 1: Crew Info */}
            {step === 1 && (
              <div className="space-y-6 animate-in slide-in-from-right-8 fade-in duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Name</label>
                    <input
                      name="name"
                      placeholder="John Doe"
                      required
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Mobile Number</label>
                    <input
                      name="mobile"
                      type="tel"
                      placeholder="(555) 123-4567"
                      value={phone}
                      onChange={handlePhoneChange}
                      required
                      className="w-full bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Department</label>
                  <select
                    name="dept"
                    value={dept}
                    onChange={e => setDept(e.target.value)}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all cursor-pointer"
                  >
                    {departments.map((d, i) => (
                      <option key={i} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={nextStep}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98] mt-4 flex items-center justify-center gap-2"
                >
                  Next: Add Items <span className="material-symbols-outlined">arrow_forward</span>
                </button>
              </div>
            )}

            {/* STEP 2: Items Needed */}
            {step === 2 && (
              <div className="space-y-6 animate-in slide-in-from-right-8 fade-in duration-300">

                {/* Back Button */}
                <button
                  type="button"
                  onClick={prevStep}
                  className="text-gray-400 hover:text-white flex items-center gap-2 text-sm font-medium transition-colors mb-2"
                >
                  <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                  Back to Crew Info
                </button>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Items Needed</label>
                    <button
                      type="button"
                      onClick={addItem}
                      className="text-xs flex items-center gap-1 bg-indigo-500/20 text-indigo-300 px-3 py-1.5 rounded-full hover:bg-indigo-500/30 transition-colors"
                    >
                      + Add Another Item
                    </button>
                  </div>

                  <div className="space-y-4">
                    {items.map((item, index) => (
                      <div key={item.id} className="group relative bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 transition-all hover:border-indigo-500/30">
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="absolute -top-2 -right-2 bg-slate-800 text-gray-400 hover:text-red-400 p-1 rounded-full border border-slate-600 shadow-sm opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}

                        <div className="flex flex-col gap-3">
                          {/* Name Field */}
                          <input
                            value={item.name}
                            onChange={(e) => updateItemName(item.id, e.target.value)}
                            placeholder={`Item #${index + 1} Name (e.g. Staples)`}
                            className="w-full bg-transparent border-0 border-b border-slate-700 p-0 pb-2 text-white font-semibold placeholder-gray-500 focus:ring-0 focus:border-indigo-500 focus:outline-none transition-all"
                          />

                          {/* Description Field (Indented) */}
                          <textarea
                            value={item.desc}
                            onChange={(e) => {
                              updateItemDesc(item.id, e.target.value);
                              e.target.style.height = 'auto'; // Reset height to calculate scrollHeight
                              e.target.style.height = `${e.target.scrollHeight}px`;
                            }}
                            placeholder="Details / Description..."
                            rows={1}
                            className="w-[95%] ml-5 bg-transparent border-0 border-b border-slate-700/50 p-0 pb-2 text-sm text-gray-400 placeholder-gray-600 focus:ring-0 focus:border-indigo-500/50 focus:outline-none transition-all resize-none overflow-hidden min-h-[32px]"
                          />

                          {/* Link Field (Indented) */}
                          <input
                            type="url"
                            value={item.link || ''}
                            onChange={(e) => updateItemLink(item.id, e.target.value)}
                            placeholder="Item Link (Optional)..."
                            className="w-[95%] ml-5 bg-transparent border-0 border-b border-slate-700/50 p-0 pb-2 text-sm text-indigo-400 placeholder-gray-600 focus:ring-0 focus:border-indigo-500/50 focus:outline-none transition-all"
                          />

                          {/* Store Field (Indented) */}
                          <input
                            value={item.store || ''}
                            onChange={(e) => updateItemStore(item.id, e.target.value)}
                            placeholder="Suggested Store (Optional)..."
                            className="w-[95%] ml-5 bg-transparent border-0 border-b border-slate-700/50 p-0 pb-2 text-sm text-gray-400 placeholder-gray-600 focus:ring-0 focus:border-indigo-500/50 focus:outline-none transition-all"
                          />

                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                              <label className="cursor-pointer flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors">
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(item.id, e)} />
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                {item.imageBase64 ? 'Change Image' : 'Attach Photo'}
                              </label>
                              {item.imageBase64 && (
                                <span className="text-xs text-green-400 flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                  Attached
                                </span>
                              )}
                            </div>

                            {/* ASAP Checkbox */}
                            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-red-400 hover:text-red-300 transition-colors select-none">
                              <input
                                type="checkbox"
                                checked={item.asap || false}
                                onChange={e => updateItemAsap(item.id, e.target.checked)}
                                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-red-500 focus:ring-red-500/50"
                              />
                              ASAP
                            </label>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                  >
                    {loading ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </div>
            )}
            {status === 'success' && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm text-center font-medium animate-in fade-in slide-in-from-bottom-2 mt-4">
                Request sent successfully! check with coordinator.
              </div>
            )}
            {status === 'warning' && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-sm text-center font-medium animate-in fade-in slide-in-from-bottom-2 mt-4">
                Request sent, but noticed issues: {warningMessage}
              </div>
            )}
            {status === 'error' && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center font-medium animate-in fade-in slide-in-from-bottom-2 mt-4">
                {errorMessage || 'Error sending request. Please try again.'}
              </div>
            )}

          </form>
        </div>
      </div>

      <Modal
        isOpen={showSuccessModal}
        title="Success"
        type="success"
        onClose={() => setShowSuccessModal(false)}
        confirmText="New Request"
      >
        Request sent successfully! check with coordinator.
      </Modal>
    </main>
  );
}
