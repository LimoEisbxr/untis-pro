import { useState, useRef, useCallback, useEffect } from 'react';
import { API_BASE } from '../api';

export interface SearchUser {
    id: string;
    username: string;
    displayName: string | null;
}

interface UseUserSearchOptions {
    token: string;
    debounceMs?: number;
}

interface UseUserSearchReturn {
    queryText: string;
    setQueryText: (text: string) => void;
    results: SearchUser[];
    searchLoading: boolean;
    searchError: string | null;
    selectedUser: SearchUser | null;
    setSelectedUser: (user: SearchUser | null) => void;
    clearSearch: () => void;
    lastResults: SearchUser[];
    mobileSearchOpen: boolean;
    setMobileSearchOpen: (open: boolean) => void;
    searchBoxRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Hook for user search functionality with debouncing and error handling
 */
export function useUserSearch({ 
    token, 
    debounceMs = 300 
}: UseUserSearchOptions): UseUserSearchReturn {
    const [queryText, setQueryText] = useState('');
    const [results, setResults] = useState<SearchUser[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null);
    const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
    
    // Persist last successful results so they don't vanish while a new request is in-flight
    const lastResultsRef = useRef<SearchUser[]>([]);
    const abortRef = useRef<AbortController | null>(null);
    const searchBoxRef = useRef<HTMLDivElement | null>(null);
    const debounceRef = useRef<number | null>(null);

    // Auto-focus mobile search input when overlay opens
    useEffect(() => {
        if (mobileSearchOpen) {
            const t = setTimeout(() => {
                const el = document.getElementById(
                    'mobile-search-input'
                ) as HTMLInputElement | null;
                el?.focus();
            }, 30);
            return () => clearTimeout(t);
        }
    }, [mobileSearchOpen]);

    const performSearch = useCallback(async (query: string) => {
        if (!query.trim()) {
            setResults([]);
            setSearchError(null);
            setSearchLoading(false);
            return;
        }

        // Cancel any pending request
        if (abortRef.current) {
            abortRef.current.abort();
        }

        const controller = new AbortController();
        abortRef.current = controller;
        
        setSearchLoading(true);
        setSearchError(null);

        try {
            const response = await fetch(
                `${API_BASE}/users/search?q=${encodeURIComponent(query)}`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                    signal: controller.signal,
                }
            );

            if (!response.ok) {
                throw new Error('Search failed');
            }

            const data = await response.json();
            const searchResults = data.users || [];
            
            setResults(searchResults);
            lastResultsRef.current = searchResults;
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                // Request was cancelled, ignore
                return;
            }
            
            setSearchError('Failed to search users');
            // Keep last results on error
            setResults(lastResultsRef.current);
        } finally {
            setSearchLoading(false);
            abortRef.current = null;
        }
    }, [token]);

    // Debounced search effect
    useEffect(() => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        debounceRef.current = window.setTimeout(() => {
            performSearch(queryText);
        }, debounceMs);

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [queryText, performSearch, debounceMs]);

    const clearSearch = useCallback(() => {
        setQueryText('');
        setResults([]);
        setSearchError(null);
        setSelectedUser(null);
        setMobileSearchOpen(false);
        
        // Cancel any pending request
        if (abortRef.current) {
            abortRef.current.abort();
            abortRef.current = null;
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (abortRef.current) {
                abortRef.current.abort();
            }
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, []);

    return {
        queryText,
        setQueryText,
        results,
        searchLoading,
        searchError,
        selectedUser,
        setSelectedUser,
        clearSearch,
        lastResults: lastResultsRef.current,
        mobileSearchOpen,
        setMobileSearchOpen,
        searchBoxRef,
    };
}