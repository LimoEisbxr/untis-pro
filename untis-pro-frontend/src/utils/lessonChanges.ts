import type { Lesson } from '../types';

/**
 * Helper functions to detect and handle room/teacher changes in lessons
 */

export interface ChangeInfo {
    hasChanges: boolean;
    teacherChanges: Array<{ original: string; current: string }>;
    roomChanges: Array<{ original: string; current: string }>;
}

/**
 * Check if a lesson has any room or teacher changes
 */
export function hasLessonChanges(lesson: Lesson): boolean {
    const hasTeacherChanges = lesson.te?.some(t => t.orgname) || false;
    const hasRoomChanges = lesson.ro?.some(r => r.orgname) || false;
    return hasTeacherChanges || hasRoomChanges;
}

/**
 * Get detailed information about changes in a lesson
 */
export function getLessonChangeInfo(lesson: Lesson): ChangeInfo {
    const teacherChanges: Array<{ original: string; current: string }> = [];
    const roomChanges: Array<{ original: string; current: string }> = [];

    // Check teacher changes
    if (lesson.te) {
        for (const teacher of lesson.te) {
            if (teacher.orgname) {
                teacherChanges.push({
                    original: teacher.orgname,
                    current: teacher.name
                });
            }
        }
    }

    // Check room changes
    if (lesson.ro) {
        for (const room of lesson.ro) {
            if (room.orgname) {
                roomChanges.push({
                    original: room.orgname,
                    current: room.name
                });
            }
        }
    }

    return {
        hasChanges: teacherChanges.length > 0 || roomChanges.length > 0,
        teacherChanges,
        roomChanges
    };
}

/**
 * Get display text for teachers, highlighting changes
 */
export function getTeacherDisplayText(lesson: Lesson): {
    current: string;
    original?: string;
    hasChanges: boolean;
} {
    if (!lesson.te || lesson.te.length === 0) {
        return { current: '', hasChanges: false };
    }

    const currentNames = lesson.te.map(t => t.name).join(', ');
    const originalNames = lesson.te
        .filter(t => t.orgname)
        .map(t => t.orgname!)
        .join(', ');

    return {
        current: currentNames,
        original: originalNames || undefined,
        hasChanges: lesson.te.some(t => t.orgname)
    };
}

/**
 * Get display text for rooms, highlighting changes
 */
export function getRoomDisplayText(lesson: Lesson): {
    current: string;
    original?: string;
    hasChanges: boolean;
} {
    if (!lesson.ro || lesson.ro.length === 0) {
        return { current: '', hasChanges: false };
    }

    const currentNames = lesson.ro.map(r => r.name).join(', ');
    const originalNames = lesson.ro
        .filter(r => r.orgname)
        .map(r => r.orgname!)
        .join(', ');

    return {
        current: currentNames,
        original: originalNames || undefined,
        hasChanges: lesson.ro.some(r => r.orgname)
    };
}