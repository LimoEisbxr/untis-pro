// Global type definitions

declare global {
    interface Window {
        onboardingLessonModalStateChange?: (isOpen: boolean) => void;
        resetOnboarding?: () => void;
    }
}

export {};