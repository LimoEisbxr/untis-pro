import type { Lesson } from '../../types';
import { fmtHM, untisToMinutes } from '../../utils/dates';

export function HomeworkList({ lesson }: { lesson: Lesson }) {
    if (!lesson.homework || lesson.homework.length === 0) return null;
    return (
        <div>
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">
                Homework
            </h3>
            <div className="space-y-3">
                {lesson.homework.map((hw, index) => (
                    <div
                        key={hw.id || index}
                        className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg p-4"
                    >
                        <div className="flex items-start gap-3">
                            <div
                                className={`mt-1 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                    hw.completed
                                        ? 'bg-green-100 border-green-500 dark:bg-green-900/50 dark:border-green-400'
                                        : 'bg-white border-amber-400 dark:bg-slate-800 dark:border-amber-500'
                                }`}
                            >
                                {hw.completed && (
                                    <svg
                                        className="w-3 h-3 text-green-600 dark:text-green-400"
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                    >
                                        <path
                                            fillRule="evenodd"
                                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                            clipRule="evenodd"
                                        />
                                    </svg>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-1">
                                    {hw.text}
                                </p>
                                {hw.remark && (
                                    <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">
                                        {hw.remark}
                                    </p>
                                )}
                                <div className="flex items-center gap-4 text-xs text-amber-600 dark:text-amber-400">
                                    <span>
                                        Due:{' '}
                                        {new Date(
                                            String(hw.date).replace(
                                                /(\d{4})(\d{2})(\d{2})/,
                                                '$1-$2-$3'
                                            )
                                        ).toLocaleDateString()}
                                    </span>
                                    <span
                                        className={
                                            hw.completed
                                                ? 'text-green-600 dark:text-green-400 font-medium'
                                                : ''
                                        }
                                    >
                                        {hw.completed ? 'Completed' : 'Pending'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function ExamsList({ lesson }: { lesson: Lesson }) {
    if (!lesson.exams || lesson.exams.length === 0) return null;
    return (
        <div>
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">
                Exams
            </h3>
            <div className="space-y-3">
                {lesson.exams.map((exam, index) => (
                    <div
                        key={exam.id || index}
                        className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg p-4"
                    >
                        <div className="flex items-start gap-3">
                            <div className="mt-1 flex-shrink-0 w-6 h-6 bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-700 rounded-md flex items-center justify-center">
                                <svg
                                    className="w-3 h-3 text-red-600 dark:text-red-400"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                >
                                    <path
                                        fillRule="evenodd"
                                        d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-red-900 dark:text-red-100 mb-1">
                                    {exam.name}
                                </p>
                                {exam.text && (
                                    <p className="text-xs text-red-700 dark:text-red-300 mb-2">
                                        {exam.text}
                                    </p>
                                )}
                                <div className="flex items-center gap-4 text-xs text-red-600 dark:text-red-400">
                                    <span>
                                        Date:{' '}
                                        {new Date(
                                            String(exam.date).replace(
                                                /(\d{4})(\d{2})(\d{2})/,
                                                '$1-$2-$3'
                                            )
                                        ).toLocaleDateString()}
                                    </span>
                                    <span>
                                        Time:{' '}
                                        {fmtHM(untisToMinutes(exam.startTime))}{' '}
                                        - {fmtHM(untisToMinutes(exam.endTime))}
                                    </span>
                                </div>
                                {exam.rooms && exam.rooms.length > 0 && (
                                    <div className="mt-1 text-xs text-red-600 dark:text-red-400">
                                        Room:{' '}
                                        {exam.rooms
                                            .map(
                                                (r: { name: string }) => r.name
                                            )
                                            .join(', ')}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
