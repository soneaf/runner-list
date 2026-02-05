'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';

export interface TourStep {
    target: string;
    title: string;
    content: string;
    position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

interface TourProps {
    steps: TourStep[];
    isOpen: boolean;
    onClose: () => void;
}

export default function Tour({ steps, isOpen, onClose }: TourProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const [rect, setRect] = useState<DOMRect | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const handleResize = () => updateRect();
        window.addEventListener('resize', handleResize);
        window.addEventListener('scroll', handleResize, true);
        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('scroll', handleResize, true);
        };
    }, []);

    const updateRect = useCallback(() => {
        if (!isOpen) return;
        const step = steps[currentStep];
        const element = document.getElementById(step.target);
        if (element) {
            const r = element.getBoundingClientRect();
            // Check if off screen and scroll
            if (r.top < 0 || r.bottom > window.innerHeight || r.left < 0 || r.right > window.innerWidth) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Wait for scroll
                setTimeout(() => {
                    const newR = element.getBoundingClientRect();
                    setRect(newR);
                }, 500);
            } else {
                setRect(r);
            }
        } else {
            // If target not found, maybe just rect centered? or skip?
            setRect(null);
        }
    }, [currentStep, isOpen, steps]);

    useEffect(() => {
        if (isOpen) {
            updateRect();
            // Small delay to allow layout to settle if triggered immediately
            setTimeout(updateRect, 100);
        }
    }, [isOpen, currentStep, updateRect]);

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            onClose();
            setCurrentStep(0);
        }
    };

    const handlePrev = () => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        }
    };

    if (!isOpen || !mounted) return null;

    const step = steps[currentStep];

    return createPortal(
        <div className="fixed inset-0 z-[100] overflow-hidden">
            {/* Highlight Box with Backdrop Shadow - Only if rect exists */}
            {rect && (
                <div
                    className="absolute border-2 border-indigo-400 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.7),0_0_30px_rgba(99,102,241,0.5)] transition-all duration-500 ease-out z-[101] pointer-events-none"
                    style={{
                        top: rect.top - 10,
                        left: rect.left - 10,
                        width: rect.width + 20,
                        height: rect.height + 20,
                    }}
                />
            )}

            {/* Fallback Backdrop when no rect (target missing) */}
            {!rect && (
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-[101]" />
            )}

            {/* Tooltip Card - Always render if isOpen */}
            <div
                className="fixed z-[102] transition-all duration-500 ease-out flex flex-col justify-center"
                style={{
                    top: rect ? (
                        step.position === 'top' ? rect.top - 10 :
                            step.position === 'bottom' ? rect.bottom + 20 :
                                rect.top + (rect.height / 2)
                    ) : '50%',
                    left: rect ? (
                        step.position === 'left' ? rect.left - 20 :
                            step.position === 'right' ? rect.right + 20 :
                                rect.left + (rect.width / 2)
                    ) : '50%',
                    transform: rect ? (
                        step.position === 'top' ? 'translate(-50%, -100%)' :
                            step.position === 'bottom' ? 'translate(-50%, 0)' :
                                step.position === 'left' ? 'translate(-100%, -50%)' :
                                    'translate(0, -50%)'
                    ) : 'translate(-50%, -50%)',
                    width: 320,
                }}
            >
                <div className="bg-[#1e1e2d] border border-white/10 p-6 rounded-2xl shadow-2xl w-full animate-in zoom-in-95 duration-300">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                            Step {currentStep + 1} of {steps.length}
                        </span>
                        {!rect && (
                            <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded border border-slate-600">
                                Feature hidden
                            </span>
                        )}
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">{step.title}</h3>
                    <p className="text-slate-400 text-sm mb-6 leading-relaxed border-b border-white/5 pb-4">
                        {step.content}
                    </p>

                    <div className="flex justify-between items-center">
                        <div className="flex gap-1">
                            {steps.map((_, i) => (
                                <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i === currentStep ? 'bg-indigo-500' : 'bg-slate-700'}`} />
                            ))}
                        </div>
                        <div className="flex gap-2">
                            {currentStep > 0 && (
                                <button onClick={handlePrev} className="text-slate-400 hover:text-white text-sm font-medium px-3 py-2">
                                    Back
                                </button>
                            )}
                            <button
                                onClick={handleNext}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg font-bold text-sm shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
                            >
                                {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
