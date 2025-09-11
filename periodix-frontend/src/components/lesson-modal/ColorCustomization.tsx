import ColorPicker from '../ColorPicker';
import type { LessonColors, Lesson } from '../../types';
import { extractSubjectType } from '../../utils/subjectUtils';

interface Props {
    lesson: Lesson;
    lessonColors?: LessonColors;
    defaultLessonColors?: LessonColors;
    gradientOffsets?: Record<string, number>;
    isAdmin?: boolean;
    onColorChange?: (
        lessonName: string,
        color: string | null,
        offset?: number
    ) => void;
    onGradientOffsetChange?: (lessonName: string, offset: number) => void;
}

export function ColorCustomization({
    lesson,
    lessonColors,
    defaultLessonColors,
    gradientOffsets,
    isAdmin,
    onColorChange,
    onGradientOffsetChange,
}: Props) {
    const subject = lesson.su?.[0]?.name ?? lesson.activityType ?? '—';
    const subjectType = extractSubjectType(subject);
    if (!onColorChange || !subjectType) return null;
    return (
        <div>
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">
                Customize Color
            </h3>
            <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                <ColorPicker
                    currentColor={lessonColors?.[subjectType]}
                    fallbackColor={defaultLessonColors?.[subjectType]}
                    canRemoveFallback={!!isAdmin}
                    onColorChange={(color) =>
                        onColorChange(
                            subjectType,
                            color,
                            gradientOffsets?.[subjectType] ?? 0.5
                        )
                    }
                    onRemoveColor={() => onColorChange(subjectType, null)}
                    isAdmin={!!isAdmin}
                    gradientOffset={gradientOffsets?.[subjectType] ?? 0.5}
                    onGradientOffsetChange={(v) =>
                        onGradientOffsetChange?.(subjectType, v)
                    }
                />
            </div>
        </div>
    );
}
