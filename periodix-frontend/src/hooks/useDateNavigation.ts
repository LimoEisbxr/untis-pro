import { useMemo, useCallback } from 'react';
import { addDays, fmtLocal, startOfWeek, getISOWeekNumber } from '../utils/dates';

interface UseDateNavigationOptions {
    start: string; // Current selected date string
    setStart: (date: string) => void;
}

interface UseDateNavigationReturn {
    // Current week info
    weekStartDate: Date;
    weekStartStr: string;
    weekEndStr: string;
    weekNumber: number;
    
    // Navigation functions
    goToToday: () => void;
    goToPreviousWeek: () => void;
    goToNextWeek: () => void;
    goToWeek: (direction: 'prev' | 'next') => void;
    
    // Week data helpers
    getAdjacentWeekDate: (direction: 'prev' | 'next') => Date;
    getAdjacentWeekRange: (direction: 'prev' | 'next') => {
        startStr: string;
        endStr: string;
        startDate: Date;
    };
    
    // Current week days
    weekDays: Date[];
}

/**
 * Hook for date navigation and week calculations
 */
export function useDateNavigation({
    start,
    setStart
}: UseDateNavigationOptions): UseDateNavigationReturn {
    // Compute the week range based on the selected date
    const weekStartDate = useMemo(() => startOfWeek(new Date(start)), [start]);
    
    const weekStartStr = useMemo(
        () => fmtLocal(weekStartDate),
        [weekStartDate]
    );
    
    const weekEndStr = useMemo(
        () => fmtLocal(addDays(weekStartDate, 6)),
        [weekStartDate]
    );
    
    const weekNumber = useMemo(
        () => getISOWeekNumber(weekStartDate),
        [weekStartDate]
    );
    
    const weekDays = useMemo(
        () => Array.from({ length: 7 }, (_, i) => addDays(weekStartDate, i)),
        [weekStartDate]
    );

    const getAdjacentWeekDate = useCallback((direction: 'prev' | 'next') => {
        const targetDate = direction === 'prev' 
            ? addDays(weekStartDate, -7) 
            : addDays(weekStartDate, 7);
        return startOfWeek(targetDate);
    }, [weekStartDate]);

    const getAdjacentWeekRange = useCallback((direction: 'prev' | 'next') => {
        const targetDate = getAdjacentWeekDate(direction);
        const targetWeekStartStr = fmtLocal(targetDate);
        const targetWeekEndStr = fmtLocal(addDays(targetDate, 6));
        
        return {
            startStr: targetWeekStartStr,
            endStr: targetWeekEndStr,
            startDate: targetDate,
        };
    }, [getAdjacentWeekDate]);

    const goToToday = useCallback(() => {
        setStart(fmtLocal(new Date()));
    }, [setStart]);

    const goToPreviousWeek = useCallback(() => {
        const prevWeek = getAdjacentWeekDate('prev');
        setStart(fmtLocal(prevWeek));
    }, [getAdjacentWeekDate, setStart]);

    const goToNextWeek = useCallback(() => {
        const nextWeek = getAdjacentWeekDate('next');
        setStart(fmtLocal(nextWeek));
    }, [getAdjacentWeekDate, setStart]);

    const goToWeek = useCallback((direction: 'prev' | 'next') => {
        if (direction === 'prev') {
            goToPreviousWeek();
        } else {
            goToNextWeek();
        }
    }, [goToPreviousWeek, goToNextWeek]);

    return {
        weekStartDate,
        weekStartStr,
        weekEndStr,
        weekNumber,
        goToToday,
        goToPreviousWeek,
        goToNextWeek,
        goToWeek,
        getAdjacentWeekDate,
        getAdjacentWeekRange,
        weekDays,
    };
}