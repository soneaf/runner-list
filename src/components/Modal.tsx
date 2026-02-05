'use client';
import { ReactNode } from 'react';

interface ModalProps {
    isOpen: boolean;
    title: string;
    children: ReactNode;
    onClose: () => void;
    onConfirm?: () => void;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'info' | 'success';
}

export default function Modal({
    isOpen,
    title,
    children,
    onClose,
    onConfirm,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    type = 'danger'
}: ModalProps) {
    if (!isOpen) return null;

    const isInfo = type === 'info' || type === 'success';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#12141f] border border-slate-700/80 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative animate-in zoom-in-95 duration-200">
                <h3 className={`text-xl font-bold mb-2 ${type === 'success' ? 'text-emerald-400' : 'text-white'}`}>
                    {title}
                </h3>

                <div className="text-gray-400 mb-6 text-sm leading-relaxed">
                    {children}
                </div>

                <div className="flex justify-end gap-3">
                    {/* Only show Cancel if it's not a pure info modal, or if the user explicitly wants a close button (which is Cancel usually) */}
                    {onConfirm && (
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white bg-slate-800/50 hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            {cancelText}
                        </button>
                    )}

                    {onConfirm ? (
                        <button
                            onClick={onConfirm}
                            className={`px-4 py-2 text-sm font-bold text-white rounded-lg transition-colors shadow-lg 
                                ${type === 'danger' ? 'bg-red-600 hover:bg-red-500 shadow-red-900/20' :
                                    type === 'success' ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20' :
                                        'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/20'}`}
                        >
                            {confirmText}
                        </button>
                    ) : (
                        // If no onConfirm, just a Close button (acting as the primary action for info modals)
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-lg shadow-indigo-900/20"
                        >
                            {confirmText === 'Confirm' ? 'Okay' : confirmText}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
