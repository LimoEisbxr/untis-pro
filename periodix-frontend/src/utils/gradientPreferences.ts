/**
 * Utility functions for gradient preferences
 */

const HIDE_ADMIN_DEFAULTS_KEY = 'hideAdminDefaultGradients';

/**
 * Get the hideAdminDefaults preference from localStorage
 */
export const getHideAdminDefaultsPreference = (): boolean => {
    try {
        const stored = localStorage.getItem(HIDE_ADMIN_DEFAULTS_KEY);
        return stored ? JSON.parse(stored) : false;
    } catch {
        return false;
    }
};

/**
 * Set the hideAdminDefaults preference in localStorage
 */
export const setHideAdminDefaultsPreference = (value: boolean): void => {
    try {
        localStorage.setItem(HIDE_ADMIN_DEFAULTS_KEY, JSON.stringify(value));
        
        // Dispatch a custom event to notify components in the same tab
        // The standard 'storage' event only fires in other tabs
        window.dispatchEvent(new CustomEvent('hideAdminDefaultsChanged', {
            detail: { value }
        }));
    } catch (error) {
        console.warn('Failed to save gradient preference to localStorage:', error);
    }
};