type ViteImportMeta = { env?: { VITE_API_BASE?: string } };
const API_BASE: string | undefined = (import.meta as unknown as ViteImportMeta)
    .env?.VITE_API_BASE;

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

export { API_BASE };
