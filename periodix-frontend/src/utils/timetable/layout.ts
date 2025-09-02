/**
 * Timetable layout calculations and responsive configuration
 */

export interface TimetableLayout {
    SCALE: number;
    axisWidth: number;
    DAY_HEADER_PX: number;
    BOTTOM_PAD_PX: number;
}

/**
 * Calculate responsive timetable layout based on viewport size and total minutes
 */
export function calculateTimetableLayout(
    totalMinutes: number,
    viewportHeight: number = 800,
    viewportWidth: number = 1024
): TimetableLayout {
    const isMobile = viewportWidth < 640;
    
    if (isMobile) {
        // Mobile: keep more compact (1.0–1.15 px/min) to avoid excessive scrolling
        const targetHeight = Math.min(
            880,
            Math.max(660, Math.floor(viewportHeight * 0.9))
        );
        
        return {
            SCALE: targetHeight / totalMinutes,
            axisWidth: viewportWidth < 400 ? 40 : 44,
            DAY_HEADER_PX: 40, // a little taller, easier tap
            BOTTOM_PAD_PX: 6,
        };
    } else {
        // Desktop: more spacious layout
        const targetHeight = Math.max(560, Math.floor(viewportHeight * 0.78));
        
        return {
            SCALE: targetHeight / totalMinutes,
            axisWidth: 56,
            DAY_HEADER_PX: 32,
            BOTTOM_PAD_PX: 14,
        };
    }
}

/**
 * Touch gesture constants and utilities
 */
export const TOUCH_CONSTANTS = {
    SWIPE_THRESHOLD: 80, // px - distance needed to commit to navigation
    VELOCITY_THRESHOLD: 0.3, // px/ms - speed needed for fast swipe
    MAX_TOUCH_DURATION: 500, // ms - max time for fast swipe detection
    HORIZONTAL_LOCK_RATIO: 2, // horizontal:vertical ratio to lock horizontal swipe
} as const;

/**
 * Calculate if a touch gesture should trigger week navigation
 */
export function shouldNavigateWeek(
    startX: number,
    startY: number,
    currentX: number,
    currentY: number,
    startTime: number,
    currentTime: number = Date.now()
): { shouldNavigate: boolean; direction: 'prev' | 'next' | null } {
    const deltaX = currentX - startX;
    const deltaY = Math.abs(currentY - startY);
    const deltaTime = currentTime - startTime;
    const velocity = Math.abs(deltaX) / Math.max(deltaTime, 1);
    
    // Check if this is primarily a horizontal gesture
    const isHorizontalGesture = Math.abs(deltaX) > deltaY * TOUCH_CONSTANTS.HORIZONTAL_LOCK_RATIO;
    
    if (!isHorizontalGesture) {
        return { shouldNavigate: false, direction: null };
    }
    
    // Fast swipe detection
    const isFastSwipe = velocity > TOUCH_CONSTANTS.VELOCITY_THRESHOLD && 
                       deltaTime < TOUCH_CONSTANTS.MAX_TOUCH_DURATION;
    
    // Distance-based detection
    const isLongSwipe = Math.abs(deltaX) > TOUCH_CONSTANTS.SWIPE_THRESHOLD;
    
    if (isFastSwipe || isLongSwipe) {
        return {
            shouldNavigate: true,
            direction: deltaX > 0 ? 'prev' : 'next'
        };
    }
    
    return { shouldNavigate: false, direction: null };
}

/**
 * Calculate smooth animation easing for week transitions
 */
export function easeOutQuart(t: number): number {
    return 1 - Math.pow(1 - t, 4);
}

/**
 * Week navigation animation configuration
 */
export const ANIMATION_CONFIG = {
    DURATION: 300, // ms
    EASING: easeOutQuart,
    RUBBER_BAND_RESISTANCE: 0.3, // Resistance when dragging beyond bounds
} as const;

/**
 * Calculate rubber band effect for dragging beyond week boundaries
 */
export function applyRubberBandResistance(
    offset: number,
    containerWidth: number,
    resistance: number = ANIMATION_CONFIG.RUBBER_BAND_RESISTANCE
): number {
    const maxOffset = containerWidth;
    
    if (Math.abs(offset) <= maxOffset) {
        return offset;
    }
    
    const sign = offset > 0 ? 1 : -1;
    const excess = Math.abs(offset) - maxOffset;
    const resistedExcess = excess * resistance;
    
    return sign * (maxOffset + resistedExcess);
}