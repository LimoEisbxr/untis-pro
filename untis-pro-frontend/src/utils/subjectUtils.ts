/**
 * Extract subject type from lesson name for color grouping.
 * 
 * If the lesson name contains an underscore, returns the part before the first underscore.
 * Otherwise, returns the entire lesson name.
 * 
 * Examples:
 * - "M_LK_1" -> "M"
 * - "M" -> "M"
 * - "English_Advanced" -> "English"
 * - "PE" -> "PE"
 * 
 * @param lessonName The full lesson name from the lesson data
 * @returns The subject type to use for color grouping
 */
export function extractSubjectType(lessonName: string): string {
    if (lessonName.includes('_')) {
        const beforeUnderscore = lessonName.split('_')[0];
        return beforeUnderscore || lessonName;
    }
    return lessonName;
}