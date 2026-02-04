'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Modal from '../../../components/Modal';

export default function RunnerPage() {
    const params = useParams();
    // Safety check: Decoded name. Next.js handles decoding but being explicit helps debug.
    const runnerName = decodeURIComponent((params.name as string) || '');

    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [purchaseModal, setPurchaseModal] = useState({ isOpen: false, reqId: '', cost: '' });

    const loadItems = async () => {
        setLoading(true);
        try {
            const storedSheetId = localStorage.getItem('custom_sheet_id');
            const headers: HeadersInit = storedSheetId ? { 'x-custom-sheet-id': storedSheetId } : {};

            const res = await fetch('/api/requests', { headers });
            const data = await res.json();
            if (Array.isArray(data)) {
                // Filter by Runner Name + Active Status
                const myItems = data.filter((r: any) =>
                    (r.runner === runnerName) && (r.status === 'Assigned' || r.status === 'Purchased')
                );
                setItems(myItems);
            } else {
                console.error("Failed to load items:", data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (runnerName) loadItems();
    }, [runnerName]);

    const submitPurchase = async () => {
        if (!purchaseModal.reqId) return;
        const id = purchaseModal.reqId;
        const cost = purchaseModal.cost || '0';

        // Optimistic Update
        setItems(prev => prev.map(r => r.id === id ? { ...r, status: 'Purchased', cost } : r));
        setPurchaseModal({ isOpen: false, reqId: '', cost: '' });

        const storedSheetId = localStorage.getItem('custom_sheet_id');
        const headers: HeadersInit = storedSheetId ? { 'x-custom-sheet-id': storedSheetId } : {};

        await fetch('/api/requests', {
            method: 'PATCH',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status: 'Purchased', cost })
        });
    };

    // Handle Mark Purchased
    const handleAction = async (id: string, action: 'Purchased' | 'Completed') => {
        if (action === 'Purchased') {
            setPurchaseModal({ isOpen: true, reqId: id, cost: '' });
        }
    };

    return (
        <div className="min-h-screen bg-black text-white p-4 font-sans">
            <Modal
                isOpen={purchaseModal.isOpen}
                title="Confirm Purchase"
                type="success"
                onClose={() => setPurchaseModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={submitPurchase}
                confirmText="Mark Bought"
            >
                <p className="mb-4 text-slate-300">Enter the cost:</p>
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                    <input
                        type="number"
                        className="w-full bg-[#0b0c15] border border-slate-700/80 rounded-lg py-3 pl-8 pr-4 text-white placeholder-slate-600 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all"
                        placeholder="0.00"
                        value={purchaseModal.cost}
                        onChange={e => setPurchaseModal(prev => ({ ...prev, cost: e.target.value }))}
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && submitPurchase()}
                    />
                </div>
            </Modal>
            <header className="mb-6 border-b border-gray-800 pb-4">
                <h1 className="text-2xl font-bold text-indigo-400">Runner: {runnerName}</h1>
                <p className="text-gray-500 text-sm">Your active shopping list.</p>
            </header>

            {loading ? (
                <div className="text-center py-10 text-gray-500">Loading list...</div>
            ) : (
                <div className="space-y-4">
                    {items.length === 0 && (
                        <div className="text-center py-10 bg-gray-900 rounded-xl border border-dashed border-gray-800 text-gray-500">
                            No active items found. Good job!
                        </div>
                    )}

                    {items.map(item => (
                        <div key={item.id} className="bg-gray-900 border border-gray-800 p-4 rounded-xl shadow-sm">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex-1 pr-2">
                                    {(() => {
                                        const urlRegex = /(?:Link:\s*)?(https?:\/\/[^\s]+)/i;
                                        const match = item.item ? item.item.match(urlRegex) : null;
                                        const itemUrl = match ? match[1] : null;
                                        let cleanText = (match && item.item) ? item.item.replace(urlRegex, '').trim() : (item.item || '');
                                        cleanText = cleanText.replace(/\s*-\s*$/, '');

                                        return (
                                            <>
                                                <h3 className="font-bold text-lg text-white mb-1">{cleanText}</h3>
                                                {itemUrl && (
                                                    <a href={itemUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 inline-flex items-center gap-1 hover:underline bg-blue-500/10 px-2 py-1.5 rounded border border-blue-500/20 mb-1">
                                                        🔗 View Link
                                                    </a>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                                <span className={`text-xs px-2 py-1 rounded border ${item.status === 'Purchased' ? 'border-purple-500 text-purple-400 bg-purple-900/20' : 'border-blue-500 text-blue-400 bg-blue-900/20'
                                    }`}>
                                    {item.status}
                                </span>
                            </div>

                            {item.store && (
                                <p className="text-sm text-indigo-400 mb-2">🏪 {item.store}</p>
                            )}

                            {item.image_url && (
                                <a href={item.image_url} target="_blank" className="text-xs text-emerald-400 block mb-4 hover:underline">
                                    📷 View Photo
                                </a>
                            )}

                            <div className="pt-2 border-t border-gray-800 flex justify-end">
                                {item.status === 'Assigned' && (
                                    <button
                                        onClick={() => handleAction(item.id, 'Purchased')}
                                        className="bg-green-600 active:bg-green-700 text-white w-full py-3 rounded-lg font-bold text-lg shadow-lg"
                                    >
                                        Mark Bought
                                    </button>
                                )}
                                {item.status === 'Purchased' && (
                                    <div className="text-gray-400 text-sm italic">
                                        Purchased for ${item.cost || '0'}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <button onClick={loadItems} className="fixed bottom-6 right-6 bg-indigo-600 p-4 rounded-full shadow-2xl text-white">
                🔄
            </button>
        </div>
    );
}
