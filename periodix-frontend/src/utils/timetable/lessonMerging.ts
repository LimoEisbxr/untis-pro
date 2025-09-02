import type { Lesson, Homework, Exam } from '../../types';
import { untisToMinutes } from '../dates';

/**
 * Check if two lessons can be merged based on matching criteria
 * and break time between them (5 minutes or less)
 */
export function canMergeLessons(lesson1: Lesson, lesson2: Lesson): boolean {
    // Check if subjects match
    const subject1 = lesson1.su?.[0]?.name ?? lesson1.activityType ?? '';
    const subject2 = lesson2.su?.[0]?.name ?? lesson2.activityType ?? '';
    if (subject1 !== subject2) return false;

    // Check if teachers match
    const teacher1 = lesson1.te
        ?.map((t) => t.name)
        .sort()
        .join(',');
    const teacher2 = lesson2.te
        ?.map((t) => t.name)
        .sort()
        .join(',');
    if (teacher1 !== teacher2) return false;

    // Check if rooms match
    const room1 = lesson1.ro
        ?.map((r) => r.name)
        .sort()
        .join(',');
    const room2 = lesson2.ro
        ?.map((r) => r.name)
        .sort()
        .join(',');
    if (room1 !== room2) return false;

    // Check if lesson codes match (both cancelled, both irregular, etc.)
    if (lesson1.code !== lesson2.code) return false;

    // Calculate break time in minutes
    const lesson1EndMin = untisToMinutes(lesson1.endTime);
    const lesson2StartMin = untisToMinutes(lesson2.startTime);
    const breakMinutes = lesson2StartMin - lesson1EndMin;

    // Merge if break is 5 minutes or less (including negative for overlapping)
    return breakMinutes <= 5;
}

/**
 * Check if two homework items are identical based on content
 */
export function areHomeworkIdentical(hw1: Homework, hw2: Homework): boolean {
    return (
        hw1.text === hw2.text &&
        hw1.subject?.name === hw2.subject?.name &&
        hw1.date === hw2.date &&
        hw1.remark === hw2.remark
    );
}

/**
 * Check if two exam items are identical based on content
 */
export function areExamsIdentical(exam1: Exam, exam2: Exam): boolean {
    return (
        exam1.name === exam2.name &&
        exam1.subject?.name === exam2.subject?.name &&
        exam1.date === exam2.date &&
        exam1.startTime === exam2.startTime &&
        exam1.endTime === exam2.endTime &&
        exam1.text === exam2.text
    );
}

/**
 * Deduplicate homework arrays, preserving completed status
 */
export function deduplicateHomework(
    homework1: Homework[] = [],
    homework2: Homework[] = []
): Homework[] {
    const allHomework = [...homework1, ...homework2];
    const deduplicated: Homework[] = [];

    for (const hw of allHomework) {
        const existingIndex = deduplicated.findIndex((existing) =>
            areHomeworkIdentical(existing, hw)
        );

        if (existingIndex === -1) {
            // New homework, add it
            deduplicated.push(hw);
        } else {
            // Duplicate found, merge completion status (completed if either is completed)
            deduplicated[existingIndex] = {
                ...deduplicated[existingIndex],
                completed:
                    deduplicated[existingIndex].completed || hw.completed,
            };
        }
    }

    return deduplicated;
}

/**
 * Deduplicate exam arrays
 */
export function deduplicateExams(exams1: Exam[] = [], exams2: Exam[] = []): Exam[] {
    const allExams = [...exams1, ...exams2];
    const deduplicated: Exam[] = [];

    for (const exam of allExams) {
        const existingIndex = deduplicated.findIndex((existing) =>
            areExamsIdentical(existing, exam)
        );

        if (existingIndex === -1) {
            // New exam, add it
            deduplicated.push(exam);
        }
        // For exams, we don't merge anything - just avoid duplicates
    }

    return deduplicated;
}

/**
 * Merge two lessons into one, combining their time ranges and preserving all data
 */
export function mergeTwoLessons(lesson1: Lesson, lesson2: Lesson): Lesson {
    // Helper to combine textual note fields without duplicating identical segments
    const combineNotes = (a?: string, b?: string): string | undefined => {
        const parts: string[] = [];
        const add = (val?: string) => {
            if (!val) return;
            // Split in case prior merge already joined with ' | '
            val.split('|')
                .map((s) => s.trim())
                .filter(Boolean)
                .forEach((seg) => {
                    const normalized = seg.toLowerCase();
                    // Avoid duplicates (case-insensitive)
                    if (!parts.some((p) => p.toLowerCase() === normalized)) {
                        parts.push(seg);
                    }
                });
        };
        add(a);
        add(b);
        if (!parts.length) return undefined;
        return parts.join(' | ');
    };
    
    return {
        ...lesson1, // Use first lesson as base
        startTime: Math.min(lesson1.startTime, lesson2.startTime),
        endTime: Math.max(lesson1.endTime, lesson2.endTime),
        // Merge and deduplicate homework arrays
        homework: deduplicateHomework(lesson1.homework, lesson2.homework),
        // Merge and deduplicate exam arrays
        exams: deduplicateExams(lesson1.exams, lesson2.exams),
        // Combine info and lstext with separator, removing duplicates
        info: combineNotes(lesson1.info, lesson2.info),
        lstext: combineNotes(lesson1.lstext, lesson2.lstext),
        // Use lower ID to maintain consistency
        id: Math.min(lesson1.id, lesson2.id),
    };
}

/**
 * Process and merge consecutive lessons that meet the merging criteria
 */
export function mergeLessons(lessons: Lesson[]): Lesson[] {
    if (lessons.length <= 1) return lessons;

    // Sort lessons by date and start time
    const sortedLessons = [...lessons].sort((a, b) => {
        if (a.date !== b.date) return a.date - b.date;
        return a.startTime - b.startTime;
    });

    const merged: Lesson[] = [];
    let currentLesson = sortedLessons[0];

    for (let i = 1; i < sortedLessons.length; i++) {
        const nextLesson = sortedLessons[i];

        // Only try to merge lessons on the same day
        if (currentLesson.date === nextLesson.date && canMergeLessons(currentLesson, nextLesson)) {
            currentLesson = mergeTwoLessons(currentLesson, nextLesson);
        } else {
            merged.push(currentLesson);
            currentLesson = nextLesson;
        }
    }

    // Add the last lesson
    merged.push(currentLesson);

    return merged;
}