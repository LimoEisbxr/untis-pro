type ViteImportMeta = { env?: { VITE_API_BASE?: string } };
const API_BASE: string | undefined = (import.meta as unknown as ViteImportMeta)
    .env?.VITE_API_BASE;

export async function api<T>(
    path: string,
    opts: RequestInit & { token?: string } = {}
): Promise<T> {
    const url = API_BASE
        ? `${String(API_BASE).replace(/\/$/, '')}${path}`
        : path;
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
