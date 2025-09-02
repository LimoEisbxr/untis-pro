// Configurable lesson period plan used to render the left-side markers.
// Times use Untis-style HHMM numbers (e.g., 740 for 07:40).

export type Period = {
    number: number;
    start: number; // HHMM
    end: number; // HHMM
};

// Default plan based on the provided screenshot.
// You can edit this to match your school. The timetable layout does NOT snap
// to these values; they only affect the left-side labels.
export const DEFAULT_PERIODS: Period[] = [
    { number: 1, start: 740, end: 825 },
    { number: 2, start: 828, end: 913 },
    { number: 3, start: 930, end: 1015 },
    { number: 4, start: 1018, end: 1103 },
    { number: 5, start: 1120, end: 1205 },
    { number: 6, start: 1205, end: 1250 },
    { number: 7, start: 1330, end: 1415 },
    { number: 8, start: 1415, end: 1500 },
    { number: 9, start: 1515, end: 1600 },
    { number: 10, start: 1600, end: 1645 },
];
