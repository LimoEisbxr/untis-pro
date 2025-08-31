import { useCallback, useRef } from 'react';
import { api } from '../api';
import { addDays, fmtLocal } from '../utils/dates';
import type { TimetableResponse } from '../types';

// Cache configuration
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes, matching backend TTL
const MAX_CACHE_SIZE = 50; // Maximum number of cached entries

// Cache entry type
interface CacheEntry {
    data: TimetableResponse;
    timestamp: number;
    key: string;
}

// Cache key generation
function generateCacheKey(userId: string, weekStartStr: string, weekEndStr: string): string {
    return `${userId}:${weekStartStr}:${weekEndStr}`;
}

// Global cache storage (persists across component re-renders)
const cache = new Map<string, CacheEntry>();

// Background prefetch queue to avoid duplicate requests
const prefetchQueue = new Set<string>();

// Cache utility functions
function isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > CACHE_TTL_MS;
}

function pruneCache(): void {
    // Remove expired entries
    for (const [key, entry] of cache.entries()) {
        if (isExpired(entry)) {
            cache.delete(key);
        }
    }
    
    // If still too large, remove oldest entries
    if (cache.size > MAX_CACHE_SIZE) {
        const entries = Array.from(cache.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp);
        const toRemove = entries.slice(0, cache.size - MAX_CACHE_SIZE);
        for (const [key] of toRemove) {
            cache.delete(key);
        }
    }
}

function getCachedData(key: string): TimetableResponse | null {
    const entry = cache.get(key);
    if (!entry || isExpired(entry)) {
        if (entry) cache.delete(key);
        return null;
    }
    return entry.data;
}

function setCachedData(key: string, data: TimetableResponse): void {
    cache.set(key, {
        data,
        timestamp: Date.now(),
        key
    });
    pruneCache();
}

// Week calculation utilities
function getWeekDates(weekStartDate: Date): { weekStartStr: string; weekEndStr: string } {
    const weekStartStr = fmtLocal(weekStartDate);
    const weekEndStr = fmtLocal(addDays(weekStartDate, 6));
    return { weekStartStr, weekEndStr };
}

function getPreviousWeekDates(weekStartDate: Date): { weekStartStr: string; weekEndStr: string } {
    const prevWeekStart = addDays(weekStartDate, -7);
    return getWeekDates(prevWeekStart);
}

function getNextWeekDates(weekStartDate: Date): { weekStartStr: string; weekEndStr: string } {
    const nextWeekStart = addDays(weekStartDate, 7);
    return getWeekDates(nextWeekStart);
}

export function useTimetableCache() {
    // Keep track of which fetches are in progress to avoid duplicates
    const inFlightRequests = useRef(new Set<string>());

    const fetchTimetable = useCallback(async (
        url: string,
        token: string,
        cacheKey: string
    ): Promise<TimetableResponse> => {
        // Check if already in flight
        if (inFlightRequests.current.has(cacheKey)) {
            // Wait a bit and try to get from cache
            await new Promise(resolve => setTimeout(resolve, 100));
            const cached = getCachedData(cacheKey);
            if (cached) return cached;
        }

        inFlightRequests.current.add(cacheKey);
        
        try {
            const data = await api<TimetableResponse>(url, { token });
            setCachedData(cacheKey, data);
            return data;
        } finally {
            inFlightRequests.current.delete(cacheKey);
        }
    }, []);

    const prefetchAdjacentWeeks = useCallback(async (
        _userId: string,
        targetUserId: string,
        weekStartDate: Date,
        token: string,
        isOwn: boolean = true
    ): Promise<void> => {
        const adjacentWeeks = [
            getPreviousWeekDates(weekStartDate),
            getNextWeekDates(weekStartDate)
        ];

        for (const { weekStartStr, weekEndStr } of adjacentWeeks) {
            const cacheKey = generateCacheKey(targetUserId, weekStartStr, weekEndStr);
            
            // Skip if already cached or being prefetched
            if (getCachedData(cacheKey) || prefetchQueue.has(cacheKey)) {
                continue;
            }

            prefetchQueue.add(cacheKey);
            
            // Prefetch in background without blocking
            setTimeout(async () => {
                try {
                    const url = isOwn 
                        ? `/api/timetable/me?start=${weekStartStr}&end=${weekEndStr}`
                        : `/api/timetable/user/${targetUserId}?start=${weekStartStr}&end=${weekEndStr}`;
                    
                    await fetchTimetable(url, token, cacheKey);
                } catch (error) {
                    // Ignore prefetch errors
                    console.debug('Prefetch failed for', cacheKey, error);
                } finally {
                    prefetchQueue.delete(cacheKey);
                }
            }, 100); // Small delay to avoid blocking current request
        }
    }, [fetchTimetable]);

    const getTimetableData = useCallback(async (
        userId: string,
        targetUserId: string,
        weekStartDate: Date,
        token: string,
        isOwn: boolean = true
    ): Promise<TimetableResponse> => {
        const { weekStartStr, weekEndStr } = getWeekDates(weekStartDate);
        const cacheKey = generateCacheKey(targetUserId, weekStartStr, weekEndStr);
        
        // Try cache first
        const cached = getCachedData(cacheKey);
        if (cached) {
            // Start background prefetch for adjacent weeks
            prefetchAdjacentWeeks(userId, targetUserId, weekStartDate, token, isOwn);
            return cached;
        }

        // Fetch fresh data
        const url = isOwn 
            ? `/api/timetable/me?start=${weekStartStr}&end=${weekEndStr}`
            : `/api/timetable/user/${targetUserId}?start=${weekStartStr}&end=${weekEndStr}`;
            
        const data = await fetchTimetable(url, token, cacheKey);
        
        // Start background prefetch for adjacent weeks
        prefetchAdjacentWeeks(userId, targetUserId, weekStartDate, token, isOwn);
        
        return data;
    }, [fetchTimetable, prefetchAdjacentWeeks]);

    const invalidateCache = useCallback((userId?: string): void => {
        if (userId) {
            // Invalidate only for specific user
            for (const [key] of cache.entries()) {
                if (key.startsWith(`${userId}:`)) {
                    cache.delete(key);
                }
            }
        } else {
            // Clear entire cache
            cache.clear();
        }
        prefetchQueue.clear();
        inFlightRequests.current.clear();
    }, []);

    const getCacheStats = useCallback(() => {
        return {
            size: cache.size,
            inFlight: inFlightRequests.current.size,
            prefetchQueue: prefetchQueue.size
        };
    }, []);

    return {
        getTimetableData,
        invalidateCache,
        getCacheStats
    };
}