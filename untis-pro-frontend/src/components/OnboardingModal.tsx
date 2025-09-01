import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface OnboardingStep {
    title: string;
    description: string;
    image?: string;
    icon: React.ReactNode;
    target?: string; // CSS selector for element to highlight
    position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
    demoType?: 'highlight' | 'click' | 'type' | 'point';
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
    const [highlightedElement, setHighlightedElement] = useState<Element | null>(null);
    const spotlightRef = useRef<HTMLDivElement>(null);
    const pointerRef = useRef<HTMLDivElement>(null);

    const ANIM_MS = 200;

    const steps: OnboardingStep[] = [
        {
            title: "Welcome to Untis Pro!",
            description: "Let's take a quick tour of the key features that will help you manage your timetable more effectively.",
            position: 'center',
            icon: (
                <svg className="w-12 h-12 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 3v18m9-9H3" />
                </svg>
            )
        },
        {
            title: "Customize Lesson Colors",
            description: "Click on any lesson in your timetable to open details and customize its color. Make your schedule visually organized with your preferred color scheme.",
            target: '.timetable-lesson:first-of-type',
            position: 'right',
            demoType: 'click',
            icon: (
                <svg className="w-12 h-12 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v6a2 2 0 002 2h4a2 2 0 002-2V5z" />
                </svg>
            )
        },
        {
            title: "Share & View Timetables",
            description: "Use the search feature to find and view other students' timetables. Perfect for coordinating study groups or finding shared free periods.",
            target: 'input[placeholder*="Student"], #mobile-search-input',
            position: 'bottom',
            demoType: 'type',
            icon: (
                <svg className="w-12 h-12 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
            )
        },
        {
            title: "Explore Lesson Details",
            description: "Click on any lesson to see detailed information including teacher names, room locations, and any additional notes or homework.",
            target: '.timetable-lesson:nth-of-type(2), .timetable-lesson:first-of-type',
            position: 'left',
            demoType: 'highlight',
            icon: (
                <svg className="w-12 h-12 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            )
        },
        {
            title: "Personalize Your Profile",
            description: "Click the settings icon in the top right to change your display name and customize other preferences to make Untis Pro truly yours.",
            target: 'button[title="Settings"], button[aria-label="Settings"]',
            position: 'bottom',
            demoType: 'point',
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
            setHighlightedElement(null);
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

    // Update highlighted element when step changes
    useEffect(() => {
        if (!isOpen || !isVisible) return;
        
        const currentStepData = steps[currentStep];
        if (currentStepData.target) {
            const element = document.querySelector(currentStepData.target);
            if (element) {
                setHighlightedElement(element);
                // Scroll element into view if needed
                element.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center',
                    inline: 'center'
                });
            } else {
                setHighlightedElement(null);
            }
        } else {
            setHighlightedElement(null);
        }
    }, [currentStep, isOpen, isVisible]);

    // Update spotlight position
    useEffect(() => {
        if (!highlightedElement || !spotlightRef.current) return;

        const updateSpotlight = () => {
            const rect = highlightedElement.getBoundingClientRect();
            const spotlight = spotlightRef.current;
            if (!spotlight) return;

            // Add some padding around the element
            const padding = 8;
            spotlight.style.left = `${rect.left - padding}px`;
            spotlight.style.top = `${rect.top - padding}px`;
            spotlight.style.width = `${rect.width + padding * 2}px`;
            spotlight.style.height = `${rect.height + padding * 2}px`;
        };

        updateSpotlight();
        
        // Update on resize and scroll
        const handleUpdate = () => requestAnimationFrame(updateSpotlight);
        window.addEventListener('resize', handleUpdate);
        window.addEventListener('scroll', handleUpdate, true);
        
        return () => {
            window.removeEventListener('resize', handleUpdate);
            window.removeEventListener('scroll', handleUpdate, true);
        };
    }, [highlightedElement]);

    // Calculate modal position based on highlighted element
    const getModalPosition = () => {
        if (!highlightedElement) return { position: 'center' };
        
        const currentStepData = steps[currentStep];
        const rect = highlightedElement.getBoundingClientRect();
        const viewport = {
            width: window.innerWidth,
            height: window.innerHeight,
        };
        
        switch (currentStepData.position) {
            case 'right':
                if (rect.right + 400 < viewport.width) {
                    return {
                        position: 'fixed',
                        left: rect.right + 20,
                        top: Math.max(20, rect.top - 100),
                    };
                }
                break;
            case 'left':
                if (rect.left - 400 > 0) {
                    return {
                        position: 'fixed',
                        right: viewport.width - rect.left + 20,
                        top: Math.max(20, rect.top - 100),
                    };
                }
                break;
            case 'bottom':
                if (rect.bottom + 300 < viewport.height) {
                    return {
                        position: 'fixed',
                        left: Math.max(20, rect.left - 100),
                        top: rect.bottom + 20,
                    };
                }
                break;
            case 'top':
                if (rect.top - 300 > 0) {
                    return {
                        position: 'fixed',
                        left: Math.max(20, rect.left - 100),
                        bottom: viewport.height - rect.top + 20,
                    };
                }
                break;
        }
        
        // Fallback to center if positioning doesn't work
        return { position: 'center' };
    };

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
    const modalPosition = getModalPosition();

    return createPortal(
        <div
            className={`fixed inset-0 z-50 transition-opacity duration-200 ${
                isVisible ? 'opacity-100' : 'opacity-0'
            }`}
        >
            {/* Backdrop with cutout for highlighted element */}
            <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
                style={{
                    maskImage: highlightedElement 
                        ? `radial-gradient(ellipse at center, transparent 0%, transparent 40%, black 70%)` 
                        : undefined,
                    WebkitMaskImage: highlightedElement 
                        ? `radial-gradient(ellipse at center, transparent 0%, transparent 40%, black 70%)` 
                        : undefined,
                }}
            />
            
            {/* Spotlight highlight */}
            {highlightedElement && (
                <div
                    ref={spotlightRef}
                    className="absolute pointer-events-none rounded-lg border-2 border-sky-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)] transition-all duration-500 ease-out"
                    style={{
                        boxShadow: `
                            0 0 0 2px rgb(56 189 248),
                            0 0 0 9999px rgba(0, 0, 0, 0.4),
                            inset 0 0 0 2px rgba(56, 189, 248, 0.3)
                        `,
                        animation: currentStepData.demoType === 'click' 
                            ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' 
                            : 'glow 3s ease-in-out infinite alternate',
                    }}
                />
            )}

            {/* Animated pointer for click demonstrations */}
            {highlightedElement && currentStepData.demoType === 'click' && (
                <div
                    ref={pointerRef}
                    className="absolute pointer-events-none z-10"
                    style={{
                        left: `${highlightedElement.getBoundingClientRect().left + highlightedElement.getBoundingClientRect().width / 2}px`,
                        top: `${highlightedElement.getBoundingClientRect().top + highlightedElement.getBoundingClientRect().height / 2}px`,
                        transform: 'translate(-50%, -50%)',
                    }}
                >
                    <div className="relative">
                        <div className="w-8 h-8 bg-sky-500 rounded-full flex items-center justify-center text-white animate-ping">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M6.672 1.911a1 1 0 10-1.932.518l.259.966a1 1 0 001.932-.518l-.26-.966zM2.429 4.74a1 1 0 10-.517 1.932l.966.259a1 1 0 00.517-1.932l-.966-.26zm8.814-.569a1 1 0 00-1.415-1.414l-.707.707a1 1 0 101.415 1.414l.707-.707zm-7.071 7.072l.707-.707A1 1 0 003.465 9.12l-.708.707a1 1 0 001.415 1.415zm3.2-5.171a1 1 0 00-1.3 1.3l4 10a1 1 0 001.823.075l1.38-2.759 3.018 3.02a1 1 0 001.414-1.415l-3.019-3.02 2.76-1.379a1 1 0 00-.076-1.822l-10-4z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="absolute inset-0 w-8 h-8 bg-sky-500 rounded-full animate-pulse opacity-75"></div>
                    </div>
                </div>
            )}

            {/* Animated arrow pointer */}
            {highlightedElement && currentStepData.demoType === 'point' && (
                <div
                    className="absolute pointer-events-none z-10"
                    style={{
                        left: `${highlightedElement.getBoundingClientRect().right + 20}px`,
                        top: `${highlightedElement.getBoundingClientRect().top + highlightedElement.getBoundingClientRect().height / 2}px`,
                        transform: 'translateY(-50%)',
                    }}
                >
                    <div className="flex items-center animate-pulse">
                        <svg className="w-8 h-8 text-sky-500 animate-bounce" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </div>
                </div>
            )}

            {/* Typing animation for search demo */}
            {highlightedElement && currentStepData.demoType === 'type' && (
                <div
                    className="absolute pointer-events-none z-10"
                    style={{
                        left: `${highlightedElement.getBoundingClientRect().left + 10}px`,
                        top: `${highlightedElement.getBoundingClientRect().bottom + 10}px`,
                    }}
                >
                    <div className="bg-slate-900 text-white px-3 py-2 rounded-lg text-sm font-mono animate-pulse">
                        <span className="opacity-60">Try typing: "</span>
                        <span className="text-sky-300">john</span>
                        <span className="opacity-60">"</span>
                        <span className="animate-pulse">|</span>
                    </div>
                </div>
            )}

            {/* Modal positioned based on highlighted element */}
            <div
                className={`${modalPosition.position === 'center' 
                    ? 'grid place-items-center inset-0' 
                    : 'absolute'}`}
                style={modalPosition.position !== 'center' ? modalPosition : {}}
            >
                <div
                    className={`relative w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl shadow-2xl ring-1 ring-black/10 dark:ring-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md transition-all duration-200 ease-out will-change-transform will-change-opacity ${
                        modalPosition.position === 'center' ? 'mx-4' : ''
                    } ${
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
            </div>
        </div>,
        document.body
    );
}