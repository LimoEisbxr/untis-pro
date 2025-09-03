import type { User } from '../../types';

interface Tab {
    id: string;
    label: string;
}

interface TabNavigationProps {
    user: User;
    activeTab: string;
    onTabChange: (tabId: string) => void;
}

export default function TabNavigation({ user, activeTab, onTabChange }: TabNavigationProps) {
    // Get available tabs for current user type
    const getAvailableTabs = (): Tab[] => {
        if (user.isAdmin) {
            return [
                { id: 'access', label: 'Whitelist & Access Request' },
                { id: 'global', label: 'Global Sharing Toggle' },
            ];
        }
        if (user.isUserManager) {
            return [
                { id: 'nickname', label: 'Nickname Change' },
                { id: 'sharing', label: 'Personal Sharing Settings' },
                { id: 'notifications', label: 'Notification Settings' },
                { id: 'access', label: 'Whitelist & Access Request' },
            ];
        }
        // Regular users
        return [
            { id: 'nickname', label: 'Nickname Change' },
            { id: 'sharing', label: 'Personal Sharing Settings' },
            { id: 'notifications', label: 'Notification Settings' },
        ];
    };

    const availableTabs = getAvailableTabs();

    return (
        <div className="border-b border-slate-200 dark:border-slate-700 mb-6">
            <nav className="flex space-x-8">
                {availableTabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={`py-2 px-1 border-b-2 font-medium text-sm ${
                            activeTab === tab.id
                                ? 'border-indigo-500 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-300 dark:hover:border-slate-600'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </nav>
        </div>
    );
}