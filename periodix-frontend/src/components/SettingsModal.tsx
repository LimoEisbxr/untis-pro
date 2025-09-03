import { useState, useEffect, useCallback } from 'react';
import type {
    User,
} from '../types';
import {
    getSharingSettings,
} from '../api';

// Import modular components
import TabNavigation from './settings/TabNavigation';
import NicknameChange from './settings/NicknameChange';
import NotificationSettingsComponent from './settings/NotificationSettings';
import SharingSettingsComponent from './settings/SharingSettings';
import AdminUserManagement from './settings/AdminUserManagement';
import UserManagerAccessManagement from './settings/UserManagerAccessManagement';
import AdminAccessManagement from './settings/AdminAccessManagement';

export default function SettingsModal({
    token,
    user,
    isOpen,
    onClose,
    onUserUpdate,
}: {
    token: string;
    user: User;
    isOpen: boolean;
    onClose: () => void;
    onUserUpdate?: (u: User) => void;
}) {
    // Close/open animation state with enter transition
    const [showModal, setShowModal] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const ANIM_MS = 200;
    useEffect(() => {
        let t: number | undefined;
        let raf1: number | undefined;
        let raf2: number | undefined;
        if (isOpen) {
            if (!showModal) setShowModal(true);
            // Start hidden, then two RAFs to ensure layout is applied before transition
            setIsVisible(false);
            raf1 = requestAnimationFrame(() => {
                raf2 = requestAnimationFrame(() => setIsVisible(true));
            });
        } else if (showModal) {
            // Trigger exit transition then unmount after duration
            setIsVisible(false);
            t = window.setTimeout(() => {
                setShowModal(false);
            }, ANIM_MS);
        }
        return () => {
            if (t) window.clearTimeout(t);
            if (raf1) cancelAnimationFrame(raf1);
            if (raf2) cancelAnimationFrame(raf2);
        };
    }, [isOpen, showModal]);

    // Tab state for organized settings menu - different tabs for different user types
    const [activeTab, setActiveTab] = useState<string>(() => {
        if (user.isAdmin) return 'access';
        if (user.isUserManager) return 'nickname';
        return 'nickname'; // Regular users start with nickname tab
    });

    // Load settings when modal opens (for future use by modular components)
    const loadSettings = useCallback(async () => {
        try {
            const sharingSettings = await getSharingSettings(token);
            // Settings will be used by modular components
            console.log('Settings loaded:', sharingSettings);
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }, [token]);

    useEffect(() => {
        if (isOpen) {
            loadSettings();
        }
    }, [isOpen, loadSettings]);

    if (!showModal) return null;

    return (
        <div
            className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 transition-opacity duration-${ANIM_MS} ${
                isVisible ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={onClose}
        >
            <div
                className={`bg-white dark:bg-slate-800 rounded-lg shadow-lg w-full max-w-2xl mx-4 transition-all duration-${ANIM_MS} ${
                    isVisible
                        ? 'opacity-100 scale-100'
                        : 'opacity-0 scale-95'
                }`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                        Settings
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    </button>
                </div>

                <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
                    <div className="p-6">
                        {/* Tab Navigation */}
                        <TabNavigation 
                            user={user}
                            activeTab={activeTab}
                            onTabChange={setActiveTab}
                        />

                        {/* Tab Content */}
                        {/* Nickname Change Tab */}
                        <NicknameChange
                            token={token}
                            user={user}
                            onUserUpdate={onUserUpdate}
                            isVisible={activeTab === 'nickname'}
                        />

                        {/* Personal Sharing Settings Tab - Available for Users and User-Managers */}
                        <SharingSettingsComponent
                            token={token}
                            user={user}
                            onUserUpdate={onUserUpdate}
                            isVisible={activeTab === 'sharing' && !user.isAdmin}
                        />

                        {/* Notification Settings Tab - Available for Users and User-Managers */}
                        <NotificationSettingsComponent
                            token={token}
                            user={user}
                            isVisible={activeTab === 'notifications' && !user.isAdmin}
                        />

                        {/* Whitelist & Access Request Tab - Available for User-Managers and Admins */}
                        {user.isUserManager && !user.isAdmin && activeTab === 'access' && (
                            <UserManagerAccessManagement
                                token={token}
                                user={user}
                                isVisible={true}
                            />
                        )}

                        {user.isAdmin && activeTab === 'access' && (
                            <AdminAccessManagement
                                token={token}
                                user={user}
                                isVisible={true}
                            />
                        )}

                        {/* Global Sharing Toggle Tab - Available for Admins only */}
                        {user.isAdmin && activeTab === 'global' && (
                            <div className="space-y-6">
                                <div className="border-b border-slate-200 dark:border-slate-700 pb-4">
                                    <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">
                                        Global Sharing Control
                                    </h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                        System-wide sharing settings
                                    </p>
                                </div>
                                {/* Use existing AdminUserManagement component which has global sharing toggle */}
                                <AdminUserManagement
                                    token={token}
                                    user={user}
                                    isVisible={true}
                                />
                            </div>
                        )}
                        
                    </div>
                </div>
            </div>
        </div>
    );
}