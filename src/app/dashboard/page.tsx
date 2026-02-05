'use client';
import { useEffect, useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { RunnerPdf } from '../components/RunnerPdf';
import Link from 'next/link';
import Tour, { TourStep } from '../../components/Tour';
import Modal from '../../components/Modal';

export default function Dashboard() {
    // Tour State
    const [isTourOpen, setIsTourOpen] = useState(false);
    const tourSteps: TourStep[] = [
        { target: 'dashboard-header', title: 'Mission Control', content: 'Welcome to your main dashboard. Monitor show status and runner activity here.', position: 'bottom' },
        { target: 'stats-bar', title: 'Quick Stats', content: 'See daily spend and venue details at a glance.', position: 'right' },
        { target: 'sidebar-assignments', title: 'Runner Status', content: 'Track your team across three key stages: Available, Send List, and Out Running.', position: 'right' },
        { target: 'group-available', title: 'Available Runners', content: 'Runners in GREEN are ready for tasks. Click a runner to assign items or verify cash.', position: 'right' },
        { target: 'group-send-list', title: 'Send List', content: 'Runners in AMBER have items assigned but not sent. Click here to send their list via PDF or WhatsApp.', position: 'right' },
        { target: 'group-out-running', title: 'Out Running', content: 'Runners in RED are actively shopping. You can track their status here.', position: 'right' },
        { target: 'request-feed', title: 'Live Requests', content: 'Incoming requests via the form appear here. Click an item to assign, mark purchased, or edit.', position: 'left' }
    ];

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            if (params.get('tour')) {
                setIsTourOpen(true);
                const url = new URL(window.location.href);
                url.searchParams.delete('tour');
                window.history.replaceState({}, '', url);
            }
        }
    }, []);

    const [requests, setRequests] = useState<any[]>([]);
    const [runners, setRunners] = useState<any[]>([]);
    const [funFacts, setFunFacts] = useState<string[]>([]);
    const [todayInfo, setTodayInfo] = useState<{ City: string; Venue: string; Date: string } | null>(null);
    const [schedule, setSchedule] = useState<any[]>([]); // Full tour schedule
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'Active' | 'Complete'>('Active');
    const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

    // Filter State
    const [feedFilter, setFeedFilter] = useState<{ type: 'all' | 'runner' | 'crew' | 'dept'; value: string }>({ type: 'all', value: '' });
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    // Offline State
    const [isOffline, setIsOffline] = useState(false);

    // Queue Action Helper
    const queueAction = (action: any) => {
        const queue = JSON.parse(localStorage.getItem('offline_queue') || '[]');
        queue.push({ ...action, timestamp: Date.now() });
        localStorage.setItem('offline_queue', JSON.stringify(queue));
        setIsOffline(true);
    };

    async function processSyncQueue() {
        if (typeof navigator !== 'undefined' && !navigator.onLine) return;
        const queueStr = localStorage.getItem('offline_queue');
        if (!queueStr) return;
        const queue = JSON.parse(queueStr);
        if (queue.length === 0) return;

        console.log('Syncing offline actions...', queue.length);
        const storedSheetId = localStorage.getItem('custom_sheet_id');
        const headers: HeadersInit = storedSheetId ? { 'x-custom-sheet-id': storedSheetId } : {};

        const failed: any[] = [];
        let syncedCount = 0;

        for (const item of queue) {
            try {
                if (item.type === 'update_status') {
                    await fetch('/api/requests', {
                        method: 'PATCH',
                        headers: { ...headers, 'Content-Type': 'application/json' },
                        body: JSON.stringify(item.payload)
                    });
                } else if (item.type === 'delete_request') {
                    await fetch(`/api/requests?id=${item.payload.id}`, { method: 'DELETE', headers });
                } else if (item.type === 'update_runner_cash') {
                    await fetch('/api/settings', {
                        method: 'POST',
                        headers,
                        body: JSON.stringify(item.payload)
                    });
                }
                syncedCount++;
            } catch (e) {
                console.error('Sync failed for item', item, e);
                failed.push(item);
            }
        }

        localStorage.setItem('offline_queue', JSON.stringify(failed));
        if (syncedCount > 0 && failed.length === 0) {
            console.log(`Synced ${syncedCount} actions.`);
            loadData(true); // Refresh data
        }
    }

    // Collapsible Sections State
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
    const toggleSection = (id: string) => {
        const newCollapsed = new Set(collapsedSections);
        if (newCollapsed.has(id)) newCollapsed.delete(id);
        else newCollapsed.add(id);
        setCollapsedSections(newCollapsed);
    };

    // Popup states for sidebar cards
    const [showSchedulePopup, setShowSchedulePopup] = useState(false);
    const [showSpendPopup, setShowSpendPopup] = useState(false);

    // Modal State
    const [modal, setModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        type: 'danger' as 'danger' | 'info' | 'success',
        confirmText: 'Confirm',
        onConfirm: undefined as (() => void) | undefined
    });

    // Reassign Modal State
    const [reassignModal, setReassignModal] = useState({ isOpen: false, reqId: '', currentRunner: '' });
    // Batch Message Modal State
    const [batchMessageModal, setBatchMessageModal] = useState<{ isOpen: boolean; requester: string; items: any[]; phone: string }>({ isOpen: false, requester: '', items: [], phone: '' });

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

    // Refill Cash Modal State
    const [refillModal, setRefillModal] = useState({ isOpen: false, runnerName: '', amount: '', currentCash: 0 });

    const submitRefill = async () => {
        if (!refillModal.runnerName || !refillModal.amount) return;

        const storedSheetId = localStorage.getItem('custom_sheet_id');
        const headers: HeadersInit = storedSheetId ? { 'x-custom-sheet-id': storedSheetId } : {};

        const newCash = refillModal.currentCash + parseFloat(refillModal.amount);

        // Optimistic Update
        setRunners(prev => prev.map(r => r.name === refillModal.runnerName ? { ...r, cash: newCash } : r));
        setRefillModal({ isOpen: false, runnerName: '', amount: '', currentCash: 0 });

        try {
            await fetch('/api/settings', {
                method: 'POST',
                headers,
                body: JSON.stringify({ type: 'update_runner_cash', name: refillModal.runnerName, cash: newCash }),
            });
        } catch (error) {
            console.error("Failed to update cash (Offline)", error);
            queueAction({ type: 'update_runner_cash', payload: { type: 'update_runner_cash', name: refillModal.runnerName, cash: newCash } });
        }
    };

    // Update Status
    async function updateStatus(id: string, newStatus: string, runnerName?: string, cost?: string) {
        setRequests(prev => prev.map(r => r.id === id ? { ...r, status: newStatus, runner: runnerName !== undefined ? runnerName : r.runner, cost: cost || r.cost } : r));

        const storedSheetId = localStorage.getItem('custom_sheet_id');
        const headers: HeadersInit = storedSheetId ? { 'x-custom-sheet-id': storedSheetId } : {};

        try {
            await fetch('/api/requests', {
                method: 'PATCH',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status: newStatus, runner: runnerName, cost }),
            });
        } catch (error) {
            console.error("Failed to update status (Offline)", error);
            queueAction({ type: 'update_status', payload: { id, status: newStatus, runner: runnerName, cost } });
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
            console.error("Failed to delete request (Offline)", error);
            queueAction({ type: 'delete_request', payload: { id } });
        }
    }

    // Share PDF Logic (macOS Style)
    // Share PDF Logic (macOS Style)
    const shareRunnerList = async (runnerName: string) => {
        // Include Sent items so user can resend full list
        const items = requests.filter(r => r.runner === runnerName && (r.status === 'Assigned' || r.status === 'Sent'));
        if (items.length === 0) return showModal('No Items Found', 'There are no active items assigned to this runner.', 'info');

        // Helper to update status after delay
        const markAsSent = () => {
            setTimeout(() => {
                items.forEach(item => {
                    if (item.status === 'Assigned') updateStatus(item.id, 'Sent');
                });
            }, 3000); // 3 second delay
        };

        // Copy Runner's Phone to Clipboard
        const runner = runners.find(r => r.name === runnerName);
        if (runner && (runner.phone || runner.mobile)) {
            const phone = runner.phone || runner.mobile;
            navigator.clipboard.writeText(phone).catch(err => console.error('Failed to copy runner phone', err));
        }

        // WhatsApp Direct Link Logic
        if (runner && runner.contactType === 'whatsapp' && (runner.phone || runner.mobile)) {
            const phone = runner.phone || runner.mobile;
            const cleanNumber = phone.replace(/\D/g, '');
            const venue = todayInfo?.Venue || 'Tour Venue';

            let message = `*Runner List for ${runnerName}*\n`;
            message += `Venue: ${venue}\n`;
            message += `\n*ITEMS:*\n`;

            items.forEach((item, i) => {
                const [mainItem, ...details] = (item.item || '').split(' - ');
                const cleanTitle = mainItem.replace(/🚨?\s*ASAP\s*[-:]?\s*/i, '').trim();
                let desc = details.join(' - ');

                // Extract Link is complicated in regex, simpler approach matches PDF logic
                const urlRegex = /(?:Link:\s*)?(https?:\/\/[^\s]+)/i;
                const match = desc.match(urlRegex);
                const link = match ? match[1] : null;
                if (match) desc = desc.replace(urlRegex, '').trim();
                desc = desc.replace(/\s*-\s*$/, '');

                message += `\n${i + 1}. *${cleanTitle}*`;
                if (desc) message += `\n   ${desc}`;
                if (item.store) message += `\n   Store: ${item.store}`;
                if (link) message += `\n   Link: ${link}`;
                message += `\n   Req by: ${item.name} (${item.phone || ''})\n`;
            });

            const randomFact = funFacts.length > 0
                ? funFacts[Math.floor(Math.random() * funFacts.length)]
                : "Production is the best department.";
            message += `\n> _${randomFact}_`;

            window.open(`https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`, '_blank');
            markAsSent();
            return;
        }

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
                    title: `Runner list for ${runnerName}`
                });
                markAsSent();
            } else {
                window.open(URL.createObjectURL(blob), '_blank');
                markAsSent();
            }
        } catch (error) {
            console.error('Share cancelled or failed', error);
        }
    };

    // Load Data
    async function loadData(silent = false) {
        try {
            if (!silent) setLoading(true);
            const storedSheetId = localStorage.getItem('custom_sheet_id');
            const headers: HeadersInit = storedSheetId ? { 'x-custom-sheet-id': storedSheetId } : {};

            const [reqData, settingsData] = await Promise.all([
                fetch('/api/requests', { headers }).then((res) => { if (!res.ok) throw new Error('Fetch failed'); return res.json(); }),
                fetch('/api/settings', { headers }).then((res) => { if (!res.ok) throw new Error('Fetch failed'); return res.json(); })
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
                if (settingsData.schedule) {
                    localStorage.setItem('tour_schedule', JSON.stringify(settingsData.schedule));
                }
            }

            // Cache Data
            localStorage.setItem('cached_dashboard_data', JSON.stringify({
                requests: reqData,
                runners: settingsData?.runners,
                funFacts: settingsData?.funFacts
            }));

            setIsOffline(false);
            processSyncQueue(); // Attempt to sync if back online

            // Get todayInfo from localStorage (tour schedule)
            const storedSchedule = localStorage.getItem('tour_schedule');
            if (storedSchedule) {
                try {
                    const scheduleData = JSON.parse(storedSchedule);
                    setSchedule(scheduleData); // Store full schedule for popup

                    // Get today's date in YYYY-MM-DD format
                    const now = new Date();
                    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

                    const found = scheduleData.find((s: any) => s.date === todayStr);
                    if (found) {
                        setTodayInfo({ City: found.city, Venue: found.venue, Date: found.date });
                    } else {
                        // No show today - find next upcoming show
                        const upcoming = scheduleData
                            .filter((s: any) => s.date > todayStr)
                            .sort((a: any, b: any) => a.date.localeCompare(b.date))[0];
                        if (upcoming) {
                            setTodayInfo({ City: upcoming.city, Venue: `Next: ${upcoming.venue}`, Date: upcoming.date });
                        } else {
                            setTodayInfo({ City: 'No upcoming shows', Venue: 'Upload schedule', Date: '' });
                        }
                    }
                } catch { }
            }

            setLoading(false);
        } catch (err) {
            console.error('Load failed (Offline)', err);

            // Offline Fallback
            const cachedStr = localStorage.getItem('cached_dashboard_data');
            if (cachedStr) {
                const cached = JSON.parse(cachedStr);
                setRequests(cached.requests || []);
                if (cached.runners) setRunners(cached.runners);
                if (cached.funFacts) setFunFacts(cached.funFacts);
                setIsOffline(true);
            }

            // Still load schedule
            const storedSchedule = localStorage.getItem('tour_schedule');
            if (storedSchedule) {
                try {
                    const scheduleData = JSON.parse(storedSchedule);
                    setSchedule(scheduleData);
                    const now = new Date();
                    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                    const found = scheduleData.find((s: any) => s.date === todayStr);
                    if (found) setTodayInfo({ City: found.city, Venue: found.venue, Date: found.date });
                } catch { }
            }

            setLoading(false);
        }
    }

    useEffect(() => {
        if ('Notification' in window && Notification.permission !== 'granted') Notification.requestPermission();
        loadData(false);
        const interval = setInterval(() => loadData(true), 30000);

        // Refresh when coming into view
        const handleVisibilityAndFocus = () => {
            if (document.visibilityState === 'visible') {
                loadData(true);
            }
        };

        window.addEventListener('focus', handleVisibilityAndFocus);
        document.addEventListener('visibilitychange', handleVisibilityAndFocus);

        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', handleVisibilityAndFocus);
            document.removeEventListener('visibilitychange', handleVisibilityAndFocus);
        };
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

    // New Helper: Calculate Today's Total Spend
    const getDailySpendTotal = () => {
        const today = new Date().toDateString();
        return requests
            .filter((r: any) => {
                // Include Purchased and Completed items
                if (r.status !== 'Purchased' && r.status !== 'Completed') return false;
                // Check if timestamp is today
                if (!r.timestamp) return false;
                return new Date(r.timestamp).toDateString() === today;
            })
            .reduce((sum: number, r: any) => {
                const cost = parseFloat(String(r.cost || '0').replace(/[^0-9.-]/g, ''));
                return sum + (isNaN(cost) ? 0 : cost);
            }, 0);
    };

    // New Helper: Calculate Runner's Cash Balance (only TODAY's purchases)
    const getRunnerCashBalance = (runnerName: string, startingCash: number = 0) => {
        const today = new Date().toDateString();
        // Sum all purchases made by this runner TODAY (Purchased or Completed status)
        const spent = requests
            .filter((r: any) => {
                if (r.runner !== runnerName) return false;
                if (r.status !== 'Purchased' && r.status !== 'Completed') return false;
                // Only count today's purchases
                if (!r.timestamp) return false;
                return new Date(r.timestamp).toDateString() === today;
            })
            .reduce((sum: number, r: any) => {
                const cost = parseFloat(String(r.cost || '0').replace(/[^0-9.-]/g, ''));
                return sum + (isNaN(cost) ? 0 : cost);
            }, 0);
        return startingCash - spent;
    };

    // Helper: Group completed requests by date
    const groupRequestsByDate = (reqs: any[]) => {
        const today = new Date().toDateString();
        const groups: { [key: string]: any[] } = {};

        reqs.forEach(req => {
            const dateKey = req.timestamp ? new Date(req.timestamp).toDateString() : 'Unknown';
            if (!groups[dateKey]) groups[dateKey] = [];
            groups[dateKey].push(req);
        });

        // Sort dates: today first, then descending
        const sortedKeys = Object.keys(groups).sort((a, b) => {
            if (a === today) return -1;
            if (b === today) return 1;
            return new Date(b).getTime() - new Date(a).getTime();
        });

        return sortedKeys.map(date => ({
            date,
            isToday: date === today,
            items: groups[date],
            totalCost: groups[date].reduce((sum, r) => sum + (parseFloat(String(r.cost || '0').replace(/[^0-9.-]/g, '')) || 0), 0)
        }));
    };

    // Toggle date expansion
    const toggleDateExpansion = (date: string) => {
        setExpandedDates(prev => {
            const newSet = new Set(prev);
            if (newSet.has(date)) {
                newSet.delete(date);
            } else {
                newSet.add(date);
            }
            return newSet;
        });
    };

    // Format date for display
    const formatDateLabel = (dateStr: string) => {
        if (dateStr === 'Unknown') return 'Unknown Date';
        const date = new Date(dateStr);
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) return 'Today';
        if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    };

    // Handle SMS Click - Check for batched messages
    const handleSmsClick = (req: any, e: React.MouseEvent) => {
        e.preventDefault();
        const requesterItems = requests.filter(r => r.name === req.name && r.status === 'Purchased');

        if (requesterItems.length > 1) {
            setBatchMessageModal({ isOpen: true, requester: req.name, items: requesterItems, phone: req.mobile });
        } else {
            const cleanTitle = (req.item || '').split(' - ')[0].replace(/🚨?\s*ASAP\s*[-:]?\s*/i, '').trim();
            const body = `Hi ${req.name}! Your ${cleanTitle} is ready for pickup at the Production Office.`;
            window.location.href = `sms:${req.mobile || ''}&body=${encodeURIComponent(body)}`;
            // Move to Completed
            updateStatus(req.id, 'Completed');
        }
    };

    // Helper: Render Request Card
    const renderRequestCard = (req: any) => {
        const isAsap = req.item && req.item.includes('ASAP');
        const runnerColor = req.runner ? runners.find(r => r.name === req.runner)?.color : null;
        const statusColor =
            req.status === 'Pending' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
                req.status === 'Assigned' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' :
                    req.status === 'Sent' ? 'text-red-400 bg-red-500/10 border-red-500/20' :
                        req.status === 'Purchased' ? 'text-purple-400 bg-purple-500/10 border-purple-500/20' :
                            'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';

        const rawText = req.item || '';
        const [mainItem, ...detailsParts] = rawText.split(' - ');
        const fullDetails = detailsParts.join(' - ');
        const cleanTitle = mainItem.replace(/🚨?\s*ASAP\s*[-:]?\s*/i, '').trim();

        const urlRegex = /(?:Link:\s*)?(https?:\/\/[^\s]+)/i;
        const match = fullDetails.match(urlRegex);
        const itemUrl = match ? match[1] : null;
        const cleanDescription = fullDetails.replace(urlRegex, '').trim();

        return (
            <div key={req.id}
                className={`glass-card p-6 rounded-2xl flex flex-col gap-4 group relative overflow-hidden ${isAsap ? 'shadow-[0_0_20px_rgba(239,68,68,0.15)] border-red-500/30' : ''}`}
                style={runnerColor ? { backgroundColor: `${runnerColor}15`, borderColor: `${runnerColor}30` } : undefined}
            >
                {isAsap && <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-red-500/20 to-transparent -mr-8 -mt-8 rounded-full blur-xl"></div>}

                <div className="flex justify-between items-start relative z-10">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md border ${statusColor}`}>
                        {req.status}
                    </span>
                    <span className="text-slate-500 text-xs font-mono">{getTimeAgo(req.timestamp)}</span>
                </div>

                <div className="relative z-10 space-y-3">
                    <h4 className={`text-lg font-bold leading-tight ${isAsap ? 'text-red-400' : 'text-white'}`}>
                        {cleanTitle || 'Untitled Item'}
                    </h4>

                    <p className="text-xs text-slate-400">
                        Requested by <span className="text-slate-300">{req.name}</span> • {req.dept || 'Gen'}
                    </p>

                    {cleanDescription && (
                        <div className="bg-black/20 p-2 rounded-lg border border-white/5">
                            <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap break-words">
                                {cleanDescription}
                            </p>
                        </div>
                    )}

                    {itemUrl && (
                        <a href={itemUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:text-white transition-colors bg-primary/10 px-2 py-1 rounded border border-primary/20">
                            <span className="material-symbols-outlined text-[10px]">link</span>
                            View Link
                        </a>
                    )}

                    {req.image_url && (
                        <div className="mt-2 rounded-lg overflow-hidden border border-glass-border relative group bg-black/30 p-2">
                            <img src={req.image_url} alt="Attachment" className="w-full h-32 object-contain transition-transform duration-500 group-hover:scale-105" />
                            <a href={req.image_url} target="_blank" rel="noopener noreferrer" className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                                <span className="material-symbols-outlined text-white drop-shadow-md bg-black/50 rounded-full p-2">visibility</span>
                            </a>
                        </div>
                    )}
                </div>

                <div className="mt-auto pt-4 border-t border-glass-border flex items-center justify-between relative z-10">
                    {req.runner ? (
                        <button
                            onClick={() => setReassignModal({ isOpen: true, reqId: req.id, currentRunner: req.runner })}
                            className="flex items-center gap-2 group/runner hover:bg-white/5 pr-2 rounded-full transition-colors"
                            title="Click to reassign"
                        >
                            <div className="h-6 w-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px] text-white font-bold border border-glass-border" style={runnerColor ? { backgroundColor: runnerColor, borderColor: runnerColor } : {}}>
                                {getInitials(req.runner)}
                            </div>
                            <span className="text-xs font-medium text-slate-300 truncate max-w-[80px] group-hover/runner:text-white transition-colors">{req.runner}</span>
                        </button>
                    ) : (
                        <div className="flex items-center gap-2 opacity-50">
                            <div className="h-6 w-6 rounded-full border border-dashed border-slate-500"></div>
                            <span className="text-xs text-slate-500">Unassigned</span>
                        </div>
                    )}

                    <div className="flex items-center gap-3">
                        {req.cost && (
                            <div className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                                <span className="material-symbols-outlined text-[14px]">attach_money</span>
                                <span className="text-xs font-bold font-mono">
                                    {parseFloat(req.cost.replace(/[^0-9.]/g, '')).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        )}

                        {req.status === 'Pending' && (
                            <div className="flex items-center gap-2">
                                <select
                                    className="bg-secondary text-xs text-white border border-glass-border rounded px-2 py-1 max-w-[100px]"
                                    onChange={(e) => updateStatus(req.id, 'Assigned', e.target.value)}
                                    value=""
                                >
                                    <option value="">Assign...</option>
                                    {runners.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
                                </select>
                                <button onClick={() => handleDeleteClick(req.id)} className="text-slate-500 hover:text-red-400 transition-colors p-1" title="Delete">
                                    <span className="material-symbols-outlined text-[16px]">delete</span>
                                </button>
                            </div>
                        )}
                        {(req.status === 'Assigned' || req.status === 'Sent') && (
                            <div className="flex items-center gap-2">
                                <button onClick={() => handlePurchase(req.id)} className="text-xs font-bold text-primary hover:text-white transition-colors">Mark Purchased</button>
                                <button onClick={() => handleDeleteClick(req.id)} className="text-slate-500 hover:text-red-400 transition-colors p-1" title="Delete">
                                    <span className="material-symbols-outlined text-[16px]">delete</span>
                                </button>
                            </div>
                        )}
                        {req.status === 'Purchased' && (
                            <div className="flex items-center gap-2">
                                <a href="#" onClick={(e) => handleSmsClick(req, e)} className="text-amber-400 hover:text-white transition-colors flex items-center justify-center bg-amber-500/10 p-1.5 rounded border border-amber-500/20 hover:bg-amber-500/20" title="Text & Complete">
                                    <span className="material-symbols-outlined text-[18px]">sms</span>
                                </a>
                                <button onClick={() => handleDeleteClick(req.id)} className="text-slate-500 hover:text-red-400 transition-colors p-1" title="Delete">
                                    <span className="material-symbols-outlined text-[16px]">delete</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
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
                <input type="number" className="w-full bg-[#0b0c15] border border-slate-700 p-3 text-white rounded-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="0.00" value={purchaseModal.cost} onChange={e => setPurchaseModal(prev => ({ ...prev, cost: e.target.value }))} autoFocus />
            </Modal>

            {/* Refill Cash Modal */}
            <Modal isOpen={refillModal.isOpen} title={`Add Cash for ${refillModal.runnerName}`} type="success" onClose={() => setRefillModal(prev => ({ ...prev, isOpen: false }))} onConfirm={submitRefill} confirmText="Add Cash">
                <div className="space-y-4">
                    <p className="text-slate-400 text-sm">Current starting float: <span className="text-emerald-400 font-bold">${refillModal.currentCash}</span></p>
                    <div>
                        <label className="text-xs text-slate-500 uppercase font-bold mb-1 block">Amount to Add</label>
                        <div className="flex items-center gap-2 bg-[#0b0c15] border border-slate-700 rounded-lg px-3">
                            <span className="text-emerald-400 font-bold text-lg">$</span>
                            <input
                                type="number"
                                className="w-full bg-transparent p-3 text-white text-lg font-bold focus:outline-none"
                                placeholder="100"
                                value={refillModal.amount}
                                onChange={e => setRefillModal(prev => ({ ...prev, amount: e.target.value }))}
                                autoFocus
                            />
                        </div>
                    </div>
                    {refillModal.amount && (
                        <p className="text-slate-400 text-sm">New total: <span className="text-emerald-400 font-bold">${refillModal.currentCash + parseFloat(refillModal.amount || '0')}</span></p>
                    )}
                </div>
            </Modal>

            {/* Reassign Modal */}
            <Modal isOpen={reassignModal.isOpen} title="Reassign Item" type="info" onClose={() => setReassignModal(prev => ({ ...prev, isOpen: false }))}>
                <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto p-1">
                    <button
                        onClick={() => {
                            updateStatus(reassignModal.reqId, 'Pending', '');
                            setReassignModal({ isOpen: false, reqId: '', currentRunner: '' });
                        }}
                        className="p-3 rounded-lg border border-dashed border-slate-500 text-slate-400 hover:bg-slate-800 hover:text-white transition-all text-sm font-bold flex items-center justify-center gap-2 h-14"
                    >
                        <span className="material-symbols-outlined text-lg">person_off</span>
                        Unassign
                    </button>
                    {runners.map(r => (
                        <button
                            key={r.name}
                            onClick={() => {
                                updateStatus(reassignModal.reqId, 'Assigned', r.name);
                                setReassignModal({ isOpen: false, reqId: '', currentRunner: '' });
                            }}
                            className={`p-3 rounded-lg border transition-all text-sm font-bold flex items-center gap-3 h-14 ${reassignModal.currentRunner === r.name ? 'bg-indigo-500 text-white border-indigo-400' : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'}`}
                        >
                            <div className="h-6 w-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px] text-white font-bold border border-slate-600 flex-shrink-0">
                                {getInitials(r.name)}
                            </div>
                            <span className="truncate">{r.name}</span>
                        </button>
                    ))}
                </div>
            </Modal>

            {/* Batch Message Modal */}
            <Modal
                isOpen={batchMessageModal.isOpen}
                title={`Message ${batchMessageModal.requester}`}
                type="info"
                onClose={() => setBatchMessageModal(prev => ({ ...prev, isOpen: false }))}
                confirmText="Send Grouped Message"
                onConfirm={() => {
                    const itemNames = batchMessageModal.items.map(r => (r.item || '').split(' - ')[0].replace(/🚨?\s*ASAP\s*[-:]?\s*/i, '').trim());
                    const formattedList = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' }).format(itemNames);
                    const body = `Hi ${batchMessageModal.requester}! Your ${formattedList} are ready for pickup at the Production Office.`;
                    window.location.href = `sms:${batchMessageModal.phone || ''}&body=${encodeURIComponent(body)}`;

                    // Move all items to Completed
                    batchMessageModal.items.forEach(item => updateStatus(item.id, 'Completed'));
                    setBatchMessageModal(prev => ({ ...prev, isOpen: false }));
                }}
            >
                <div className="space-y-4">
                    <p className="text-slate-300">
                        {batchMessageModal.requester} has <span className="font-bold text-white">{batchMessageModal.items.length} items</span> ready for pickup.
                    </p>
                    <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800 max-h-40 overflow-y-auto">
                        <ul className="list-disc list-inside space-y-1">
                            {batchMessageModal.items.map(r => (
                                <li key={r.id} className="text-xs text-slate-400">{(r.item || '').split(' - ')[0].replace(/🚨?\s*ASAP\s*[-:]?\s*/i, '').trim()}</li>
                            ))}
                        </ul>
                    </div>
                    <p className="text-xs text-slate-500">
                        Send one message for all items?
                    </p>
                </div>
            </Modal>

            {/* Tour Schedule Popup */}
            <Modal isOpen={showSchedulePopup} title="Tour Schedule" type="info" onClose={() => setShowSchedulePopup(false)}>
                <div className="max-h-[60vh] overflow-y-auto -mx-2 px-2">
                    {schedule.length > 0 ? (
                        <div className="space-y-2">
                            {schedule
                                .sort((a, b) => a.date.localeCompare(b.date))
                                .map((show, i) => {
                                    const showDate = new Date(show.date + 'T12:00:00');
                                    const today = new Date();
                                    const isToday = showDate.toDateString() === today.toDateString();
                                    const isPast = showDate < today && !isToday;

                                    return (
                                        <div
                                            key={i}
                                            className={`p-3 rounded-lg border ${isToday ? 'bg-indigo-500/20 border-indigo-500/50' : isPast ? 'bg-slate-900/50 border-slate-800 opacity-50' : 'bg-slate-900/50 border-slate-800'}`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className={`text-sm font-bold ${isToday ? 'text-indigo-400' : 'text-white'}`}>
                                                        {show.venue}
                                                        {isToday && <span className="ml-2 text-xs bg-indigo-500 text-white px-1.5 py-0.5 rounded">TODAY</span>}
                                                    </p>
                                                    <p className="text-xs text-primary mt-0.5">{show.city}</p>
                                                </div>
                                                <span className="text-xs text-slate-500 font-mono">
                                                    {showDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-slate-500">
                            <p>No tour schedule uploaded yet.</p>
                            <p className="text-sm mt-1">Go to Settings → Schedule to upload your tour CSV.</p>
                        </div>
                    )}
                </div>
            </Modal>

            {/* Today's Spend Popup */}
            <Modal isOpen={showSpendPopup} title="Today's Purchases" type="success" onClose={() => setShowSpendPopup(false)}>
                <div className="max-h-[60vh] overflow-y-auto -mx-2 px-2">
                    {(() => {
                        const today = new Date().toDateString();
                        const todayItems = requests.filter(r =>
                            (r.status === 'Purchased' || r.status === 'Completed') &&
                            r.timestamp && new Date(r.timestamp).toDateString() === today
                        );

                        if (todayItems.length === 0) {
                            return (
                                <div className="text-center py-8 text-slate-500">
                                    <p>No purchases yet today.</p>
                                </div>
                            );
                        }

                        return (
                            <div className="space-y-2">
                                {todayItems.map((item, i) => (
                                    <div key={i} className="p-3 rounded-lg bg-slate-900/50 border border-slate-800 flex justify-between items-center">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-white truncate">
                                                {(item.item || 'Untitled').split(' - ')[0].replace(/🚨?\s*ASAP\s*[-:]?\s*/i, '')}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {item.runner && <span className="text-slate-400">{item.runner}</span>}
                                                {item.runner && item.name && ' • '}
                                                for {item.name}
                                            </p>
                                        </div>
                                        <span className="text-emerald-400 font-bold ml-3">
                                            ${parseFloat(item.cost || '0').toFixed(2)}
                                        </span>
                                    </div>
                                ))}
                                <div className="pt-3 mt-3 border-t border-slate-700 flex justify-between items-center">
                                    <span className="text-sm text-slate-400 font-medium">Total</span>
                                    <span className="text-lg font-bold text-emerald-400">
                                        ${getDailySpendTotal().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            </Modal>

            {/* SIDEBAR: Runner Assignments */}
            <aside className="w-80 glass-panel flex flex-col border-r border-glass-border" id="sidebar-assignments">
                <div className="p-8 border-b border-glass-border">
                    <h2 className="text-xl font-bold tracking-tight text-white mb-1">Assigned Runners</h2>
                    <p className="text-sm text-slate-400">Team Status</p>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* GROUP 1: AVAILABLE (Green) */}
                    <div id="group-available">
                        <h3 className="text-xs font-bold text-emerald-500 uppercase mb-3 px-1 tracking-wider flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            Available
                        </h3>
                        <div className="space-y-3">
                            {runners.filter(r => requests.filter(req => req.runner === r.name && (req.status === 'Assigned' || req.status === 'Sent')).length === 0).length > 0 ? (
                                runners.filter(r => requests.filter(req => req.runner === r.name && (req.status === 'Assigned' || req.status === 'Sent')).length === 0).map(runner => {
                                    const cashBalance = getRunnerCashBalance(runner.name, runner.cash ?? 0);
                                    const isLowCash = cashBalance < 100;
                                    const isNegative = cashBalance < 0;
                                    return (
                                        <div key={runner.name} className="glass-card p-4 rounded-xl flex items-center gap-3 group cursor-pointer hover:bg-white/5 border border-emerald-500/30 bg-emerald-500/5 shadow-[0_0_15px_rgba(16,185,129,0.1)]" onClick={() => shareRunnerList(runner.name)}>
                                            <div className="h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-lg flex-shrink-0 transition-colors" style={{ backgroundColor: runner.color || '#6366f1' }}>
                                                {getInitials(runner.name)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className={`text-sm font-semibold truncate transition-colors ${runner.contactType === 'whatsapp' ? 'text-green-400' : 'text-blue-400'}`}>{runner.name}</h4>
                                                <p className="text-xs text-emerald-400 font-bold">Ready for tasks</p>
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setRefillModal({ isOpen: true, runnerName: runner.name, amount: '', currentCash: runner.cash ?? 0 });
                                                }}
                                                className={`text-right flex-shrink-0 px-2 py-1 rounded-lg hover:bg-white/10 transition-all ${isNegative ? 'text-red-400' : isLowCash ? 'text-amber-400' : 'text-emerald-400'}`}
                                            >
                                                <p className="text-xs text-slate-500 flex items-center gap-1">Cash <span className="text-emerald-400">+</span></p>
                                                <p className="text-sm font-bold">${cashBalance.toFixed(0)}</p>
                                            </button>
                                            <div className="h-2 w-2 rounded-full bg-slate-700 flex-shrink-0"></div>
                                        </div>
                                    );
                                })
                            ) : (
                                <p className="text-xs text-slate-600 px-1 italic">No runners available</p>
                            )}
                        </div>
                    </div>

                    {/* GROUP 2: SEND LIST (Amber) - Has 'Assigned' items */}
                    {runners.filter(r => requests.some(req => req.runner === r.name && req.status === 'Assigned')).length > 0 && (
                        <div id="group-send-list">
                            <h3 className="text-xs font-bold text-amber-500 uppercase mb-3 px-1 tracking-wider flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                                Send List
                            </h3>
                            <div className="space-y-3">
                                {runners.filter(r => requests.some(req => req.runner === r.name && req.status === 'Assigned')).map(runner => {
                                    const activeCount = requests.filter(r => r.runner === runner.name && (r.status === 'Assigned' || r.status === 'Sent')).length;
                                    const cashBalance = getRunnerCashBalance(runner.name, runner.cash ?? 0);
                                    const isLowCash = cashBalance < 100;
                                    const isNegative = cashBalance < 0;
                                    return (
                                        <div key={runner.name} className="glass-card p-4 rounded-xl flex items-center gap-3 group cursor-pointer hover:bg-white/5 border border-amber-500/30 bg-amber-500/5 shadow-[0_0_15px_rgba(245,158,11,0.1)]" onClick={() => shareRunnerList(runner.name)}>
                                            <div className="h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-lg flex-shrink-0 transition-colors" style={{ backgroundColor: runner.color || '#6366f1' }}>
                                                {getInitials(runner.name)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className={`text-sm font-semibold truncate transition-colors ${runner.contactType === 'whatsapp' ? 'text-green-400' : 'text-blue-400'}`}>{runner.name}</h4>
                                                <p className="text-xs text-amber-300 font-bold">{activeCount} items pending</p>
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setRefillModal({ isOpen: true, runnerName: runner.name, amount: '', currentCash: runner.cash ?? 0 });
                                                }}
                                                className={`text-right flex-shrink-0 px-2 py-1 rounded-lg hover:bg-white/10 transition-all ${isNegative ? 'text-red-400' : isLowCash ? 'text-amber-400' : 'text-emerald-400'}`}
                                            >
                                                <p className="text-xs text-slate-500 flex items-center gap-1">Cash <span className="text-emerald-400">+</span></p>
                                                <p className="text-sm font-bold">${cashBalance.toFixed(0)}</p>
                                            </button>
                                            <div className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] flex-shrink-0"></div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* GROUP 3: OUT RUNNING (Red) - Has 'Sent' items, NO 'Assigned' */}
                    {runners.filter(r => {
                        const hasAssigned = requests.some(req => req.runner === r.name && req.status === 'Assigned');
                        const hasSent = requests.some(req => req.runner === r.name && req.status === 'Sent');
                        return hasSent && !hasAssigned;
                    }).length > 0 && (
                            <div id="group-out-running">
                                <h3 className="text-xs font-bold text-rose-500 uppercase mb-3 px-1 tracking-wider flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                                    Out Running
                                </h3>
                                <div className="space-y-3">
                                    {runners.filter(r => {
                                        const hasAssigned = requests.some(req => req.runner === r.name && req.status === 'Assigned');
                                        const hasSent = requests.some(req => req.runner === r.name && req.status === 'Sent');
                                        return hasSent && !hasAssigned;
                                    }).map(runner => {
                                        const activeCount = requests.filter(r => r.runner === runner.name && (r.status === 'Assigned' || r.status === 'Sent')).length;
                                        const cashBalance = getRunnerCashBalance(runner.name, runner.cash ?? 0);
                                        const isLowCash = cashBalance < 100;
                                        const isNegative = cashBalance < 0;
                                        return (
                                            <div key={runner.name} className="glass-card p-4 rounded-xl flex items-center gap-3 group cursor-pointer hover:bg-white/5 border border-rose-500/30 bg-rose-500/5 shadow-[0_0_15px_rgba(244,63,94,0.1)]" onClick={() => shareRunnerList(runner.name)}>
                                                <div className="h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-lg flex-shrink-0 transition-colors" style={{ backgroundColor: runner.color || '#6366f1' }}>
                                                    {getInitials(runner.name)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className={`text-sm font-semibold truncate transition-colors ${runner.contactType === 'whatsapp' ? 'text-green-400' : 'text-blue-400'}`}>{runner.name}</h4>
                                                    <p className="text-xs text-rose-300 font-medium">{activeCount} active tasks</p>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setRefillModal({ isOpen: true, runnerName: runner.name, amount: '', currentCash: runner.cash ?? 0 });
                                                    }}
                                                    className={`text-right flex-shrink-0 px-2 py-1 rounded-lg hover:bg-white/10 transition-all ${isNegative ? 'text-red-400' : isLowCash ? 'text-amber-400' : 'text-emerald-400'}`}
                                                >
                                                    <p className="text-xs text-slate-500 flex items-center gap-1">Cash <span className="text-emerald-400">+</span></p>
                                                    <p className="text-sm font-bold">${cashBalance.toFixed(0)}</p>
                                                </button>
                                                <div className="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)] flex-shrink-0"></div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                </div>

                <div className="p-4 border-t border-glass-border space-y-3" id="stats-bar">
                    <div
                        className="glass-card p-4 rounded-xl cursor-pointer hover:bg-white/5 transition-all"
                        onClick={() => setShowSchedulePopup(true)}
                    >
                        <p className="text-xs text-slate-400 font-medium mb-2 flex items-center justify-between">
                            Today's Venue
                            <span className="text-[10px] text-slate-500">View Schedule →</span>
                        </p>
                        <h3 className="text-sm font-bold text-white truncate">{todayInfo?.Venue || 'Loading...'}</h3>
                        <p className="text-xs text-primary mt-1">{todayInfo?.City || 'Unknown City'}</p>
                    </div>

                    {/* Daily Spend Total */}
                    <div
                        className="glass-card p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20 cursor-pointer hover:from-emerald-500/20 transition-all"
                        onClick={() => setShowSpendPopup(true)}
                    >
                        <p className="text-xs text-emerald-400 font-medium mb-1 flex items-center justify-between">
                            Today's Spend
                            <span className="text-[10px] text-emerald-300/50">View Items →</span>
                        </p>
                        <h3 className="text-2xl font-bold text-emerald-400">
                            ${getDailySpendTotal().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </h3>
                    </div>
                </div>
            </aside>

            {/* MAIN CONTENT */}
            <main className="flex-1 flex flex-col h-full relative z-10">
                {/* Header */}
                <header className="h-24 px-8 flex items-center justify-between border-b border-glass-border backdrop-blur-md" id="dashboard-header">
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

                        <a href="/settings" className="h-9 w-9 rounded-full glass-card flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all border border-glass-border">
                            <span className="material-symbols-outlined text-sm">settings</span>
                        </a>

                        <button onClick={() => window.location.reload()} className="h-9 w-9 rounded-full glass-card flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all border border-glass-border">
                            <span className="text-lg">↻</span>
                        </button>
                    </div>
                </header>

                {/* Grid */}
                <div className="flex-1 overflow-y-auto p-8" id="request-feed">
                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
                            {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-48 glass-card rounded-2xl"></div>)}
                        </div>
                    ) : activeTab === 'Active' ? (
                        /* ACTIVE TAB - Grouped by Runner */
                        <div className="pb-20 space-y-10">
                            {/* Unassigned Group */}
                            <div>
                                <div className="flex items-center justify-between mb-4 relative z-20">
                                    <button
                                        onClick={() => toggleSection('unassigned')}
                                        className="text-xl font-bold text-white flex items-center gap-2 hover:text-indigo-300 transition-colors"
                                    >
                                        <span className="w-2 h-8 rounded-full bg-slate-500"></span>
                                        Unassigned Items
                                        <span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded-full">{requests.filter(req => req.status === 'Pending' && (feedFilter.type === 'all' || (feedFilter.type === 'runner') || (feedFilter.type === 'crew' && req.name === feedFilter.value) || (feedFilter.type === 'dept' && req.dept === feedFilter.value))).length}</span>
                                    </button>

                                    {/* FILTER DROPDOWN */}
                                    <div className="relative">
                                        <button
                                            onClick={() => setIsFilterOpen(!isFilterOpen)}
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${feedFilter.type !== 'all' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'}`}
                                        >
                                            <span className="material-symbols-outlined text-sm">filter_list</span>
                                            {feedFilter.type !== 'all' && (
                                                <span className="text-xs font-bold uppercase tracking-wide ml-1">
                                                    {feedFilter.value}
                                                </span>
                                            )}
                                            {feedFilter.type !== 'all' && (
                                                <span
                                                    onClick={(e) => { e.stopPropagation(); setFeedFilter({ type: 'all', value: '' }); }}
                                                    className="ml-1 hover:text-red-300"
                                                >
                                                    ✕
                                                </span>
                                            )}
                                        </button>

                                        {isFilterOpen && (
                                            <>
                                                <div className="fixed inset-0 z-10" onClick={() => setIsFilterOpen(false)}></div>
                                                <div className="absolute right-0 top-full mt-2 w-56 bg-[#161822] border border-slate-700 rounded-xl shadow-2xl z-20 overflow-hidden text-sm animate-in fade-in zoom-in-95 duration-200">
                                                    <div className="p-2 border-b border-slate-800">
                                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-2 mb-1">By Runner</p>
                                                        {runners.map(r => (
                                                            <button
                                                                key={r.name}
                                                                onClick={() => { setFeedFilter({ type: 'runner', value: r.name }); setIsFilterOpen(false); }}
                                                                className="w-full text-left px-2 py-1.5 rounded hover:bg-white/5 text-slate-300 hover:text-white flex items-center gap-2"
                                                            >
                                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color }}></div>
                                                                {r.name}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <div className="p-2 border-b border-slate-800">
                                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-2 mb-1">By Department</p>
                                                        {Array.from(new Set(requests.map(r => r.dept).filter(Boolean))).sort().map(d => (
                                                            <button
                                                                key={d as string}
                                                                onClick={() => { setFeedFilter({ type: 'dept', value: d as string }); setIsFilterOpen(false); }}
                                                                className="w-full text-left px-2 py-1.5 rounded hover:bg-white/5 text-slate-300 hover:text-white"
                                                            >
                                                                {d as string}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <div className="p-2 max-h-40 overflow-y-auto">
                                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-2 mb-1">By Crew</p>
                                                        {Array.from(new Set(requests.map(r => r.name).filter(Boolean))).sort().map(n => (
                                                            <button
                                                                key={n as string}
                                                                onClick={() => { setFeedFilter({ type: 'crew', value: n as string }); setIsFilterOpen(false); }}
                                                                className="w-full text-left px-2 py-1.5 rounded hover:bg-white/5 text-slate-300 hover:text-white truncate"
                                                            >
                                                                {n as string}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {!collapsedSections.has('unassigned') && (
                                    <>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
                                            {requests.filter(req => req.status === 'Pending' && (feedFilter.type === 'all' || (feedFilter.type === 'runner') || (feedFilter.type === 'crew' && req.name === feedFilter.value) || (feedFilter.type === 'dept' && req.dept === feedFilter.value))).map(req => renderRequestCard(req))}
                                        </div>
                                        {requests.filter(req => req.status === 'Pending' && (feedFilter.type === 'all' || (feedFilter.type === 'runner') || (feedFilter.type === 'crew' && req.name === feedFilter.value) || (feedFilter.type === 'dept' && req.dept === feedFilter.value))).length === 0 && (
                                            <div className="text-center py-8 text-slate-600 border-2 border-dashed border-slate-800 rounded-xl">
                                                <p className="text-sm">No unassigned items {feedFilter.type !== 'all' && feedFilter.type !== 'runner' ? 'matching filter' : ''}</p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Runner Groups */}
                            {runners.map(runner => {
                                // Apply Global Filter to Runner Groups
                                if (feedFilter.type === 'runner' && feedFilter.value !== runner.name) return null;

                                const runnerItems = requests.filter(req =>
                                    req.runner === runner.name &&
                                    req.status !== 'Completed' &&
                                    req.status !== 'Pending' &&
                                    (feedFilter.type === 'all' ||
                                        (feedFilter.type === 'crew' && req.name === feedFilter.value) ||
                                        (feedFilter.type === 'dept' && req.dept === feedFilter.value)
                                    )
                                );

                                if (runnerItems.length === 0) return null;
                                return (
                                    <div key={runner.name}>
                                        <button
                                            onClick={() => toggleSection(runner.name)}
                                            className="text-xl font-bold text-white mb-4 flex items-center gap-2 hover:text-indigo-300 transition-colors w-full text-left"
                                        >
                                            <span className="w-2 h-8 rounded-full relative" style={{ backgroundColor: runner.color || '#6366f1' }}>
                                                <div className="absolute inset-0 rounded-full blur-[2px] opacity-50" style={{ backgroundColor: runner.color || '#6366f1' }}></div>
                                            </span>
                                            {runner.name}
                                            <span className="text-xs text-white px-2 py-1 rounded-full" style={{ backgroundColor: `${runner.color || '#6366f1'}33` }}>{runnerItems.length}</span>
                                        </button>

                                        {!collapsedSections.has(runner.name) && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
                                                {runnerItems.map(req => renderRequestCard(req))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Fallback for empty state */}
                            {requests.filter(r => r.status !== 'Completed' && (feedFilter.type === 'all' || (feedFilter.type === 'runner' && r.runner === feedFilter.value) || (feedFilter.type === 'crew' && r.name === feedFilter.value) || (feedFilter.type === 'dept' && r.dept === feedFilter.value))).length === 0 && (
                                <div className="text-center py-20 text-slate-500">
                                    <span className="material-symbols-outlined text-4xl mb-2 opacity-50">inbox</span>
                                    <p>No active requests {feedFilter.type !== 'all' ? 'found for this filter' : 'found'}.</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* COMPLETE TAB - Date-grouped with roll-ups */
                        <div className="space-y-6 pb-20">
                            {groupRequestsByDate(requests.filter(req => req.status === 'Completed')).map(group => (
                                <div key={group.date}>
                                    {/* Date Header */}
                                    {group.isToday ? (
                                        /* Today - just a label, items shown below */
                                        <div className="flex items-center gap-3 mb-4">
                                            <h3 className="text-lg font-bold text-white">Today</h3>
                                            <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">{group.items.length} items</span>
                                            <span className="text-sm text-emerald-400 font-bold">${group.totalCost.toFixed(2)}</span>
                                        </div>
                                    ) : (
                                        /* Past days - collapsible roll-up */
                                        <button
                                            onClick={() => toggleDateExpansion(group.date)}
                                            className="w-full glass-card p-4 rounded-xl flex items-center justify-between hover:bg-white/5 transition-all mb-4"
                                        >
                                            <div className="flex items-center gap-4">
                                                <span className="text-2xl">{expandedDates.has(group.date) ? '▾' : '▸'}</span>
                                                <div>
                                                    <h3 className="text-md font-bold text-white">{formatDateLabel(group.date)}</h3>
                                                    <p className="text-xs text-slate-500">{group.items.length} completed items</p>
                                                </div>
                                            </div>
                                            <span className="text-lg font-bold text-emerald-400">${group.totalCost.toFixed(2)}</span>
                                        </button>
                                    )}

                                    {/* Items Grid - always show for today, toggle for past dates */}
                                    {(group.isToday || expandedDates.has(group.date)) && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {group.items.map(req => (
                                                <div key={req.id} className="glass-card p-4 rounded-xl flex flex-col gap-3">
                                                    <div className="flex justify-between items-start">
                                                        <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md border text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                                                            Completed
                                                        </span>
                                                        <span className="text-slate-500 text-xs font-mono">{getTimeAgo(req.timestamp)}</span>
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-bold text-white">{(req.item || 'Untitled').split(' - ')[0].replace(/🚨?\s*ASAP\s*[-:]?\s*/i, '')}</h4>
                                                        <p className="text-xs text-slate-400 mt-1">Requested by {req.name} • {req.dept || 'Gen'}</p>
                                                    </div>
                                                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/50">
                                                        {req.runner && (
                                                            <div className="flex items-center gap-2">
                                                                <div className="h-6 w-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white">
                                                                    {req.runner.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                                                                </div>
                                                                <span className="text-xs text-slate-400 truncate max-w-[80px]">{req.runner.split(' ')[0]}</span>
                                                            </div>
                                                        )}
                                                        {req.cost && (
                                                            <span className="text-sm font-bold text-emerald-400">${parseFloat(req.cost).toFixed(2)}</span>
                                                        )}
                                                        <button onClick={() => handleDeleteClick(req.id)} className="text-xs text-slate-500 hover:text-red-400">Delete</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                            {requests.filter(req => req.status === 'Completed').length === 0 && (
                                <div className="text-center py-20 text-slate-500">
                                    <p className="text-lg">No completed items yet</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <Tour steps={tourSteps} isOpen={isTourOpen} onClose={() => setIsTourOpen(false)} />
            </main>
        </div>
    );
}
