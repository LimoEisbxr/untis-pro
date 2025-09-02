/**
 * Lesson gradient offset management utilities
 */

export type GradientOffsets = Record<string, number>;

/**
 * Storage keys for gradient offsets
 */
export function getStorageKeys(isAdmin: boolean) {
    return {
        userKey: isAdmin ? 'adminLessonGradientOffsets' : 'lessonGradientOffsets:self',
        legacyKey: 'lessonGradientOffsets'
    };
}

/**
 * Load gradient offsets from localStorage with fallback to legacy key
 */
export function loadGradientOffsets(
    isAdmin: boolean, 
    serverOffsets?: GradientOffsets
): GradientOffsets {
    const { userKey, legacyKey } = getStorageKeys(isAdmin);
    
    try {
        // Attempt to load user-scoped first
        const raw = localStorage.getItem(userKey);
        if (raw) return JSON.parse(raw);
        
        // Migrate legacy key once if present
        const legacy = localStorage.getItem(legacyKey);
        if (legacy) {
            localStorage.setItem(userKey, legacy);
            return JSON.parse(legacy);
        }
    } catch {
        // Ignore localStorage errors
    }
    
    return serverOffsets || {};
}

/**
 * Save gradient offsets to localStorage
 */
export function saveGradientOffsets(offsets: GradientOffsets, isAdmin: boolean): void {
    const { userKey } = getStorageKeys(isAdmin);
    
    try {
        localStorage.setItem(userKey, JSON.stringify(offsets));
    } catch {
        // Ignore localStorage errors
    }
}

/**
 * Update a single gradient offset
 */
export function updateGradientOffset(
    currentOffsets: GradientOffsets,
    lessonName: string,
    offset: number,
    isAdmin: boolean
): GradientOffsets {
    const next = { ...currentOffsets };
    
    // Remove default offset (0.5) to keep storage clean
    if (offset === 0.5) {
        delete next[lessonName];
    } else {
        next[lessonName] = offset;
    }
    
    // Save to localStorage
    saveGradientOffsets(next, isAdmin);
    
    return next;
}

/**
 * Merge server offsets with local offsets, preferring server values
 */
export function mergeServerOffsets(
    localOffsets: GradientOffsets,
    serverOffsets: GradientOffsets
): GradientOffsets {
    // Prefer fresh server values over any cached local ones to avoid stale offsets
    return { ...localOffsets, ...serverOffsets };
}

/**
 * Debounced gradient offset persistence manager
 */
export class GradientOffsetManager {
    private timers: Record<string, number> = {};
    private debounceMs: number;
    
    constructor(debounceMs: number = 600) {
        this.debounceMs = debounceMs;
    }
    
    /**
     * Schedule a debounced persistence operation
     */
    schedulePersistence(
        lessonName: string,
        offset: number,
        persistFn: (lessonName: string, offset: number) => Promise<void>
    ): void {
        // Clear any pending timer for this lesson
        const existing = this.timers[lessonName];
        if (existing) {
            window.clearTimeout(existing);
        }
        
        // Schedule new persistence after user stops adjusting
        this.timers[lessonName] = window.setTimeout(() => {
            persistFn(lessonName, offset).catch(() => undefined);
            delete this.timers[lessonName];
        }, this.debounceMs);
    }
    
    /**
     * Clear all pending timers (for cleanup)
     */
    clearAll(): void {
        Object.values(this.timers).forEach((id) => window.clearTimeout(id));
        this.timers = {};
    }
    
    /**
     * Clear timer for a specific lesson
     */
    clear(lessonName: string): void {
        const timer = this.timers[lessonName];
        if (timer) {
            window.clearTimeout(timer);
            delete this.timers[lessonName];
        }
    }
}