type ViteImportMeta = { env?: { VITE_API_BASE?: string } };
const API_BASE: string | undefined = (import.meta as unknown as ViteImportMeta)
    .env?.VITE_API_BASE;

import type { LessonColors, LessonOffsets, User, Notification, NotificationSettings, AdminNotificationSettings } from './types';

export async function api<T>(
    path: string,
    opts: RequestInit & { token?: string } = {}
): Promise<T> {
    // Prefer configured API base; otherwise, build relative to current host
    // This ensures requests go to the same IP/host the site was loaded from
    const base = (API_BASE ?? '').trim();
    if (!base) {
        // Use relative path so the browser hits the same host/IP the site was loaded from
        return fetch(path, {
            ...opts,
            headers: {
                'Content-Type': 'application/json',
                ...(opts.token
                    ? { Authorization: `Bearer ${opts.token}` }
                    : {}),
                ...(opts.headers || {}),
            },
        }).then(async (res) => {
            const text = await res.text();
            if (!res.ok) {
                // Bubble up structured info for 429 to support auto-retry
                if (res.status === 429) {
                    const retryAfterHeader = res.headers.get('Retry-After');
                    let retryAfter: number | undefined = undefined;
                    const n = Number(retryAfterHeader);
                    if (Number.isFinite(n) && n >= 0) retryAfter = n;
                    try {
                        const body = JSON.parse(text);
                        const payload = {
                            error: body?.error || text || 'Too Many Requests',
                            status: 429,
                            retryAfter: body?.retryAfter ?? retryAfter,
                        };
                        throw new Error(JSON.stringify(payload));
                    } catch {
                        const payload = {
                            error: text || 'Too Many Requests',
                            status: 429,
                            retryAfter,
                        };
                        throw new Error(JSON.stringify(payload));
                    }
                }
                throw new Error(text);
            }
            return text ? JSON.parse(text) : (undefined as unknown as T);
        });
    }
    const baseNormalized = base.replace(/\/$/, '');
    const url = `${baseNormalized}${path}`;
    const res = await fetch(url, {
        ...opts,
        headers: {
            'Content-Type': 'application/json',
            ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
            ...(opts.headers || {}),
        },
    });
    const text = await res.text();
    if (!res.ok) {
        if (res.status === 429) {
            const retryAfterHeader = res.headers.get('Retry-After');
            let retryAfter: number | undefined = undefined;
            const n = Number(retryAfterHeader);
            if (Number.isFinite(n) && n >= 0) retryAfter = n;
            try {
                const body = JSON.parse(text);
                const payload = {
                    error: body?.error || text || 'Too Many Requests',
                    status: 429,
                    retryAfter: body?.retryAfter ?? retryAfter,
                };
                throw new Error(JSON.stringify(payload));
            } catch {
                const payload = {
                    error: text || 'Too Many Requests',
                    status: 429,
                    retryAfter,
                };
                throw new Error(JSON.stringify(payload));
            }
        }
        throw new Error(text);
    }
    return text ? JSON.parse(text) : (undefined as unknown as T);
}

// Lesson color API functions
export async function getLessonColors(
    token: string
): Promise<{ colors: LessonColors; offsets: LessonOffsets }> {
    return api<{ colors: LessonColors; offsets: LessonOffsets }>(
        '/api/lesson-colors/my-colors',
        { token }
    );
}

export async function setLessonColor(
    token: string,
    lessonName: string,
    color: string,
    viewingUserId?: string,
    offset?: number
): Promise<{ success: boolean; type?: string }> {
    const body: {
        lessonName: string;
        color: string;
        viewingUserId?: string;
        offset?: number;
    } = { lessonName, color };
    if (viewingUserId) {
        body.viewingUserId = viewingUserId;
    }
    if (offset !== undefined) body.offset = offset;
    return api<{ success: boolean; type?: string }>(
        '/api/lesson-colors/set-color',
        {
            method: 'POST',
            token,
            body: JSON.stringify(body),
        }
    );
}

export async function removeLessonColor(
    token: string,
    lessonName: string,
    viewingUserId?: string
): Promise<{ success: boolean; type?: string }> {
    const body: { lessonName: string; viewingUserId?: string } = { lessonName };
    if (viewingUserId) {
        body.viewingUserId = viewingUserId;
    }
    return api<{ success: boolean; type?: string }>(
        '/api/lesson-colors/remove-color',
        {
            method: 'DELETE',
            token,
            body: JSON.stringify(body),
        }
    );
}

export async function getDefaultLessonColors(
    token: string
): Promise<LessonColors> {
    return api<LessonColors>('/api/lesson-colors/defaults', { token });
}

export async function setDefaultLessonColor(
    token: string,
    lessonName: string,
    color: string
): Promise<{ success: boolean }> {
    return api<{ success: boolean }>('/api/lesson-colors/set-default', {
        method: 'POST',
        token,
        body: JSON.stringify({ lessonName, color }),
    });
}

// Sharing API functions
export type SharingSettings = {
    sharingEnabled: boolean;
    sharingWith: Array<{ id: string; username: string; displayName?: string }>;
    globalSharingEnabled: boolean;
    isAdmin: boolean;
    whitelistEnabled?: boolean;
};

export async function getSharingSettings(token: string): Promise<SharingSettings> {
    return api<SharingSettings>('/api/sharing/settings', { token });
}

export async function updateSharingEnabled(
    token: string,
    enabled: boolean
): Promise<{ success: boolean }> {
    return api<{ success: boolean }>('/api/sharing/settings', {
        method: 'PUT',
        token,
        body: JSON.stringify({ enabled }),
    });
}

export async function shareWithUser(
    token: string,
    userId: string
): Promise<{ success: boolean; user?: User }> {
    return api<{ success: boolean; user?: User }>('/api/sharing/share', {
        method: 'POST',
        token,
        body: JSON.stringify({ userId }),
    });
}

export async function stopSharingWithUser(
    token: string,
    userId: string
): Promise<{ success: boolean }> {
    return api<{ success: boolean }>(`/api/sharing/share/${userId}`, {
        method: 'DELETE',
        token,
    });
}

export async function updateGlobalSharing(
    token: string,
    enabled: boolean
): Promise<{ success: boolean }> {
    return api<{ success: boolean }>('/api/sharing/global', {
        method: 'PUT',
        token,
        body: JSON.stringify({ enabled }),
    });
}

export async function searchUsersToShare(
    token: string,
    query: string
): Promise<{ users: Array<{ id: string; username: string; displayName?: string }> }> {
    return api<{ users: Array<{ id: string; username: string; displayName?: string }> }>(
        `/api/users/search-to-share?q=${encodeURIComponent(query)}`,
        { token }
    );
}

// Admin user management
export async function updateUserDisplayName(
    token: string,
    userId: string,
    displayName: string | null
): Promise<{ user: { id: string; username: string; displayName: string | null } }> {
    return api<{ user: { id: string; username: string; displayName: string | null } }>(
        `/api/admin/users/${userId}`,
        {
            method: 'PATCH',
            token,
            body: JSON.stringify({ displayName }),
        }
    );
}

// New: current user can update their own display name
export async function updateMyDisplayName(
    token: string,
    displayName: string | null
): Promise<{ user: { id: string; username: string; displayName: string | null } }> {
    return api<{ user: { id: string; username: string; displayName: string | null } }>(
        `/api/users/me`,
        {
            method: 'PATCH',
            token,
            body: JSON.stringify({ displayName }),
        }
    );
}

// New: Whitelist management (username-only)
export type WhitelistRule = { id: string; value: string; createdAt: string };
export async function listWhitelist(token: string): Promise<{ rules: WhitelistRule[] }> {
    return api<{ rules: WhitelistRule[] }>(`/api/admin/whitelist`, { token });
}
export async function addWhitelistRule(
    token: string,
    value: string
): Promise<{ rule: WhitelistRule; created: boolean }> {
    return api<{ rule: WhitelistRule; created: boolean }>(`/api/admin/whitelist`, {
        method: 'POST',
        token,
        body: JSON.stringify({ value }),
    });
}
export async function deleteWhitelistRule(
    token: string,
    id: string
): Promise<{ ok: boolean }> {
    return api<{ ok: boolean }>(`/api/admin/whitelist/${id}`, {
        method: 'DELETE',
        token,
    });
}

// Access request API functions
export type AccessRequest = { id: string; username: string; message?: string; createdAt: string };

export async function createAccessRequest(
    username: string,
    message?: string
): Promise<{ request: AccessRequest; success: boolean }> {
    return api<{ request: AccessRequest; success: boolean }>('/api/access-request', {
        method: 'POST',
        body: JSON.stringify({ username, message }),
    });
}

export async function listAccessRequests(token: string): Promise<{ requests: AccessRequest[] }> {
    return api<{ requests: AccessRequest[] }>('/api/admin/access-requests', { token });
}

export async function acceptAccessRequest(
    token: string,
    id: string
): Promise<{ success: boolean; message?: string }> {
    return api<{ success: boolean; message?: string }>(`/api/admin/access-requests/${id}/accept`, {
        method: 'POST',
        token,
    });
}

export async function declineAccessRequest(
    token: string,
    id: string
): Promise<{ success: boolean }> {
    return api<{ success: boolean }>(`/api/admin/access-requests/${id}`, {
        method: 'DELETE',
        token,
    });
}

// User-manager management (admin only)
export async function grantUserManagerStatus(
    token: string,
    userId: string
): Promise<{ user: { id: string; username: string; displayName: string | null; isUserManager: boolean } }> {
    return api<{ user: { id: string; username: string; displayName: string | null; isUserManager: boolean } }>(
        `/api/admin/users/${userId}/grant-user-manager`,
        {
            method: 'PATCH',
            token,
        }
    );
}

export async function revokeUserManagerStatus(
    token: string,
    userId: string
): Promise<{ user: { id: string; username: string; displayName: string | null; isUserManager: boolean } }> {
    return api<{ user: { id: string; username: string; displayName: string | null; isUserManager: boolean } }>(
        `/api/admin/users/${userId}/revoke-user-manager`,
        {
            method: 'PATCH',
            token,
        }
    );
}

// User-manager API functions (accessible by admin or user-manager)
export async function userManagerUpdateUserDisplayName(
    token: string,
    userId: string,
    displayName: string | null
): Promise<{ user: { id: string; username: string; displayName: string | null } }> {
    return api<{ user: { id: string; username: string; displayName: string | null } }>(
        `/api/user-manager/users/${userId}`,
        {
            method: 'PATCH',
            token,
            body: JSON.stringify({ displayName }),
        }
    );
}

export async function userManagerListWhitelist(token: string): Promise<{ rules: WhitelistRule[] }> {
    return api<{ rules: WhitelistRule[] }>('/api/user-manager/whitelist', { token });
}

export async function userManagerAddWhitelistRule(
    token: string,
    value: string
): Promise<{ rule: WhitelistRule; created: boolean }> {
    return api<{ rule: WhitelistRule; created: boolean }>('/api/user-manager/whitelist', {
        method: 'POST',
        token,
        body: JSON.stringify({ value }),
    });
}

export async function userManagerDeleteWhitelistRule(
    token: string,
    id: string
): Promise<{ ok: boolean }> {
    return api<{ ok: boolean }>(`/api/user-manager/whitelist/${id}`, {
        method: 'DELETE',
        token,
    });
}

export async function userManagerListAccessRequests(token: string): Promise<{ requests: AccessRequest[] }> {
    return api<{ requests: AccessRequest[] }>('/api/user-manager/access-requests', { token });
}

export async function userManagerAcceptAccessRequest(
    token: string,
    id: string
): Promise<{ success: boolean; message?: string }> {
    return api<{ success: boolean; message?: string }>(`/api/user-manager/access-requests/${id}/accept`, {
        method: 'POST',
        token,
    });
}

export async function userManagerDeclineAccessRequest(
    token: string,
    id: string
): Promise<{ success: boolean }> {
    return api<{ success: boolean }>(`/api/user-manager/access-requests/${id}`, {
        method: 'DELETE',
        token,
    });
}

// Notification API functions
export async function getNotifications(token: string): Promise<{ notifications: Notification[] }> {
    return api<{ notifications: Notification[] }>('/api/notifications', { token });
}

export async function markNotificationAsRead(
    token: string,
    notificationId: string
): Promise<{ success: boolean }> {
    return api<{ success: boolean }>(`/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
        token,
    });
}

export async function markAllNotificationsAsRead(token: string): Promise<{ success: boolean }> {
    return api<{ success: boolean }>('/api/notifications/read-all', {
        method: 'PATCH',
        token,
    });
}

export async function deleteNotification(
    token: string,
    notificationId: string
): Promise<{ success: boolean }> {
    return api<{ success: boolean }>(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
        token,
    });
}

export async function getNotificationSettings(token: string): Promise<{ settings: NotificationSettings }> {
    return api<{ settings: NotificationSettings }>('/api/notifications/settings', { token });
}

export async function updateNotificationSettings(
    token: string,
    settings: Partial<Pick<NotificationSettings, 
        'browserNotificationsEnabled' | 
        'pushNotificationsEnabled' | 
        'timetableChangesEnabled' | 
        'accessRequestsEnabled' | 
        'irregularLessonsEnabled' | 
        'cancelledLessonsEnabled' | 
        'devicePreferences'
    >>
): Promise<{ settings: NotificationSettings; success: boolean }> {
    return api<{ settings: NotificationSettings; success: boolean }>('/api/notifications/settings', {
        method: 'PUT',
        token,
        body: JSON.stringify(settings),
    });
}

export async function subscribeToPushNotifications(
    token: string,
    subscription: {
        endpoint: string;
        p256dh: string;
        auth: string;
        userAgent?: string;
        deviceType?: 'mobile' | 'desktop' | 'tablet';
    }
): Promise<{ subscription: Record<string, unknown>; success: boolean }> {
    return api<{ subscription: Record<string, unknown>; success: boolean }>('/api/notifications/subscribe', {
        method: 'POST',
        token,
        body: JSON.stringify(subscription),
    });
}

export async function unsubscribeFromPushNotifications(
    token: string,
    endpoint: string
): Promise<{ success: boolean }> {
    return api<{ success: boolean }>(`/api/notifications/subscribe/${encodeURIComponent(endpoint)}`, {
        method: 'DELETE',
        token,
    });
}

// Get VAPID public key for push notifications
export async function getVapidPublicKey(): Promise<{ publicKey: string }> {
    return api<{ publicKey: string }>('/api/notifications/vapid-public-key');
}

// Admin notification settings
export async function getAdminNotificationSettings(token: string): Promise<{ settings: AdminNotificationSettings }> {
    return api<{ settings: AdminNotificationSettings }>('/api/admin/notification-settings', { token });
}

export async function updateAdminNotificationSettings(
    token: string,
    settings: Partial<Pick<AdminNotificationSettings, 
        'timetableFetchInterval' | 
        'enableTimetableNotifications' | 
        'enableAccessRequestNotifications'
    >>
): Promise<{ settings: AdminNotificationSettings; success: boolean }> {
    return api<{ settings: AdminNotificationSettings; success: boolean }>('/api/admin/notification-settings', {
        method: 'PUT',
        token,
        body: JSON.stringify(settings),
    });
}

// Sdui API functions
export async function getSduiNews(token: string, page: number = 1): Promise<import('./types').SduiNewsResponse> {
    return api<import('./types').SduiNewsResponse>(`/api/sdui/news?page=${page}`, { token });
}

export async function getSduiNewsById(token: string, newsId: number): Promise<{ data: import('./types').SduiNews; status: string; meta: Record<string, unknown> }> {
    return api<{ data: import('./types').SduiNews; status: string; meta: Record<string, unknown> }>(`/api/sdui/news/${newsId}`, { token });
}

export { API_BASE };
