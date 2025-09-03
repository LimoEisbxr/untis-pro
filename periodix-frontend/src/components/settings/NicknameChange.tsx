import { useState, useCallback } from 'react';
import type { User } from '../../types';
import { updateMyDisplayName } from '../../api';

interface NicknameChangeProps {
    token: string;
    user: User;
    onUserUpdate?: (user: User) => void;
}

export default function NicknameChange({ token, user, onUserUpdate }: NicknameChangeProps) {
    const [myDisplayName, setMyDisplayName] = useState<string>(user.displayName ?? '');
    const [savingMyName, setSavingMyName] = useState(false);
    const [myNameError, setMyNameError] = useState<string | null>(null);
    const [myNameSaved, setMyNameSaved] = useState(false);

    const handleSaveMyDisplayName = useCallback(async () => {
        setSavingMyName(true);
        setMyNameError(null);
        setMyNameSaved(false);
        try {
            const trimmedName = myDisplayName.trim();
            const displayNameToSave = trimmedName === '' ? null : trimmedName;
            await updateMyDisplayName(token, displayNameToSave);

            // Update the user in the parent component
            if (onUserUpdate) {
                onUserUpdate({
                    ...user,
                    displayName: displayNameToSave,
                });
            }
            setMyNameSaved(true);
            setTimeout(() => setMyNameSaved(false), 3000);
        } catch (e) {
            setMyNameError(
                e instanceof Error ? e.message : 'Failed to update display name'
            );
        } finally {
            setSavingMyName(false);
        }
    }, [token, myDisplayName, user, onUserUpdate]);

    // Remove conditional rendering since we handle visibility in parent

    return (
        <div>
            <h3 className="text-lg font-medium mb-4 text-slate-900 dark:text-slate-100">
                Display Name Settings
            </h3>
            <div className="mb-4">
                <label
                    htmlFor="displayName"
                    className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
                >
                    Display Name
                </label>
                <div className="flex gap-2">
                    <input
                        id="displayName"
                        className="input flex-1"
                        placeholder="Your display name"
                        value={myDisplayName}
                        onChange={(e) => {
                            setMyDisplayName(e.target.value);
                            setMyNameSaved(false);
                        }}
                        disabled={savingMyName}
                    />
                    <button
                        className="btn-primary"
                        onClick={handleSaveMyDisplayName}
                        disabled={
                            savingMyName ||
                            myDisplayName === (user.displayName ?? '')
                        }
                    >
                        {savingMyName ? 'Saving...' : 'Save'}
                    </button>
                </div>
                {myNameError && (
                    <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                        {myNameError}
                    </div>
                )}
                {myNameSaved && !myNameError && (
                    <div className="mt-2 text-sm text-green-600 dark:text-green-400">
                        Display name updated!
                    </div>
                )}
            </div>
        </div>
    );
}