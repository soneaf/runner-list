'use client';
import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export default function WelcomeGuide() {
    const pathname = usePathname();
    const router = useRouter();
    const [show, setShow] = useState(false);
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        // Only run on client
        const hasId = localStorage.getItem('custom_sheet_id');

        // HIDE if on settings page or already has ID
        if (pathname === '/settings' || hasId) {
            setShow(false);
        } else {
            // Conditions to show overlay:
            // 1. User has NOT connected a sheet (already covered by !hasId in the else branch).
            // 2. User is NOT already on the settings page (already covered by pathname !== '/settings' in the else branch).
            // 3. User is NOT clicking a magic Setup link (setup_sheet_id).
            const isMagicLink = window.location.search.includes('setup_sheet_id');

            if (!isMagicLink) {
                setShow(true);
            } else {
                // If it is a magic link, we should hide the welcome guide
                setShow(false);
            }
        }

        setChecked(true);
    }, [pathname]);

    const startSetup = () => {
        setShow(false); // Immediate hide to prevent sticking
        // Go to settings with the 'App Setup' tab active
        router.push('/settings?tab=App Setup');
    };

    if (!checked || !show) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-[#0b0c15]/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="max-w-md w-full bg-[#1e202e] border border-indigo-500/30 rounded-2xl shadow-2xl p-8 relative overflow-hidden">
                {/* Decorative gradients */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -ml-16 -mb-16 pointer-events-none"></div>

                <div className="relative z-10 text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-500/20">
                        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>

                    <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Welcome!</h2>
                    <p className="text-gray-400 mb-8 leading-relaxed">
                        Production logistics made simple. <br />
                        Connect your Google Sheet to get started.
                    </p>

                    <div className="space-y-4">
                        <div className="bg-[#12141f] p-4 rounded-xl border border-white/5 flex items-center text-left gap-4">
                            <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-sm">1</div>
                            <div className="text-sm text-gray-300">Get the official template</div>
                        </div>
                        <div className="bg-[#12141f] p-4 rounded-xl border border-white/5 flex items-center text-left gap-4">
                            <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-sm">2</div>
                            <div className="text-sm text-gray-300">Connect & Invite Bot</div>
                        </div>
                    </div>

                    <button
                        onClick={startSetup}
                        className="mt-8 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-4 rounded-xl transition-all shadow-lg shadow-indigo-900/20 flex items-center justify-center gap-2 group"
                    >
                        Start Setup
                        <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                    </button>

                    <p className="mt-4 text-xs text-gray-500">
                        Takes about 2 minutes.
                    </p>
                </div>
            </div>
        </div>
    );
}
