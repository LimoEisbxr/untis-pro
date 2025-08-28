type ViteImportMeta = { env?: { VITE_API_BASE?: string } };
const API_BASE: string | undefined = (import.meta as unknown as ViteImportMeta)
    .env?.VITE_API_BASE;

import type { LessonColors, HomeworkResponse, Homework } from './types';

export async function api<T>(
    path: string,
    opts: RequestInit & { token?: string } = {}
): Promise<T> {
    // Prefer configured API base; otherwise, build relative to current host
    // This ensures requests go to the same IP/host the site is loaded from
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
export async function getLessonColors(token: string): Promise<LessonColors> {
    return api<LessonColors>('/api/lesson-colors/my-colors', { token });
}

export async function setLessonColor(
    token: string,
    lessonName: string,
    color: string,
    viewingUserId?: string
): Promise<{ success: boolean; type?: string }> {
    const body: { lessonName: string; color: string; viewingUserId?: string } =
        { lessonName, color };
    if (viewingUserId) {
        body.viewingUserId = viewingUserId;
    }
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

// Homework API functions
export async function getHomework(
    token: string,
    start?: string,
    end?: string
): Promise<HomeworkResponse> {
    const params = new URLSearchParams();
    if (start) params.append('start', start);
    if (end) params.append('end', end);
    const query = params.toString();
    return api<HomeworkResponse>(`/api/homework/me${query ? `?${query}` : ''}`, { token });
}

export async function getUserHomework(
    token: string,
    userId: string,
    start?: string,
    end?: string
): Promise<HomeworkResponse> {
    const params = new URLSearchParams();
    if (start) params.append('start', start);
    if (end) params.append('end', end);
    const query = params.toString();
    return api<HomeworkResponse>(`/api/homework/user/${userId}${query ? `?${query}` : ''}`, { token });
}

export async function updateHomeworkCompletion(
    token: string,
    homeworkId: string,
    completed: boolean
): Promise<Homework> {
    return api<Homework>(`/api/homework/${homeworkId}/completion`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ completed }),
    });
}

export { API_BASE };
