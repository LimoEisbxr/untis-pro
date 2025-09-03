import { useState, useEffect, useCallback } from 'react';
import type { User } from '../../types';
import {
    listWhitelist,
    addWhitelistRule,
    deleteWhitelistRule,
    listAccessRequests,
    acceptAccessRequest,
    declineAccessRequest,
    type WhitelistRule,
    type AccessRequest,
} from '../../api';

interface AdminAccessManagementProps {
    token: string;
    user: User;
    isVisible: boolean;
}

export default function AdminAccessManagement({ token, user, isVisible }: AdminAccessManagementProps) {
    const [whitelistRules, setWhitelistRules] = useState<WhitelistRule[]>([]);
    const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [newRule, setNewRule] = useState('');
    const [addingRule, setAddingRule] = useState(false);

    // Load data when component becomes visible
    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [whitelistResponse, requestsResponse] = await Promise.all([
                listWhitelist(token),
                listAccessRequests(token),
            ]);
            setWhitelistRules(whitelistResponse.rules);
            setAccessRequests(requestsResponse.requests);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load data');
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        if (!isVisible || !user.isAdmin) return;
        loadData();
    }, [isVisible, user.isAdmin, loadData]);

    const handleAddRule = async () => {
        if (!newRule.trim()) return;
        setAddingRule(true);
        setError(null);
        try {
            const response = await addWhitelistRule(token, newRule.trim());
            if (response.created) {
                setWhitelistRules([...whitelistRules, response.rule]);
                setNewRule('');
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to add rule');
        } finally {
            setAddingRule(false);
        }
    };

    const handleDeleteRule = async (id: string) => {
        try {
            await deleteWhitelistRule(token, id);
            setWhitelistRules(whitelistRules.filter(rule => rule.id !== id));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to delete rule');
        }
    };

    const handleAcceptRequest = async (id: string) => {
        try {
            await acceptAccessRequest(token, id);
            setAccessRequests(accessRequests.filter(req => req.id !== id));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to accept request');
        }
    };

    const handleRejectRequest = async (id: string) => {
        try {
            await declineAccessRequest(token, id);
            setAccessRequests(accessRequests.filter(req => req.id !== id));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to reject request');
        }
    };

    if (!user.isAdmin) {
        return null;
    }

    // Remove conditional rendering since we handle visibility in parent

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="border-b border-slate-200 dark:border-slate-700 pb-4">
                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">
                    Whitelist & Access Request Management (Admin)
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Full administrative access to whitelist rules and access requests
                </p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-8">
                    <div className="flex items-center space-x-3">
                        <div className="w-6 h-6 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin"></div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">Loading access management...</div>
                    </div>
                </div>
            ) : (
                <>
                    {/* Access Requests Section - Moved to top */}
                    <div className="space-y-4">
                        <div className="flex items-center space-x-2">
                            <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-5 5-5-5h5v-6h5l-5-5-5 5h5v6z" />
                            </svg>
                            <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                                Pending Access Requests
                            </h4>
                            {accessRequests.length > 0 && (
                                <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-medium rounded-full">
                                    {accessRequests.length}
                                </span>
                            )}
                        </div>
                        
                        {accessRequests.length > 0 ? (
                            <div className="grid gap-4">
                                {accessRequests.map((request) => (
                                    <div
                                        key={request.id}
                                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center space-x-2">
                                                    <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-medium text-sm">
                                                        {request.username.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-slate-900 dark:text-slate-100">
                                                            {request.username}
                                                        </div>
                                                        <div className="text-xs text-slate-500 dark:text-slate-400">
                                                            {new Date(request.createdAt).toLocaleDateString()} at {new Date(request.createdAt).toLocaleTimeString()}
                                                        </div>
                                                    </div>
                                                </div>
                                                {request.message && (
                                                    <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-700 rounded-md">
                                                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Message:</div>
                                                        <div className="text-sm text-slate-700 dark:text-slate-300 italic">
                                                            "{request.message}"
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex space-x-2 ml-4">
                                                <button
                                                    onClick={() => handleAcceptRequest(request.id)}
                                                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center space-x-1"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    <span>Accept</span>
                                                </button>
                                                <button
                                                    onClick={() => handleRejectRequest(request.id)}
                                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center space-x-1"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                    <span>Reject</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 bg-slate-50 dark:bg-slate-800 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600">
                                <svg className="w-12 h-12 text-slate-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <div className="text-sm text-slate-500 dark:text-slate-400">
                                    No pending access requests
                                </div>
                                <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                                    Requests will appear here when users ask for access
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Whitelist Rules Section */}
                    <div className="space-y-4">
                        <div className="flex items-center space-x-2">
                            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                                Whitelist Rules
                            </h4>
                        </div>
                        
                        {/* Add new rule */}
                        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                            <div className="flex space-x-3">
                                <input
                                    type="text"
                                    value={newRule}
                                    onChange={(e) => setNewRule(e.target.value)}
                                    placeholder="Add new rule (e.g., @example.com)"
                                    className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    onKeyPress={(e) => e.key === 'Enter' && handleAddRule()}
                                />
                                <button
                                    onClick={handleAddRule}
                                    disabled={addingRule || !newRule.trim()}
                                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white text-sm font-medium rounded-lg transition-colors disabled:cursor-not-allowed flex items-center space-x-2"
                                >
                                    {addingRule ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            <span>Adding...</span>
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                            </svg>
                                            <span>Add Rule</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Rules list */}
                        {whitelistRules.length > 0 ? (
                            <div className="grid gap-3">
                                {whitelistRules.map((rule) => (
                                    <div
                                        key={rule.id}
                                        className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:shadow-sm transition-shadow"
                                    >
                                        <div className="flex items-center space-x-3">
                                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                            <span className="text-sm font-mono text-slate-700 dark:text-slate-300">
                                                {rule.value}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => {
                                                if (window.confirm(`Are you sure you want to delete the whitelist rule "${rule.value}"?`)) {
                                                    handleDeleteRule(rule.id);
                                                }
                                            }}
                                            className="px-3 py-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium rounded-md transition-colors flex items-center space-x-1"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                            <span>Delete</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-6 bg-slate-50 dark:bg-slate-800 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600">
                                <svg className="w-10 h-10 text-slate-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div className="text-sm text-slate-500 dark:text-slate-400">
                                    No whitelist rules configured
                                </div>
                                <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                                    Add rules to automatically approve users matching certain patterns
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            {error && (
                <div className="text-sm text-red-600 dark:text-red-400">
                    Error: {error}
                </div>
            )}
        </div>
    );
}