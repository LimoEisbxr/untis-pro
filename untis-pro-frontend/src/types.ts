export type User = {
    id: string;
    username: string;
    displayName?: string | null;
    isAdmin?: boolean;
    school?: string;
};

export type TimetableResponse = {
    userId: string;
    rangeStart: string | null;
    rangeEnd: string | null;
    payload: unknown;
};

export type Lesson = {
    id: number;
    date: number; // yyyymmdd
    startTime: number; // Untis HHmm integer, e.g., 740 => 07:40
    endTime: number; // Untis HHmm integer, e.g., 825 => 08:25
    su?: Array<{ id: number; name: string; longname?: string }>;
    te?: Array<{ id: number; name: string; longname?: string }>;
    ro?: Array<{ id: number; name: string; longname?: string }>;
    code?: string; // e.g. 'cancelled'
    activityType?: string;
};
