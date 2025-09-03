import { useState, useEffect, useCallback } from 'react';
import type { User } from '../../types';
import {
    userManagerListWhitelist,
    userManagerAddWhitelistRule,
    userManagerDeleteWhitelistRule,
    userManagerListAccessRequests,
    userManagerAcceptAccessRequest,
    userManagerDeclineAccessRequest,
    type WhitelistRule,
    type AccessRequest,
} from '../../api';

interface UserManagerAccessManagementProps {
    token: string;
    user: User;
    isVisible: boolean;
}

export default function UserManagerAccessManagement({ token, user, isVisible }: UserManagerAccessManagementProps) {
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
                userManagerListWhitelist(token),
                userManagerListAccessRequests(token),
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
        if (!isVisible || !user.isUserManager) return;
        loadData();
    }, [isVisible, user.isUserManager, loadData]);

    const handleAddRule = async () => {
        if (!newRule.trim()) return;
        setAddingRule(true);
        setError(null);
        try {
            const response = await userManagerAddWhitelistRule(token, newRule.trim());
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
            await userManagerDeleteWhitelistRule(token, id);
            setWhitelistRules(whitelistRules.filter(rule => rule.id !== id));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to delete rule');
        }
    };

    const handleAcceptRequest = async (id: string) => {
        try {
            await userManagerAcceptAccessRequest(token, id);
            setAccessRequests(accessRequests.filter(req => req.id !== id));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to accept request');
        }
    };

    const handleRejectRequest = async (id: string) => {
        try {
            await userManagerDeclineAccessRequest(token, id);
            setAccessRequests(accessRequests.filter(req => req.id !== id));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to reject request');
        }
    };

    if (!user.isUserManager) {
        return null;
    }

    if (!isVisible) {
        return null; // Don't render when not visible
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="border-b border-slate-200 dark:border-slate-700 pb-4">
                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">
                    Whitelist & Access Request Management
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Manage whitelist rules and handle access requests as a user manager
                </p>
            </div>

            {loading ? (
                <div className="text-center py-4">
                    <div className="text-sm text-slate-500 dark:text-slate-400">Loading...</div>
                </div>
            ) : (
                <>
                    {/* Whitelist Rules Section */}
                    <div className="space-y-4">
                        <h4 className="font-medium text-slate-900 dark:text-slate-100">
                            Whitelist Rules
                        </h4>
                        
                        {/* Add new rule */}
                        <div className="flex space-x-2">
                            <input
                                type="text"
                                value={newRule}
                                onChange={(e) => setNewRule(e.target.value)}
                                placeholder="Add new rule (e.g., @example.com)"
                                className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                onKeyPress={(e) => e.key === 'Enter' && handleAddRule()}
                            />
                            <button
                                onClick={handleAddRule}
                                disabled={addingRule || !newRule.trim()}
                                className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {addingRule ? 'Adding...' : 'Add'}
                            </button>
                        </div>

                        {/* Rules list */}
                        {whitelistRules.length > 0 ? (
                            <div className="space-y-2">
                                {whitelistRules.map((rule) => (
                                    <div
                                        key={rule.id}
                                        className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700 rounded-md"
                                    >
                                        <span className="text-sm text-slate-700 dark:text-slate-300">
                                            {rule.value}
                                        </span>
                                        <button
                                            onClick={() => handleDeleteRule(rule.id)}
                                            className="text-red-600 hover:text-red-700 text-sm"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-sm text-slate-500 dark:text-slate-400">
                                No whitelist rules configured
                            </div>
                        )}
                    </div>

                    {/* Access Requests Section */}
                    <div className="space-y-4">
                        <h4 className="font-medium text-slate-900 dark:text-slate-100">
                            Pending Access Requests
                        </h4>
                        
                        {accessRequests.length > 0 ? (
                            <div className="space-y-3">
                                {accessRequests.map((request) => (
                                    <div
                                        key={request.id}
                                        className="p-4 bg-slate-50 dark:bg-slate-700 rounded-md space-y-3"
                                    >
                                        <div>
                                            <div className="font-medium text-slate-900 dark:text-slate-100">
                                                {request.username}
                                            </div>
                                            <div className="text-sm text-slate-500 dark:text-slate-400">
                                                {new Date(request.createdAt).toLocaleString()}
                                            </div>
                                        </div>
                                        {request.message && (
                                            <div className="text-sm text-slate-700 dark:text-slate-300">
                                                Message: {request.message}
                                            </div>
                                        )}
                                        <div className="flex space-x-2">
                                            <button
                                                onClick={() => handleAcceptRequest(request.id)}
                                                className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                                            >
                                                Accept
                                            </button>
                                            <button
                                                onClick={() => handleRejectRequest(request.id)}
                                                className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                                            >
                                                Reject
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-sm text-slate-500 dark:text-slate-400">
                                No pending access requests
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