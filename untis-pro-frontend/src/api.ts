type ViteImportMeta = { env?: { VITE_API_BASE?: string } };
const API_BASE: string | undefined = (import.meta as unknown as ViteImportMeta)
    .env?.VITE_API_BASE;

import type { LessonColors } from './types';

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
            if (!res.ok) throw new Error(await res.text());
            return res.json();
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
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

// Lesson color API functions
export async function getLessonColors(token: string): Promise<LessonColors> {
    return api<LessonColors>('/api/lesson-colors/my-colors', { token });
}

export async function setLessonColor(
    token: string,
    lessonName: string,
    color: string
): Promise<{ success: boolean }> {
    return api<{ success: boolean }>('/api/lesson-colors/set-color', {
        method: 'POST',
        token,
        body: JSON.stringify({ lessonName, color }),
    });
}

export async function removeLessonColor(
    token: string,
    lessonName: string
): Promise<{ success: boolean }> {
    return api<{ success: boolean }>('/api/lesson-colors/remove-color', {
        method: 'DELETE',
        token,
        body: JSON.stringify({ lessonName }),
    });
}

export async function getDefaultLessonColors(token: string): Promise<LessonColors> {
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

export { API_BASE };
