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
    info?: string; // Additional lesson information
    homework?: Homework[]; // Associated homework
    exams?: Exam[]; // Associated exams
};

export type Homework = {
    id: number;
    lessonId: number;
    date: number; // yyyymmdd - due date
    subject: { id: number; name: string; longname?: string };
    text: string;
    remark?: string;
    completed: boolean;
};

export type Exam = {
    id: number;
    date: number; // yyyymmdd - exam date
    startTime: number; // Untis HHmm integer
    endTime: number; // Untis HHmm integer
    subject: { id: number; name: string; longname?: string };
    teachers?: Array<{ id: number; name: string; longname?: string }>;
    rooms?: Array<{ id: number; name: string; longname?: string }>;
    name: string;
    text?: string;
};

export type LessonColors = Record<string, string>; // lessonName -> hex color

export type ColorGradient = {
    from: string;
    via: string;
    to: string;
};

export type LessonOffsets = Record<string, number>; // lessonName -> gradient offset (0..1)
