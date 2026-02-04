'use client';
import { useEffect, useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { RunnerPdf } from '../components/RunnerPdf';
import Modal from '../../components/Modal';

export default function Dashboard() {
    const [requests, setRequests] = useState<any[]>([]);
    const [runners, setRunners] = useState<any[]>([]);
    const [funFacts, setFunFacts] = useState<string[]>([]);
    const [todayInfo, setTodayInfo] = useState<{ City: string; Venue: string; Date: string } | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'Active' | 'Complete'>('Active');

    // Modal State
    const [modal, setModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        type: 'danger' as 'danger' | 'info' | 'success',
        confirmText: 'Confirm',
        onConfirm: undefined as (() => void) | undefined
    });

    const closeModal = () => setModal(prev => ({ ...prev, isOpen: false }));

    const showModal = (
        title: string,
        message: string,
        type: 'danger' | 'info' | 'success',
        onConfirm?: () => void,
        confirmText: string = 'Confirm'
    ) => {
        setModal({ isOpen: true, title, message, type, onConfirm, confirmText });
    };

    // Purchase Modal State
    const [purchaseModal, setPurchaseModal] = useState({ isOpen: false, reqId: '', cost: '' });

    const submitPurchase = () => {
        if (!purchaseModal.reqId) return;
        updateStatus(purchaseModal.reqId, 'Purchased', undefined, purchaseModal.cost || '0');
        setPurchaseModal({ isOpen: false, reqId: '', cost: '' });
    };

    // Update Status
    async function updateStatus(id: string, newStatus: string, runnerName?: string, cost?: string) {
        setRequests(requests.map(r => r.id === id ? { ...r, status: newStatus, runner: runnerName || r.runner, cost: cost || r.cost } : r));

        const storedSheetId = localStorage.getItem('custom_sheet_id');
        const headers: HeadersInit = storedSheetId ? { 'x-custom-sheet-id': storedSheetId } : {};

        try {
            await fetch('/api/requests', {
                method: 'PATCH',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status: newStatus, runner: runnerName, cost }),
            });
        } catch (error) {
            console.error("Failed to update status", error);
        }
    }

    // Handle Purchase
    const handlePurchase = (id: string) => {
        setPurchaseModal({ isOpen: true, reqId: id, cost: '' });
    };

    // Delete Logic
    function handleDeleteClick(id: string) {
        showModal(
            'Confirm Deletion',
            'Are you sure you want to delete this request? This action cannot be undone.',
            'danger',
            () => confirmDelete(id),
            'Delete'
        );
    }

    async function confirmDelete(id: string) {
        setRequests(prev => prev.filter(r => r.id !== id));
        closeModal();

        const storedSheetId = localStorage.getItem('custom_sheet_id');
        const headers: HeadersInit = storedSheetId ? { 'x-custom-sheet-id': storedSheetId } : {};

        try {
            await fetch(`/api/requests?id=${id}`, { method: 'DELETE', headers });
        } catch (error) {
            console.error("Failed to delete request", error);
        }
    }

    // Share PDF Logic (macOS Style)
    const shareRunnerList = async (runnerName: string) => {
        const items = requests.filter(r => r.runner === runnerName && r.status === 'Assigned');
        if (items.length === 0) return showModal('No Items Found', 'There are no active items assigned to this runner.', 'info');

        try {
            const randomFact = funFacts.length > 0
                ? funFacts[Math.floor(Math.random() * funFacts.length)]
                : "Production is the best department.";

            const todayKey = new Date().toLocaleDateString('en-US');
            const storeKey = `runner_list_count_${todayKey}`;
            const currentCount = parseInt(localStorage.getItem(storeKey) || '0', 10);
            const newCount = currentCount + 1;
            localStorage.setItem(storeKey, newCount.toString());
            const listNumber = newCount.toString().padStart(2, '0');

            const blob = await pdf(
                <RunnerPdf
                    runnerName={runnerName}
                    items={items}
                    funFact={randomFact}
                    venueName={todayInfo?.Venue || 'Tour Venue'}
                    listNumber={listNumber}
                />
            ).toBlob();
            const file = new File([blob], `${runnerName}_List_${listNumber}.pdf`, { type: 'application/pdf' });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: `Runner List: ${runnerName}`,
                    text: `Here is the current shopping list for ${runnerName}.`
                });
            } else {
                window.open(URL.createObjectURL(blob), '_blank');
            }
        } catch (error) {
            console.error('Share cancelled or failed', error);
        }
    };

    // Load Data
    const loadData = async (silent = false) => {
        try {
            if (!silent) setLoading(true);
            const storedSheetId = localStorage.getItem('custom_sheet_id');
            const headers: HeadersInit = storedSheetId ? { 'x-custom-sheet-id': storedSheetId } : {};

            const [reqData, settingsData] = await Promise.all([
                fetch('/api/requests', { headers }).then((res) => res.json()),
                fetch('/api/settings', { headers }).then((res) => res.json())
            ]);

            if (Array.isArray(reqData)) {
                setRequests(prev => {
                    const currentIds = new Set(prev.map((r: any) => r.id));
                    const newItems = reqData.filter((r: any) => !currentIds.has(r.id));
                    if (newItems.length > 0 && silent && Notification.permission === 'granted') {
                        newItems.forEach((item: any) => {
                            new Notification('New Runner Request', { body: `${item.name} needs: ${item.item}` });
                        });
                    }
                    return reqData;
                });
            }

            if (settingsData) {
                if (settingsData.runners) setRunners(settingsData.runners);
                if (settingsData.funFacts) setFunFacts(settingsData.funFacts);
                if (settingsData.todayInfo) setTodayInfo(settingsData.todayInfo);
            }
            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    useEffect(() => {
        if ('Notification' in window && Notification.permission !== 'granted') Notification.requestPermission();
        loadData(false);
        const interval = setInterval(() => loadData(true), 30000);
        return () => clearInterval(interval);
    }, []);

    // New Helper: Get Initials
    const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

    // New Helper: Time Ago
    const getTimeAgo = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    };

    return (
        <div className="flex h-screen bg-transparent overflow-hidden text-foreground font-sans">
            {/* Modal */}
            <Modal isOpen={modal.isOpen} onClose={closeModal} title={modal.title} type={modal.type} onConfirm={modal.onConfirm} confirmText={modal.confirmText}>
                {modal.message}
            </Modal>

            {/* Purchase Modal */}
            <Modal isOpen={purchaseModal.isOpen} title="Confirm Purchase" type="success" onClose={() => setPurchaseModal(prev => ({ ...prev, isOpen: false }))} onConfirm={submitPurchase} confirmText="Confirm Purchase">
                <p className="mb-4 text-slate-300">Enter cost:</p>
                <input type="number" className="w-full bg-[#0b0c15] border border-slate-700 p-3 text-white rounded-lg" placeholder="0.00" value={purchaseModal.cost} onChange={e => setPurchaseModal(prev => ({ ...prev, cost: e.target.value }))} autoFocus />
            </Modal>

            {/* SIDEBAR: Runner Assignments */}
            <aside className="w-80 glass-panel flex flex-col border-r border-glass-border">
                <div className="p-8 border-b border-glass-border">
                    <h2 className="text-xl font-bold tracking-tight text-white mb-1">Assigned Runners</h2>
                    <p className="text-sm text-slate-400">Team Status</p>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {runners.map((runner) => {
                        const activeCount = requests.filter(r => r.runner === runner.name && r.status !== 'Completed').length;
                        return (
                            <div key={runner.name} className="glass-card p-4 rounded-xl flex items-center gap-4 group cursor-pointer hover:bg-white/5" onClick={() => shareRunnerList(runner.name)}>
                                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-xs font-bold text-white shadow-lg">
                                    {getInitials(runner.name)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-semibold text-slate-200 truncate group-hover:text-primary transition-colors">{runner.name}</h4>
                                    <p className="text-xs text-slate-500">{activeCount} active tasks</p>
                                </div>
                                {activeCount > 0 ? (
                                    <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                                ) : (
                                    <div className="h-2 w-2 rounded-full bg-slate-700"></div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="p-4 border-t border-glass-border">
                    <div className="glass-card p-4 rounded-xl">
                        <p className="text-xs text-slate-400 font-medium mb-2">Today's Venue</p>
                        <h3 className="text-sm font-bold text-white truncate">{todayInfo?.Venue || 'Loading...'}</h3>
                        <p className="text-xs text-primary mt-1">{todayInfo?.City || 'Unknown City'}</p>
                    </div>
                </div>
            </aside>

            {/* MAIN CONTENT */}
            <main className="flex-1 flex flex-col h-full relative z-10">
                {/* Header */}
                <header className="h-24 px-8 flex items-center justify-between border-b border-glass-border backdrop-blur-md">
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">Production Request Log</h1>
                        <p className="text-sm text-slate-400 mt-1">Manage and track all crew requests.</p>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex bg-secondary/50 p-1 rounded-lg border border-glass-border">
                            {['Active', 'Complete'].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab as any)}
                                    className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === tab ? 'bg-primary text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        <button onClick={() => window.location.reload()} className="h-9 w-9 rounded-full glass-card flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                            <span className="text-lg">↻</span>
                        </button>
                    </div>
                </header>

                {/* Grid */}
                <div className="flex-1 overflow-y-auto p-8">
                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
                            {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-48 glass-card rounded-2xl"></div>)}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                            {/* Create New Placeholder if desired (optional) */}

                            {requests
                                .filter(req => activeTab === 'Active' ? req.status !== 'Completed' : req.status === 'Completed')
                                .map(req => {
                                    const isAsap = req.item && req.item.includes('ASAP');
                                    const statusColor =
                                        req.status === 'Pending' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
                                            req.status === 'Assigned' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' :
                                                req.status === 'Purchased' ? 'text-purple-400 bg-purple-500/10 border-purple-500/20' :
                                                    'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';

                                    return (
                                        <div key={req.id} className={`glass-card p-6 rounded-2xl flex flex-col gap-4 group relative overflow-hidden ${isAsap ? 'shadow-[0_0_20px_rgba(239,68,68,0.15)] border-red-500/30' : ''}`}>
                                            {isAsap && <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-red-500/20 to-transparent -mr-8 -mt-8 rounded-full blur-xl"></div>}

                                            <div className="flex justify-between items-start relative z-10">
                                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md border ${statusColor}`}>
                                                    {req.status}
                                                </span>
                                                <span className="text-slate-500 text-xs font-mono">{getTimeAgo(req.timestamp)}</span>
                                            </div>

                                            <div className="relative z-10">
                                                <h4 className={`text-lg font-bold leading-tight ${isAsap ? 'text-red-400' : 'text-white'}`}>
                                                    {req.item ? req.item.replace(/🚨?\s*ASAP\s*[-:]?\s*/i, '').split(' - ')[0] : 'Untitled Item'}
                                                </h4>
                                                <p className="text-xs text-slate-400 mt-2 line-clamp-2">
                                                    Requested by <span className="text-slate-300">{req.name}</span> • {req.dept || 'Gen'}
                                                </p>
                                            </div>

                                            <div className="mt-auto pt-4 border-t border-glass-border flex items-center justify-between relative z-10">
                                                {req.runner ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-6 w-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px] text-white font-bold border border-glass-border">
                                                            {getInitials(req.runner)}
                                                        </div>
                                                        <span className="text-xs font-medium text-slate-300 truncate max-w-[80px]">{req.runner}</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 opacity-50">
                                                        <div className="h-6 w-6 rounded-full border border-dashed border-slate-500"></div>
                                                        <span className="text-xs text-slate-500">Unassigned</span>
                                                    </div>
                                                )}

                                                {/* Quick Actions based on Status */}
                                                {req.status === 'Pending' && (
                                                    <select
                                                        className="bg-secondary text-xs text-white border border-glass-border rounded px-2 py-1 max-w-[100px]"
                                                        onChange={(e) => updateStatus(req.id, 'Assigned', e.target.value)}
                                                        value=""
                                                    >
                                                        <option value="">Assess...</option>
                                                        {runners.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
                                                    </select>
                                                )}
                                                {req.status === 'Assigned' && (
                                                    <button onClick={() => handlePurchase(req.id)} className="text-xs font-bold text-primary hover:text-white transition-colors">Mark Purchased</button>
                                                )}
                                                {req.status === 'Purchased' && (
                                                    <button onClick={() => updateStatus(req.id, 'Completed')} className="text-xs font-bold text-emerald-400 hover:text-white transition-colors">Mark Delivered</button>
                                                )}
                                                {req.status === 'Completed' && (
                                                    <button onClick={() => handleDeleteClick(req.id)} className="text-xs text-slate-500 hover:text-red-400">Archive</button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
