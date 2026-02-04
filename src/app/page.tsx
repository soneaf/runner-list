'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<null | 'success' | 'warning' | 'error'>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [warningMessage, setWarningMessage] = useState('');
  const [departments, setDepartments] = useState(['Audio', 'Lighting', 'Video', 'Production', 'Catering', 'Wardrobe']);
  const [todayInfo, setTodayInfo] = useState<{ City: string; Venue: string; Date: string } | null>(null);

  // Fetch dynamic settings (departments & today info)
  useEffect(() => {
    const storedSheetId = localStorage.getItem('custom_sheet_id');
    const headers: HeadersInit = storedSheetId ? { 'x-custom-sheet-id': storedSheetId } : {};

    fetch('/api/settings', { headers })
      .then(res => res.json())
      .then(data => {
        if (data.departments && data.departments.length > 0) setDepartments(data.departments);
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
      name: e.target.name.value,
      mobile: e.target.mobile.value,
      dept: e.target.dept.value,
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
        setStatus('success');
      }

      e.target.reset();
      e.target.reset();
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
            {todayInfo && (
              <div className="mb-4 text-white font-bold text-lg animate-in fade-in slide-in-from-top-4 tracking-wide">
                {todayInfo.Date} • {todayInfo.City} • {todayInfo.Venue}
              </div>
            )}
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
              Runner Request
            </h1>
            <p className="text-gray-400 mt-2 text-sm">Submit your production needs directly to the logistics team.</p>
          </header>

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Name</label>
                <input
                  name="name"
                  placeholder="John Doe"
                  required
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Mobile Number</label>
                <input
                  name="mobile"
                  type="tel"
                  placeholder="(555) 123-4567"
                  required
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Department</label>
              <select name="dept" className="w-full bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all cursor-pointer">
                {departments.map((dept, i) => (
                  <option key={i} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

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
                        onChange={(e) => updateItemDesc(item.id, e.target.value)}
                        placeholder="Details / Description..."
                        className="w-[95%] ml-5 bg-transparent border-0 border-b border-slate-700/50 p-0 pb-2 text-sm text-gray-400 placeholder-gray-600 focus:ring-0 focus:border-indigo-500/50 focus:outline-none transition-all resize-none h-8 min-h-[32px]"
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
            </div>

            <button
              disabled={loading}
              className={`mt-4 w-full py-3.5 rounded-lg font-bold text-white shadow-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] ${loading ? 'bg-gray-600 cursor-not-allowed opacity-70' : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500'
                }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : 'Submit Request'}
            </button>

            {status === 'success' && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm text-center font-medium animate-in fade-in slide-in-from-bottom-2">
                Request sent successfully! check with coordinator.
              </div>
            )}
            {status === 'warning' && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-sm text-center font-medium animate-in fade-in slide-in-from-bottom-2">
                Request sent, but noticed issues: {warningMessage}
              </div>
            )}
            {status === 'error' && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center font-medium animate-in fade-in slide-in-from-bottom-2">
                {errorMessage || 'Error sending request. Please try again.'}
              </div>
            )}
          </form>
        </div>
      </div>
    </main>
  );
}
