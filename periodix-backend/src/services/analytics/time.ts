// Shared time helpers (local-day based) to keep consistency across analytics modules

function pad2(n: number): string {
    return n.toString().padStart(2, '0');
}

export function getLocalDayRange(daysOffset = 0): {
    start: Date;
    end: Date;
    dateKey: string; // YYYY-MM-DD
} {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    const start = new Date(d);
    start.setHours(0, 0, 0, 0);
    const end = new Date(d);
    end.setHours(23, 59, 59, 999);
    const dateKey = `${start.getFullYear()}-${pad2(
        start.getMonth() + 1
    )}-${pad2(start.getDate())}`;
    return { start, end, dateKey };
}

export { pad2 }; // exported for rare formatting needs
