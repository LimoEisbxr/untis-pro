export function addDays(d: Date, days: number) {
    const nd = new Date(d);
    nd.setDate(nd.getDate() + days);
    return nd;
}

export function startOfWeek(d: Date) {
    const nd = new Date(d);
    const dow = nd.getDay();
    const diff = (dow === 0 ? -6 : 1) - dow;
    return addDays(nd, diff);
}

export function pad(n: number) {
    return n < 10 ? `0${n}` : String(n);
}

export function fmtLocal(d: Date) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function yyyymmddToISO(n: number) {
    const s = String(n);
    const y = Number(s.slice(0, 4));
    const mo = Number(s.slice(4, 6));
    const day = Number(s.slice(6, 8));
    return fmtLocal(new Date(y, mo - 1, day));
}

export function fmtHM(totalMin: number) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${pad(h)}:${pad(m)}`;
}

export function hourMarks(startMin: number, endMin: number) {
    const marks: Array<{ min: number; label: string }> = [];
    let m = Math.ceil(startMin / 60) * 60;
    for (; m <= endMin; m += 60) marks.push({ min: m, label: fmtHM(m) });
    return marks;
}

export function clamp(v: number, a: number, b: number) {
    return Math.max(a, Math.min(b, v));
}

export function untisToMinutes(hhmm: number) {
    const h = Math.floor(hhmm / 100);
    const m = hhmm % 100;
    return h * 60 + m;
}
