import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface OnboardingStep {
    title: string;
    description: string;
    image?: string;
    icon: React.ReactNode;
}

export default function OnboardingModal({
    isOpen,
    onClose,
    onComplete,
}: {
    isOpen: boolean;
    onClose: () => void;
    onComplete: () => void;
}) {
    const [showModal, setShowModal] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);

    const ANIM_MS = 200;

    const steps: OnboardingStep[] = [
        {
            title: "Welcome to Untis Pro!",
            description: "Let's take a quick tour of the key features that will help you manage your timetable more effectively.",
            icon: (
                <svg className="w-12 h-12 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 3v18m9-9H3" />
                </svg>
            )
        },
        {
            title: "Customize Lesson Colors",
            description: "Click on any lesson in your timetable to open details and customize its color. Make your schedule visually organized with your preferred color scheme.",
            icon: (
                <svg className="w-12 h-12 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v6a2 2 0 002 2h4a2 2 0 002-2V5z" />
                </svg>
            )
        },
        {
            title: "Share & View Timetables",
            description: "Use the search feature to find and view other students' timetables. Perfect for coordinating study groups or finding shared free periods.",
            icon: (
                <svg className="w-12 h-12 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
            )
        },
        {
            title: "Explore Lesson Details",
            description: "Click on any lesson to see detailed information including teacher names, room locations, and any additional notes or homework.",
            icon: (
                <svg className="w-12 h-12 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            )
        },
        {
            title: "Personalize Your Profile",
            description: "Click the settings icon in the top right to change your display name and customize other preferences to make Untis Pro truly yours.",
            icon: (
                <svg className="w-12 h-12 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
            )
        }
    ];

    useEffect(() => {
        let t: number | undefined;
        let raf1: number | undefined;
        let raf2: number | undefined;
        
        if (isOpen) {
            if (!showModal) setShowModal(true);
            setIsVisible(false);
            // Use double rAF to guarantee initial styles are committed before transition
            raf1 = requestAnimationFrame(() => {
                raf2 = requestAnimationFrame(() => setIsVisible(true));
            });
        } else if (showModal) {
            setIsVisible(false);
            t = window.setTimeout(() => {
                setShowModal(false);
                // Reset to first step when modal closes
                setCurrentStep(0);
            }, ANIM_MS);
        }
        
        return () => {
            if (t) window.clearTimeout(t);
            if (raf1) cancelAnimationFrame(raf1);
            if (raf2) cancelAnimationFrame(raf2);
        };
    }, [isOpen, showModal]);

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            handleComplete();
        }
    };

    const handlePrevious = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleComplete = () => {
        onComplete();
        onClose();
    };

    const handleSkip = () => {
        onComplete();
        onClose();
    };

    if (!showModal) return null;

    const currentStepData = steps[currentStep];
    const isFirstStep = currentStep === 0;
    const isLastStep = currentStep === steps.length - 1;

    return createPortal(
        <div
            className={`fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${
                isVisible ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={onClose}
        >
            <div
                className={`relative w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl shadow-2xl ring-1 ring-black/10 dark:ring-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md transition-all duration-200 ease-out will-change-transform will-change-opacity ${
                    isVisible
                        ? 'opacity-100 translate-y-0 scale-100'
                        : 'opacity-0 translate-y-2 scale-95'
                }`}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="onboarding-title"
            >
                <div className="p-6">
                    {/* Header with progress */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                            Step {currentStep + 1} of {steps.length}
                        </div>
                        <button
                            onClick={handleSkip}
                            className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                        >
                            Skip tour
                        </button>
                    </div>

                    {/* Progress bar */}
                    <div className="mb-8">
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                            <div 
                                className="bg-gradient-to-r from-sky-500 to-indigo-500 h-2 rounded-full transition-all duration-300 ease-out"
                                style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                            />
                        </div>
                    </div>

                    {/* Step content */}
                    <div className="text-center mb-8">
                        <div className="flex justify-center mb-4">
                            <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                {currentStepData.icon}
                            </div>
                        </div>
                        
                        <h2 id="onboarding-title" className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-3">
                            {currentStepData.title}
                        </h2>
                        
                        <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                            {currentStepData.description}
                        </p>
                    </div>

                    {/* Navigation buttons */}
                    <div className="flex gap-3">
                        <button
                            onClick={handlePrevious}
                            disabled={isFirstStep}
                            className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-all duration-200 ${
                                isFirstStep
                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                                    : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200'
                            }`}
                        >
                            Previous
                        </button>
                        
                        <button
                            onClick={handleNext}
                            className="flex-1 py-2.5 px-4 rounded-lg font-medium bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600 text-white transition-all duration-200 shadow-lg hover:shadow-xl"
                        >
                            {isLastStep ? 'Get Started!' : 'Next'}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}