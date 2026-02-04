'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';

export default function AppSetupListener() {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const router = useRouter();
    const [connectedId, setConnectedId] = useState<string | null>(null);

    useEffect(() => {
        const setupId = searchParams.get('setup_sheet_id');
        if (setupId) {
            // Save to LocalStorage
            localStorage.setItem('custom_sheet_id', setupId);
            setConnectedId(setupId);

            // Clean URL
            const url = new URL(window.location.href);
            url.searchParams.delete('setup_sheet_id');
            window.history.replaceState({}, '', url.toString());

            // Reload to ensure all components pick up the new ID immediately
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        }
    }, [searchParams]);

    if (!connectedId) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-emerald-600 text-white p-4 shadow-xl flex items-center justify-center gap-3 animate-in fade-in slide-in-from-top-2">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div className="font-semibold">
                App Connected! You are now viewing data from the shared Sheet.
            </div>
        </div>
    );
}
