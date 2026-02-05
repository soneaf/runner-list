'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Papa from 'papaparse'; // CSV Parser
import Modal from '../../components/Modal';

const colors = ['#6366f1', '#10b981', '#f43f5e', '#f59e0b', '#06b6d4', '#a855f7', '#ec4899', '#3b82f6', '#84cc16', '#f97316'];

function SettingsContent() {
    const searchParams = useSearchParams();
    const [runnerName, setRunnerName] = useState('');
    const [runnerPhone, setRunnerPhone] = useState('');
    const [runnerCity, setRunnerCity] = useState(''); // Added City State
    const [runnerCash, setRunnerCash] = useState('0'); // Cash float for runner
    const [runnerContactType, setRunnerContactType] = useState('cell');
    const [runners, setRunners] = useState<any[]>([]);
    const [editingRunnerOldName, setEditingRunnerOldName] = useState<string | null>(null);

    // Color State
    // Color State
    const [runnerColor, setRunnerColor] = useState(colors[0]);

    // Sequential Color Logic
    useEffect(() => {
        if (!editingRunnerOldName) {
            setRunnerColor(colors[runners.length % colors.length]);
        }
    }, [runners.length, editingRunnerOldName]);

    // Department State
    const [departments, setDepartments] = useState<string[]>([]);
    const [newDept, setNewDept] = useState('');

    // CSV Mapping State
    const [uploadStatus, setUploadStatus] = useState('');
    const [csvStep, setCsvStep] = useState<'upload' | 'map'>('upload');
    const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
    const [csvData, setCsvData] = useState<any[]>([]);
    const [mapping, setMapping] = useState({ date: '', city: '', venue: '' });

    // App Setup State
    const [activeSettingTab, setActiveSettingTab] = useState<'Runners' | 'Departments' | 'Tour Schedule' | 'App Setup' | 'Help'>('Runners');
    const [sheetId, setSheetId] = useState('');

    useEffect(() => {
        const tab = searchParams.get('tab');
        const hasId = localStorage.getItem('custom_sheet_id');

        if (tab && ['Runners', 'Departments', 'Tour Schedule', 'App Setup', 'Help'].includes(tab)) {
            setActiveSettingTab(tab as any);
        } else if (!hasId) {
            // New user experience: Default to Setup
            setActiveSettingTab('App Setup');
        }
    }, [searchParams]);

    const [serviceEmail, setServiceEmail] = useState('runner-app-service-account@your-project.iam.gserviceaccount.com');

    // Modal State
    const [modal, setModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        type: 'danger' as 'danger' | 'info' | 'success',
        onConfirm: undefined as (() => void) | undefined
    });

    const closeModal = () => setModal(prev => ({ ...prev, isOpen: false }));
    const showInfo = (title: string, message: string, type: 'info' | 'success' | 'danger' = 'info') => {
        setModal({ isOpen: true, title, message, type, onConfirm: undefined });
    };
    const showConfirm = (title: string, message: string, onConfirm: () => void) => {
        setModal({ isOpen: true, title, message, type: 'danger', onConfirm });
    };

    useEffect(() => {
        // Load stored Sheet ID
        const storedSheetId = localStorage.getItem('custom_sheet_id');
        if (storedSheetId) setSheetId(storedSheetId);

        // Load tour schedule from localStorage
        const storedSchedule = localStorage.getItem('tour_schedule');
        if (storedSchedule) {
            try { setSchedule(JSON.parse(storedSchedule)); } catch { }
        }

        fetchSettings();
    }, []);

    // Schedule State
    const [schedule, setSchedule] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    async function fetchSettings() {
        try {
            const storedSheetId = localStorage.getItem('custom_sheet_id');
            const headers: HeadersInit = storedSheetId ? { 'x-custom-sheet-id': storedSheetId } : {};

            const res = await fetch('/api/settings', { headers });
            const data = await res.json();
            if (data.runners) setRunners(data.runners);
            if (data.departments) setDepartments(data.departments);
            if (data.serviceEmail) setServiceEmail(data.serviceEmail);
            if (data.schedule) setSchedule(data.schedule);
        } catch (e) {
            console.error(e);
        }
    }

    // 1. Add or Update Runner
    async function addRunner() {
        if (!runnerName || !runnerPhone) {
            return showInfo('Validation Error', 'Please enter both a Name and a Phone number.');
        }

        const storedSheetId = localStorage.getItem('custom_sheet_id');
        const headers: HeadersInit = storedSheetId ? { 'x-custom-sheet-id': storedSheetId } : {};

        if (editingRunnerOldName) {
            // Update Mode
            await fetch('/api/settings', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    type: 'update_runner',
                    originalName: editingRunnerOldName,
                    name: runnerName,
                    phone: runnerPhone,
                    city: runnerCity,
                    cash: runnerCash !== '' ? parseFloat(runnerCash) : 0,
                    contactType: runnerContactType,
                    color: runnerColor
                }),
            });
            showInfo('Success', 'Runner updated successfully!', 'success');
        } else {
            // Add Mode
            await fetch('/api/settings', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    type: 'runner',
                    name: runnerName,
                    phone: runnerPhone,
                    city: runnerCity,
                    cash: runnerCash !== '' ? parseFloat(runnerCash) : 0,
                    contactType: runnerContactType,
                    color: runnerColor
                }),
            });
            showInfo('Success', 'Runner added successfully!', 'success');
        }

        cancelEditing();
        fetchSettings();
    }

    function startEditing(r: any) {
        setRunnerName(r.name);
        setRunnerPhone(r.phone);
        setRunnerCity(r.city || '');
        setRunnerCash(r.cash?.toString() || '0');
        setRunnerContactType(r.contactType || 'cell');
        setRunnerColor(r.color || colors[Math.floor(Math.random() * colors.length)]);
        setEditingRunnerOldName(r.name);

        // Scroll to form
        const form = document.getElementById('runner-form');
        if (form) form.scrollIntoView({ behavior: 'smooth' });
    }

    function cancelEditing() {
        setRunnerName('');
        setRunnerPhone('');
        setRunnerCity('');
        setRunnerCash('0');
        setRunnerContactType('cell');
        setEditingRunnerOldName(null);
    }

    // Toggle Runner Status
    async function toggleRunner(name: string, active: boolean) {
        // Optimistic UI Update
        setRunners(prev => prev.map(r => r.name === name ? { ...r, active } : r));

        const storedSheetId = localStorage.getItem('custom_sheet_id');
        const headers: HeadersInit = storedSheetId ? { 'x-custom-sheet-id': storedSheetId } : {};

        try {
            await fetch('/api/settings', {
                method: 'POST',
                headers,
                body: JSON.stringify({ type: 'toggle_runner', name, active }),
            });
        } catch (e) {
            console.error('Failed to toggle runner', e);
            fetchSettings(); // Revert on failure
        }
    }

    // 2. Delete Runner
    function deleteRunner(name: string) {
        showConfirm('Delete Runner', `Are you sure you want to delete ${name}?`, async () => {
            if (editingRunnerOldName === name) cancelEditing();
            const storedSheetId = localStorage.getItem('custom_sheet_id');
            const headers: HeadersInit = storedSheetId ? { 'x-custom-sheet-id': storedSheetId } : {};
            await fetch(`/api/settings?name=${encodeURIComponent(name)}`, { method: 'DELETE', headers });
            fetchSettings();
            closeModal();
        });
    }

    // 3. Department Actions
    async function addDept() {
        if (!newDept) return;
        const storedSheetId = localStorage.getItem('custom_sheet_id');
        const headers: HeadersInit = storedSheetId ? { 'x-custom-sheet-id': storedSheetId } : {};

        await fetch('/api/settings', {
            method: 'POST',
            headers,
            body: JSON.stringify({ type: 'department', name: newDept }),
        });
        setNewDept('');
        fetchSettings();
    }

    function deleteDept(name: string) {
        showConfirm('Delete Department', `Are you sure you want to delete the "${name}" department?`, async () => {
            const storedSheetId = localStorage.getItem('custom_sheet_id');
            const headers: HeadersInit = storedSheetId ? { 'x-custom-sheet-id': storedSheetId } : {};
            await fetch(`/api/settings?name=${encodeURIComponent(name)}&type=department`, { method: 'DELETE', headers });
            fetchSettings();
            closeModal();
        });
    }

    // 4. Handle CSV Upload Analysis
    const handleFileUpload = (e: any) => {
        const file = e.target.files[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const headers = results.meta.fields || [];
                setCsvHeaders(headers);
                setCsvData(results.data);

                // Auto-guess mapping if possible (case-insensitive)
                const guess = { date: '', city: '', venue: '' };
                headers.forEach(h => {
                    const lower = h.toLowerCase();
                    if (lower.includes('date')) guess.date = h;
                    else if (lower.includes('city') || lower.includes('location')) guess.city = h;
                    else if (lower.includes('venue') || lower.includes('place')) guess.venue = h;
                });
                setMapping(guess);

                setCsvStep('map');
                setUploadStatus('');
            },
        });
    };

    // 5. Process Upload with Mapping - SAVE TO LOCALSTORAGE & API
    const processUpload = async () => {
        if (!mapping.date || !mapping.city || !mapping.venue) {
            return showInfo('Missing Fields', 'Please map all fields (Date, City, Venue) to continue.');
        }

        setUploadStatus('Processing...');

        // Transform and normalize dates
        const rows = csvData.map(row => {
            let dateStr = row[mapping.date];
            let normalizedDate = dateStr;

            // Normalize to YYYY-MM-DD format
            try {
                let processedDate = dateStr?.trim() || '';
                const currentYear = new Date().getFullYear();

                // Add year if missing
                const hasYear = /\b(20\d{2}|19\d{2})\b/.test(processedDate);
                if (!hasYear && processedDate) {
                    processedDate = `${processedDate}, ${currentYear}`;
                }

                const parsed = new Date(processedDate);
                if (!isNaN(parsed.getTime())) {
                    normalizedDate = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
                }
            } catch { }

            return {
                date: normalizedDate,
                city: row[mapping.city],
                venue: row[mapping.venue]
            };
        }).filter(r => r.date && r.city);

        // Save to localStorage
        localStorage.setItem('tour_schedule', JSON.stringify(rows));
        setSchedule(rows);

        // Sync to Cloud
        try {
            setUploadStatus('Syncing to Cloud...');
            const storedSheetId = localStorage.getItem('custom_sheet_id');
            const headers: HeadersInit = storedSheetId ? { 'x-custom-sheet-id': storedSheetId } : {};
            await fetch('/api/settings', {
                method: 'POST',
                headers,
                body: JSON.stringify({ type: 'schedule_bulk', rows }),
            });
            showInfo('Import Complete', `Tour schedule with ${rows.length} dates saved and synced!`, 'success');
        } catch (e) {
            console.error("Sync failed", e);
            showInfo('Sync Warning', 'Saved locally but failed to sync to cloud.', 'info');
        }

        setUploadStatus('Schedule Saved!');
        setTimeout(() => {
            setUploadStatus('');
            setCsvStep('upload');
            setMapping({ date: '', city: '', venue: '' });
        }, 500);
    };

    // 6. Clear Schedule
    const clearSchedule = () => {
        showConfirm('Clear Schedule', 'Are you sure you want to remove all tour dates? This action cannot be undone.', async () => {
            localStorage.removeItem('tour_schedule');
            setSchedule([]);

            // Clear from Cloud
            try {
                const storedSheetId = localStorage.getItem('custom_sheet_id');
                const headers: HeadersInit = storedSheetId ? { 'x-custom-sheet-id': storedSheetId } : {};
                await fetch('/api/settings', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ type: 'schedule_bulk', rows: [] }),
                });
            } catch (e) {
                console.error("Failed to clear cloud schedule", e);
            }

            closeModal();
            showInfo('Schedule Cleared', 'All tour dates have been removed.', 'success');
        });
    };

    const handleHardReset = () => {
        showConfirm(
            'Factory Reset Application?',
            'This provides a fresh start. It will wipe all data from the connected Google Sheet (Requests, Runners, Depts) AND reset your local app settings. This action cannot be undone.',
            async () => {
                setIsLoading(true);
                try {
                    const storedSheetId = localStorage.getItem('custom_sheet_id');
                    const headers: HeadersInit = storedSheetId ? { 'x-custom-sheet-id': storedSheetId } : {};

                    // Wipe Sheet
                    await fetch('/api/reset', { method: 'POST', headers });

                    // Wipe Local Storage
                    localStorage.clear();

                    showInfo('System Reset', 'Application has been factory reset. Reloading...', 'success');

                    // Force reload after delay
                    setTimeout(() => {
                        window.location.href = '/';
                    }, 1500);
                } catch (error) {
                    console.error('Reset failed', error);
                    showInfo('Reset Failed', 'Could not clear data. Check connection.', 'danger');
                    setIsLoading(false);
                }
            }
        );
    };

    const loadDemoData = () => {
        showConfirm(
            'Load Demo Data',
            'This action will add 50 mock items and 5 runners to your connected Google Sheet.\n\nIt is recommended to use this on a new or empty sheet to avoid cluttering real data. Do you want to continue?',
            async () => {
                setIsLoading(true);
                try {
                    const sheetId = localStorage.getItem('custom_sheet_id');
                    const res = await fetch('/api/seed', {
                        method: 'POST',
                        headers: sheetId ? { 'x-custom-sheet-id': sheetId } : {}
                    });
                    const data = await res.json();
                    if (data.success) {
                        showInfo('Success', 'Demo data loaded! Reloading dashboard...', 'success');
                        setTimeout(() => window.location.href = '/dashboard', 1500);
                    } else {
                        showInfo('Error', data.error || 'Failed to load demo data', 'danger');
                    }
                } catch (e) {
                    showInfo('Error', 'Network error', 'danger');
                } finally {
                    setIsLoading(false);
                }
            }
        );
    };

    const handleSaveSheetId = async () => {
        if (!sheetId) {
            return showInfo('Validation Error', 'Please enter a Google Sheet ID.');
        }

        // Save to LocalStorage for persistence across sessions
        localStorage.setItem('custom_sheet_id', sheetId);

        showInfo('Success', 'Google Sheet Connected! The app will now reload to apply changes.', 'success');

        // Reload to apply changes globally
        setTimeout(() => {
            window.location.reload();
        }, 1500);
    };

    return (
        <div className="min-h-screen bg-[#0b0c15] text-white flex flex-col md:flex-row">

            {/* LEFT SIDEBAR MENU */}
            <aside className="w-full md:w-64 bg-[#0F111A] border-r border-slate-800 p-6 flex flex-col h-auto md:h-screen sticky top-0">
                <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400 mb-8 tracking-tight">
                    Settings
                </h1>

                <nav className="space-y-2 flex-1">
                    <button
                        onClick={() => setActiveSettingTab('Runners')}
                        className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all relative ${activeSettingTab === 'Runners'
                            ? 'bg-indigo-600 shadow-lg shadow-indigo-900/20 text-white font-semibold'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        Runners
                        {runners.length === 0 && (
                            <span className="ml-auto w-2 h-2 bg-indigo-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.8)]" title="Add Runners Here" />
                        )}
                    </button>
                    <button
                        onClick={() => setActiveSettingTab('Departments')}
                        className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all relative ${activeSettingTab === 'Departments'
                            ? 'bg-indigo-600 shadow-lg shadow-indigo-900/20 text-white font-semibold'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                        Departments
                        {departments.length <= 6 && (
                            <span className="ml-auto w-2 h-2 bg-indigo-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.8)]" title="Customize Departments" />
                        )}
                    </button>
                    <button
                        onClick={() => setActiveSettingTab('Tour Schedule')}
                        className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all ${activeSettingTab === 'Tour Schedule'
                            ? 'bg-indigo-600 shadow-lg shadow-indigo-900/20 text-white font-semibold'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        Tour Schedule
                    </button>
                    <button
                        onClick={() => setActiveSettingTab('App Setup')}
                        className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all mt-4 border-t border-slate-800 ${activeSettingTab === 'App Setup'
                            ? 'bg-indigo-600 shadow-lg shadow-indigo-900/20 text-white font-semibold'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        App Setup
                    </button>
                    <button
                        onClick={() => setActiveSettingTab('Help')}
                        className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all ${activeSettingTab === 'Help'
                            ? 'bg-indigo-600 shadow-lg shadow-indigo-900/20 text-white font-semibold'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Help & Support
                    </button>
                </nav>

                <div className="pt-6 border-t border-slate-800 mt-auto">
                    <a href="/dashboard" className="text-slate-500 hover:text-white flex items-center gap-2 font-medium transition-colors p-2 rounded-lg hover:bg-slate-800">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        Back to Dashboard
                    </a>
                </div>
            </aside>

            {/* MAIN CONTENT AREA */}
            <main className="flex-1 p-8 sm:p-12 overflow-y-auto max-h-screen">
                <div className="max-w-4xl mx-auto">

                    {/* RUNNERS TAB */}
                    {activeSettingTab === 'Runners' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <h2 className="text-3xl font-bold mb-6 text-white border-b border-slate-800 pb-4">Manage Runners</h2>
                            <p className="text-gray-400 mb-8 max-w-2xl">Add or remove runners from the system. Runners added here will appear in the assignment dropdown on the dashboard.</p>

                            <div className="bg-[#12141f] p-6 rounded-xl border border-slate-800/80 mb-8">
                                <h3 id="runner-form" className="text-lg font-bold mb-4 text-indigo-400">{editingRunnerOldName ? 'Edit Runner' : 'Add New Runner'}</h3>
                                <div className="flex gap-2 items-center mb-4">
                                    <span className="text-xs text-slate-500 font-bold uppercase mr-2">Theme</span>
                                    {colors.map(c => (
                                        <button
                                            key={c}
                                            onClick={() => setRunnerColor(c)}
                                            className={`w-6 h-6 rounded-full transition-all border-2 ${runnerColor === c ? 'border-white scale-110' : 'border-transparent opacity-30 hover:opacity-100 hover:scale-110'}`}
                                            style={{ backgroundColor: c }}
                                            title={c}
                                        />
                                    ))}
                                </div>
                                <div className="flex flex-col gap-4">
                                    {/* Row 1: Contact Info */}
                                    <div className="flex flex-col lg:flex-row gap-3">
                                        <input
                                            className="bg-slate-900/50 border border-slate-700 p-3 rounded-lg text-white text-sm flex-[2] min-w-[200px] focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 focus:outline-none transition-all"
                                            placeholder="Full Name (e.g. John Doe)"
                                            value={runnerName} onChange={e => setRunnerName(e.target.value)}
                                        />
                                        <input
                                            className="bg-slate-900/50 border border-slate-700 p-3 rounded-lg text-white text-sm flex-1 min-w-[150px] focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 focus:outline-none transition-all"
                                            placeholder="Phone Number"
                                            value={runnerPhone} onChange={e => setRunnerPhone(e.target.value)}
                                        />
                                        {/* Segmented Toggle for Contact Type */}
                                        <div className="flex bg-slate-900/50 border border-slate-700 rounded-lg p-1 shrink-0 h-[46px] w-[140px]">
                                            <button
                                                onClick={() => setRunnerContactType('cell')}
                                                className={`flex-1 rounded-md text-xs font-bold transition-all ${runnerContactType === 'cell' ? 'bg-indigo-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                                            >Cell</button>
                                            <button
                                                onClick={() => setRunnerContactType('whatsapp')}
                                                className={`flex-1 rounded-md text-xs font-bold transition-all ${runnerContactType === 'whatsapp' ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                                            >WA</button>
                                        </div>
                                    </div>

                                    {/* Row 2: Details & Actions */}
                                    <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
                                        <input
                                            className="bg-slate-900/50 border border-slate-700 p-3 rounded-lg text-white text-sm flex-1 min-w-[200px] focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 focus:outline-none transition-all"
                                            placeholder="City"
                                            value={runnerCity} onChange={e => setRunnerCity(e.target.value)}
                                        />
                                        <div className="flex items-center gap-1 bg-slate-900/50 border border-slate-700 rounded-lg px-3 h-[46px] w-[120px] shrink-0">
                                            <span className="text-emerald-400 font-bold">$</span>
                                            <input
                                                type="number"
                                                className="bg-transparent w-full text-white text-sm focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder-slate-600"
                                                placeholder="0"
                                                value={runnerCash} onChange={e => setRunnerCash(e.target.value)}
                                            />
                                        </div>
                                        <div className="flex gap-2 lg:ml-auto">
                                            {editingRunnerOldName && (
                                                <button onClick={cancelEditing} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-3 rounded-lg font-bold transition-all h-[46px] w-full lg:w-auto">
                                                    Cancel
                                                </button>
                                            )}
                                            <button onClick={addRunner} className={`${editingRunnerOldName ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20' : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/20'} text-white px-6 py-3 rounded-lg font-bold shadow-lg transition-all active:scale-95 whitespace-nowrap h-[46px] w-full lg:w-auto`}>
                                                {editingRunnerOldName ? 'Save' : '+ Add'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-[#12141f] rounded-xl border border-slate-800/80 overflow-hidden">
                                <div className="p-4 bg-slate-900/50 border-b border-slate-800 flex justify-between items-center">
                                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Current Roster</h3>
                                    <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">{runners.length} Runners</span>
                                </div>
                                <div className="divide-y divide-slate-800/50">
                                    {runners.map((r, i) => (
                                        <div key={i} className={`flex justify-between items-center p-4 transition-colors ${!r.active ? 'opacity-50 grayscale hover:grayscale-0' : 'hover:bg-slate-800/30'}`}>
                                            <div className="flex items-center gap-4">
                                                <div
                                                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border transition-colors ${!r.active ? 'bg-slate-700/20 text-slate-500 border-slate-700' : ''}`}
                                                    style={r.active ? {
                                                        backgroundColor: (r.color || '#6366f1') + '33',
                                                        borderColor: (r.color || '#6366f1') + '4d',
                                                        color: r.color || '#6366f1'
                                                    } : undefined}
                                                >
                                                    {r.name.substring(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="text-white font-medium flex items-center gap-2">
                                                        {r.name}
                                                        {r.city && <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">{r.city}</span>}
                                                        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30">${r.cash ?? 0}</span>
                                                    </p>
                                                    <p className={`text-xs mt-0.5 font-bold ${r.contactType === 'whatsapp' ? 'text-green-400' : 'text-blue-400'}`}>
                                                        {r.phone}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4">
                                                {/* Active Toggle */}
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <span className="text-xs text-slate-500 uppercase font-bold">{r.active ? 'Active' : 'Inactive'}</span>
                                                    <div className="relative inline-flex items-center cursor-pointer">
                                                        <input type="checkbox" className="sr-only peer" checked={r.active} onChange={() => toggleRunner(r.name, !r.active)} />
                                                        <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                                                    </div>
                                                </label>

                                                <button
                                                    onClick={() => startEditing(r)}
                                                    className="text-slate-500 hover:text-indigo-400 p-2 rounded-lg hover:bg-indigo-500/10 transition-all ml-1"
                                                    title="Edit Runner"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                </button>

                                                <button
                                                    onClick={() => deleteRunner(r.name)}
                                                    className="text-slate-500 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-all ml-1"
                                                    title="Delete Runner"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {runners.length === 0 && (
                                        <div className="p-8 text-center text-gray-500 italic">No runners added yet.</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* DEPARTMENTS TAB */}
                    {activeSettingTab === 'Departments' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <h2 className="text-3xl font-bold mb-6 text-white border-b border-slate-800 pb-4">Departments</h2>
                            <p className="text-gray-400 mb-8 max-w-2xl">Define the departments that can request items. These appear as tags on requests.</p>

                            <div className="bg-[#12141f] p-6 rounded-xl border border-slate-800/80 mb-8">
                                <div className="flex gap-3">
                                    <input
                                        className="bg-slate-900/50 border border-slate-700 p-3 rounded-lg text-white text-sm flex-1 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 focus:outline-none transition-all"
                                        placeholder="New Department Name (e.g. Wardrobe, Pyro, Audio)"
                                        value={newDept} onChange={e => setNewDept(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && addDept()}
                                    />
                                    <button onClick={addDept} className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-lg font-bold shadow-lg shadow-purple-900/20 transition-all active:scale-95">
                                        Add Dept
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-3">
                                {departments.map((dept, i) => (
                                    <div key={i} className="flex items-center gap-3 pl-4 pr-2 py-2 bg-slate-900/80 border border-slate-700 rounded-lg group hover:border-purple-500/50 transition-all">
                                        <span className="text-gray-200 font-medium">{dept}</span>
                                        <button onClick={() => deleteDept(dept)} className="text-gray-600 hover:text-red-400 p-1 rounded hover:bg-white/5 transition-colors">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    </div>
                                ))}
                                {departments.length === 0 && <span className="text-gray-500 italic">No departments configured.</span>}
                            </div>
                        </div>
                    )}

                    {/* TOUR SCHEDULE TAB */}
                    {activeSettingTab === 'Tour Schedule' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <h2 className="text-3xl font-bold mb-6 text-white border-b border-slate-800 pb-4">Tour Schedule</h2>
                            <p className="text-gray-400 mb-8 max-w-2xl">Upload your tour schedule CSV to automatically sync city and venue information based on the current date.</p>

                            <div className="bg-[#12141f] p-8 rounded-xl border border-slate-800/80">
                                {csvStep === 'upload' ? (
                                    <div className="text-center py-10 border-2 border-dashed border-slate-700 hover:border-indigo-500/50 rounded-xl transition-colors bg-slate-900/30">
                                        <div className="mb-4 text-indigo-400 opacity-80">
                                            <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                                        </div>
                                        <p className="text-lg font-medium text-white mb-2">Drag & Drop or Click to Upload CSV</p>
                                        <p className="text-sm text-gray-500 mb-6">Supports .csv files with header rows.</p>
                                        <label className="cursor-pointer inline-block">
                                            <span className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-lg font-bold shadow-lg shadow-indigo-900/20 transition-all">
                                                Select File
                                            </span>
                                            <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                                        </label>
                                    </div>
                                ) : (
                                    <div className="space-y-6 max-w-lg mx-auto">
                                        <div className="flex items-center gap-3 text-emerald-400 mb-6 bg-emerald-900/20 p-4 rounded-lg border border-emerald-900/50">
                                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            <span className="font-semibold">File Loaded Successfully!</span>
                                        </div>

                                        <p className="text-white font-medium">Please map your CSV columns to the system fields:</p>

                                        <div className="space-y-4">
                                            <div className="space-y-1">
                                                <label className="text-xs text-gray-400 uppercase font-bold tracking-wider">Date Column</label>
                                                <select value={mapping.date} onChange={e => setMapping({ ...mapping, date: e.target.value })}
                                                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-3 focus:border-indigo-500 focus:outline-none">
                                                    <option value="">-- Select Column --</option>
                                                    {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-gray-400 uppercase font-bold tracking-wider">City Column</label>
                                                <select value={mapping.city} onChange={e => setMapping({ ...mapping, city: e.target.value })}
                                                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-3 focus:border-indigo-500 focus:outline-none">
                                                    <option value="">-- Select Column --</option>
                                                    {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-gray-400 uppercase font-bold tracking-wider">Venue Column</label>
                                                <select value={mapping.venue} onChange={e => setMapping({ ...mapping, venue: e.target.value })}
                                                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-3 focus:border-indigo-500 focus:outline-none">
                                                    <option value="">-- Select Column --</option>
                                                    {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="flex gap-3 pt-4">
                                            <button onClick={() => setCsvStep('upload')} className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold border border-slate-700 transition-all">
                                                Cancel
                                            </button>
                                            <button onClick={processUpload} className="flex-[2] bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-lg font-bold shadow-lg shadow-indigo-900/20 transition-all">
                                                Import Schedule
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {uploadStatus && <p className="mt-6 text-center text-emerald-400 font-bold animate-pulse">
                                    {uploadStatus}
                                </p>}
                            </div>

                            {/* Existing Schedule Display */}
                            {schedule.length > 0 && (
                                <div className="mt-8 bg-[#12141f] rounded-xl border border-slate-800/80 overflow-hidden">
                                    <div className="p-4 bg-slate-900/50 border-b border-slate-800 flex justify-between items-center">
                                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Uploaded Schedule</h3>
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={clearSchedule}
                                                className="text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/20 transition-all"
                                            >
                                                Clear Dates
                                            </button>
                                            <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1.5 rounded border border-slate-700 font-mono">{schedule.length} Dates</span>
                                        </div>
                                    </div>
                                    <div className="max-h-[400px] overflow-y-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-900/80 sticky top-0">
                                                <tr>
                                                    <th className="text-left p-3 text-slate-400 font-medium">Date</th>
                                                    <th className="text-left p-3 text-slate-400 font-medium">City</th>
                                                    <th className="text-left p-3 text-slate-400 font-medium">Venue</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-800/50">
                                                {schedule.map((row, i) => (
                                                    <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                                                        <td className="p-3 text-white font-mono text-xs">{row.date}</td>
                                                        <td className="p-3 text-slate-300">{row.city}</td>
                                                        <td className="p-3 text-slate-400">{row.venue}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* APP SETUP TAB */}
                    {activeSettingTab === 'App Setup' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <h2 className="text-3xl font-bold mb-6 text-white border-b border-slate-800 pb-4">Host & Connect</h2>
                            <p className="text-gray-400 mb-8 max-w-2xl">
                                First, host this application (e.g., on Vercel). Then follow the steps below to connect your own Google Sheet.
                            </p>

                            <div className="space-y-6">
                                {/* Step 1 */}
                                <div className="bg-[#12141f] p-6 rounded-xl border border-slate-800/80">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500 text-indigo-400 flex items-center justify-center font-bold">1</div>
                                        <h3 className="text-lg font-bold text-white">Get the Template</h3>
                                    </div>
                                    <p className="text-gray-400 text-sm mb-4 ml-11">
                                        Create a copy of the official runner list template to your own Google Drive.
                                    </p>
                                    <a
                                        href="https://docs.google.com/spreadsheets/d/10Orw1-V6eI9quknFQo0WdpSP5ml-3aQ3f8RXMXsx-EE/copy"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="ml-11 inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                        Open Template & Make Copy &rarr;
                                    </a>
                                </div>

                                {/* Step 2 */}
                                <div className="bg-[#12141f] p-6 rounded-xl border border-slate-800/80">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500 text-indigo-400 flex items-center justify-center font-bold">2</div>
                                        <h3 className="text-lg font-bold text-white">Invite Service Account</h3>
                                    </div>
                                    <p className="text-gray-400 text-sm mb-4 ml-11">
                                        In your new Google Sheet, click "Share" and invite this Service Email as an <b>Editor</b> so the app can write to it.
                                    </p>
                                    <div className="ml-11 flex gap-2">
                                        <input
                                            className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-slate-400 text-sm flex-1 font-mono select-all"
                                            readOnly
                                            value={serviceEmail}
                                        />
                                        <button
                                            onClick={() => { navigator.clipboard.writeText(serviceEmail); showInfo('Copied', 'Service email copied!', 'success'); }}
                                            className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-3 rounded-lg font-medium border border-slate-700 transition-colors"
                                        >
                                            Copy
                                        </button>
                                    </div>
                                </div>

                                {/* Step 3 */}
                                <div className="bg-[#12141f] p-6 rounded-xl border border-slate-800/80">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500 text-indigo-400 flex items-center justify-center font-bold">3</div>
                                        <h3 className="text-lg font-bold text-white">Connect Your Sheet</h3>
                                    </div>
                                    <p className="text-gray-400 text-sm mb-4 ml-11">
                                        Copy the ID from your Sheet's URL (between <code>/d/</code> and <code>/edit</code>) and paste it here.
                                    </p>
                                    <div className="ml-11 flex gap-2">
                                        <input
                                            className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white text-sm flex-1 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all placeholder-slate-600"
                                            placeholder="e.g. 1xFz3FESsw84SpaQtRcZPIxu9Or1kNlYI0g1wEtAVr9U"
                                            value={sheetId}
                                            onChange={(e) => {
                                                let val = e.target.value;
                                                // Auto-extract from Magic Link
                                                if (val.includes('setup_sheet_id=')) {
                                                    val = val.split('setup_sheet_id=')[1].split('&')[0];
                                                }
                                                // Auto-extract from Google Sheet URL
                                                else if (val.includes('/d/')) {
                                                    val = val.split('/d/')[1].split('/')[0];
                                                }
                                                setSheetId(val);
                                            }}
                                        />
                                        <button
                                            onClick={handleSaveSheetId}
                                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-lg font-bold shadow-lg shadow-emerald-900/20 transition-all active:scale-95"
                                        >
                                            Connect
                                        </button>
                                    </div>
                                </div>

                                {/* Step 4: Share Link (Only if connected) */}
                                {sheetId && (
                                    <div className="bg-[#12141f] p-6 rounded-xl border border-dashed border-slate-700/80 mt-8">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500 text-amber-400 flex items-center justify-center font-bold">4</div>
                                            <h3 className="text-lg font-bold text-white">Share Access</h3>
                                        </div>
                                        <p className="text-gray-400 text-sm mb-4 ml-11">
                                            Send this link to your Runners or other Coordinators. It will automatically connect their device to this Sheet.
                                        </p>
                                        <div className="ml-11 flex gap-2">
                                            <button
                                                onClick={() => {
                                                    const link = `${window.location.origin}?setup_sheet_id=${sheetId}`;
                                                    navigator.clipboard.writeText(link);
                                                    showInfo('Copied', 'Magic link copied to clipboard!', 'success');
                                                }}
                                                className="w-full bg-slate-800 hover:bg-slate-700 text-white px-4 py-3 rounded-lg font-medium border border-slate-700 transition-colors flex items-center justify-center gap-2"
                                            >
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                                Copy Magic Share Link
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Demo Data Section */}
                                {sheetId && (
                                    <div className="bg-[#12141f] p-6 rounded-xl border border-dashed border-indigo-500/30 mt-8">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="text-lg font-bold text-white">Populate Demo Data</h3>
                                            <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30">Testing</span>
                                        </div>
                                        <p className="text-gray-400 text-sm mb-4">
                                            Add 50 mock requests and a team of runners to your sheet. Useful for seeing the dashboard in action.
                                        </p>
                                        <button
                                            onClick={loadDemoData}
                                            disabled={isLoading}
                                            className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 rounded-lg font-bold border border-slate-700 transition-all flex items-center gap-2 group hover:border-indigo-500/50"
                                        >
                                            {isLoading ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    Generating Data...
                                                </>
                                            ) : (
                                                <>
                                                    <span className="text-lg group-hover:scale-110 transition-transform">🎲</span>
                                                    Load Demo Data
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* HELP TAB */}
                    {activeSettingTab === 'Help' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <h2 className="text-3xl font-bold mb-6 text-white border-b border-slate-800 pb-4">Help & Instructions</h2>

                            {/* Interactive Tour Banner */}
                            <div className="bg-gradient-to-r from-indigo-900/50 to-purple-900/50 p-8 rounded-xl border border-indigo-500/30 flex flex-col md:flex-row justify-between items-center gap-6 mb-10 shadow-lg">
                                <div>
                                    <h3 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                                        <span className="text-3xl">🚀</span>
                                        New to the Dashboard?
                                    </h3>
                                    <p className="text-indigo-200 text-lg">Take a quick interactive tour to learn the ropes of your new mission control center.</p>
                                </div>
                                <button
                                    onClick={() => window.location.href = '/dashboard?tour=true'}
                                    className="bg-white hover:bg-indigo-50 text-indigo-700 px-8 py-4 rounded-xl font-bold shadow-xl shadow-indigo-900/20 transition-all active:scale-95 flex items-center gap-3 whitespace-nowrap group"
                                >
                                    <span className="text-xl group-hover:animate-bounce">👉</span>
                                    Start App Tour
                                </button>
                            </div>

                            <p className="text-gray-400 mb-8 max-w-2xl border-l-4 border-slate-700 pl-4">
                                This dashboard connects your requests, runners, and tour schedule into one seamless logistics hub. Here is how it works:
                            </p>

                            <div className="space-y-8">
                                {/* Section 1: Workflow */}
                                <section>
                                    <h3 className="text-xl font-bold text-emerald-400 mb-4 flex items-center gap-2">
                                        <span className="bg-emerald-500/10 text-emerald-500 p-1 rounded-lg">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                                        </span>
                                        1. The Runner Workflow
                                    </h3>
                                    <div className="bg-[#12141f] p-6 rounded-xl border border-slate-800/80 text-gray-300 leading-relaxed grid gap-6 md:grid-cols-3">
                                        <div className="relative">
                                            <div className="absolute -left-3 top-0 bottom-0 w-1 bg-emerald-500/20 rounded-full"></div>
                                            <h4 className="text-white font-bold mb-2">1. Assign & Prepare</h4>
                                            <p className="text-sm">Incoming requests appear in the feed. Assign them to a runner. The runner moves to the <span className="text-amber-400 font-bold">Send List</span> (Amber) group.</p>
                                        </div>
                                        <div className="relative">
                                            <div className="absolute -left-3 top-0 bottom-0 w-1 bg-amber-500/20 rounded-full"></div>
                                            <h4 className="text-white font-bold mb-2">2. Share & Send</h4>
                                            <p className="text-sm">Click "Share List" on the runner's card. Send via PDF or WhatsApp. The runner automatically moves to <span className="text-rose-400 font-bold">Out Running</span> (Red) status after a brief delay.</p>
                                        </div>
                                        <div className="relative">
                                            <div className="absolute -left-3 top-0 bottom-0 w-1 bg-rose-500/20 rounded-full"></div>
                                            <h4 className="text-white font-bold mb-2">3. Track & Complete</h4>
                                            <p className="text-sm">Monitor their progress. When items are bought, mark them "Purchased". Completed items move to the history tab.</p>
                                        </div>
                                    </div>
                                </section>

                                {/* Section 2: Hosting & Service Account */}
                                <section>
                                    <h3 className="text-xl font-bold text-purple-400 mb-4 flex items-center gap-2">
                                        <span className="bg-purple-500/10 text-purple-500 p-1 rounded-lg">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 01-2 2v4a2 2 0 012 2h14a2 2 0 012-2v-4a2 2 0 01-2-2m-2-4h.01M17 16h.01" /></svg>
                                        </span>
                                        2. Connection Status
                                    </h3>
                                    <div className="bg-[#12141f] p-6 rounded-xl border border-slate-800/80 text-gray-300 leading-relaxed">
                                        <p className="mb-4">
                                            The app communicates securely with your Google Sheet using a Service Account.
                                        </p>
                                        <ul className="list-disc pl-5 space-y-2 text-sm">
                                            <li>If data isn't loading, check the "App Setup" tab to verify your Sheet ID.</li>
                                            <li>Ensure <code>{serviceEmail}</code> is added as an <strong>Editor</strong> on your sheet.</li>
                                            <li>Tour Dates are stored locally on your device for privacy and speed. Use the "Tour Schedule" tab to update or clear them.</li>
                                        </ul>
                                    </div>
                                </section>

                                {/* Section 3: Pro Tips */}
                                <section>
                                    <h3 className="text-xl font-bold text-amber-400 mb-4 flex items-center gap-2">
                                        <span className="bg-amber-500/10 text-amber-500 p-1 rounded-lg">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                        </span>
                                        3. Pro Tips
                                    </h3>
                                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <li className="bg-[#12141f] p-4 rounded-lg border border-slate-800/80 flex gap-3 items-start">
                                            <span className="text-lg">💰</span>
                                            <div>
                                                <strong className="text-white block mb-1">Cash Tracking</strong>
                                                <span className="text-sm text-gray-400">Click the green cash button on any runner to add funds or view their float history.</span>
                                            </div>
                                        </li>
                                        <li className="bg-[#12141f] p-4 rounded-lg border border-slate-800/80 flex gap-3 items-start">
                                            <span className="text-lg">🔄</span>
                                            <div>
                                                <strong className="text-white block mb-1">Auto-Refresh</strong>
                                                <span className="text-sm text-gray-400">The dashboard updates automatically every 30 seconds or whenever you switch back to the tab.</span>
                                            </div>
                                        </li>
                                        <li className="bg-[#12141f] p-4 rounded-lg border border-slate-800/80 flex gap-3 items-start">
                                            <span className="text-lg">📅</span>
                                            <div>
                                                <strong className="text-white block mb-1">Smart PDF</strong>
                                                <span className="text-sm text-gray-400">PDFs automatically use today's venue info if a tour schedule is uploaded.</span>
                                            </div>
                                        </li>
                                        <li className="bg-[#12141f] p-4 rounded-lg border border-slate-800/80 flex gap-3 items-start">
                                            <span className="text-lg">🗑️</span>
                                            <div>
                                                <strong className="text-white block mb-1">Clearing Data</strong>
                                                <span className="text-sm text-gray-400">You can wipe the Schedule in Settings if you need to start a new leg.</span>
                                            </div>
                                        </li>
                                    </ul>
                                </section>
                            </div>

                            {/* DANGER ZONE */}
                            <div className="mt-12 pt-8 border-t border-red-900/30">
                                <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-6">
                                    <h3 className="text-xl font-bold text-red-500 mb-2 flex items-center gap-2">
                                        <span className="material-symbols-outlined">warning</span>
                                        Danger Zone
                                    </h3>
                                    <p className="text-red-200/60 mb-6 text-sm">
                                        These actions are irreversible. Please proceed with caution.
                                    </p>

                                    <div className="flex items-center justify-between">
                                        <div>
                                            <strong className="text-white block">Hard Reset</strong>
                                            <span className="text-xs text-slate-500">Clears all requests, runners, and departments. Starts fresh.</span>
                                        </div>
                                        <button
                                            onClick={handleHardReset}
                                            disabled={isLoading}
                                            className="bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 px-4 py-2 rounded-lg font-bold border border-red-500/50 transition-all text-sm flex items-center gap-2"
                                        >
                                            {isLoading ? 'Resetting...' : 'Reset Everything'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </main >

            <Modal
                isOpen={modal.isOpen}
                title={modal.title}
                onClose={closeModal}
                onConfirm={modal.onConfirm}
                type={modal.type}
            >
                {modal.message}
            </Modal>
        </div >
    );
}

export default function Settings() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#0b0c15] text-white flex items-center justify-center">Loading Settings...</div>}>
            <SettingsContent />
        </Suspense>
    );
}
