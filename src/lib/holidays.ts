// South Korea Legal & Substitute Public Holidays Utility

interface HolidayMap {
  [dateStr: string]: string; // e.g. "2026-03-01": "삼일절"
}

// Year-specific movable lunar & substitute holidays
const VARIABLE_HOLIDAYS: Record<number, HolidayMap> = {
  2025: {
    '2025-01-28': '설날 전날',
    '2025-01-29': '설날',
    '2025-01-30': '설날 다음날',
    '2025-03-03': '대체공휴일(삼일절)',
    '2025-05-05': '어린이날/부처님오신날',
    '2025-05-06': '대체공휴일',
    '2025-10-05': '추석 전날',
    '2025-10-06': '추석',
    '2025-10-07': '추석 다음날',
    '2025-10-08': '대체공휴일(추석)',
  },
  2026: {
    '2026-02-16': '설날 전날',
    '2026-02-17': '설날',
    '2026-02-18': '설날 다음날',
    '2026-03-02': '대체공휴일(삼일절)',
    '2026-05-24': '부처님오신날',
    '2026-05-25': '대체공휴일(부처님오신날)',
    '2026-08-17': '대체공휴일(광복절)',
    '2026-09-24': '추석 전날',
    '2026-09-25': '추석',
    '2026-09-26': '추석 다음날',
    '2026-10-05': '대체공휴일(개천절)',
  },
  2027: {
    '2027-02-06': '설날 전날',
    '2027-02-07': '설날',
    '2027-02-08': '설날 다음날',
    '2027-02-09': '대체공휴일(설날)',
    '2027-05-13': '부처님오신날',
    '2027-08-16': '대체공휴일(광복절)',
    '2027-09-14': '추석 전날',
    '2027-09-15': '추석',
    '2027-09-16': '추석 다음날',
    '2027-10-04': '대체공휴일(개천절)',
  },
};

export function getKoreanHolidays(year: number): HolidayMap {
  const holidays: HolidayMap = {};

  // Fixed solar holidays
  const fixedHolidays: Record<string, string> = {
    '01-01': '신정',
    '03-01': '삼일절',
    '05-05': '어린이날',
    '06-06': '현충일',
    '08-15': '광복절',
    '10-03': '개천절',
    '10-09': '한글날',
    '12-25': '성탄절',
  };

  Object.entries(fixedHolidays).forEach(([mmdd, name]) => {
    const fullDate = `${year}-${mmdd}`;
    holidays[fullDate] = name;
  });

  // Merge variable holidays if defined
  if (VARIABLE_HOLIDAYS[year]) {
    Object.assign(holidays, VARIABLE_HOLIDAYS[year]);
  }

  return holidays;
}

export function isKoreanHoliday(dateStr: string): string | null {
  const year = parseInt(dateStr.substring(0, 4), 10);
  if (isNaN(year)) return null;
  const holidays = getKoreanHolidays(year);
  return holidays[dateStr] || null;
}
