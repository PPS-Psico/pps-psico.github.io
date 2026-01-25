import type { CalendarEvent } from '../types';

/**
 * Parses a schedule string (e.g., "Lunes 9 a 13hs") to extract start and end hours.
 * @param schedule The schedule string.
 * @returns An object with start and end hours, or null if parsing fails.
 */
function parseTimeFromSchedule(schedule: string): { startHour: number; endHour: number } | null {
    // Regex to capture "9 a 13", "9:00 a 13:00", "9-13", etc.
    const timeRegex = /(\d{1,2})(?::\d{2})?\s*(?:a|-|hasta)\s*(\d{1,2})(?::\d{2})?/;
    const match = schedule.match(timeRegex);

    if (match && match[1] && match[2]) {
        const startHour = parseInt(match[1], 10);
        const endHour = parseInt(match[2], 10);
        if (!isNaN(startHour) && !isNaN(endHour)) {
            return { startHour, endHour };
        }
    }
    return null;
}

/**
 * Parses a schedule string to find days of the week for iCal RRULE.
 * @param schedule The schedule string.
 * @returns A string like "MO,WE" for Monday and Wednesday.
 */
function parseDaysOfWeek(schedule: string): string {
    const dayMap: { [key: string]: string } = {
        lunes: 'MO', martes: 'TU', miercoles: 'WE', jueves: 'TH', viernes: 'FR', sabado: 'SA', domingo: 'SU',
    };
    const normalizedSchedule = schedule.toLowerCase();
    return Object.keys(dayMap)
        .filter(day => normalizedSchedule.includes(day) && !normalizedSchedule.includes(`no ${day}`))
        .map(day => dayMap[day])
        .join(',');
}


/**
 * Formats a Date object into a string suitable for calendar URLs (YYYYMMDDTHHMMSSZ).
 * @param date The date object.
 * @returns A formatted string in UTC.
 */
function formatToUTC(date: Date): string {
    return date.toISOString().replace(/[-:]|\.\d{3}/g, '');
}

/**
 * Generates Google Calendar and iCal (.ics) links for a recurring event.
 * @param event The calendar event, which should include full PPS start/end dates.
 * @param date A representative date of the event (used to set the initial time).
 * @returns An object with google and ical links, or null if parsing fails.
 */
export function generateRecurringCalendarLinks(event: CalendarEvent & { startDate?: string; endDate?: string }, _date: Date): { google: string; ical: string } | null {
    const timeInfo = parseTimeFromSchedule(event.schedule);
    const byDayRule = parseDaysOfWeek(event.schedule);

    if (!timeInfo || !byDayRule || !event.startDate || !event.endDate) {
        return null; // Cannot generate recurring event without all info
    }

    const { startHour, endHour } = timeInfo;

    const ppsStartDate = new Date(event.startDate);
    ppsStartDate.setUTCHours(startHour, 0, 0, 0);

    const ppsEndDate = new Date(event.startDate);
    ppsEndDate.setUTCHours(endHour, 0, 0, 0);

    if (ppsEndDate < ppsStartDate) {
        ppsEndDate.setUTCDate(ppsEndDate.getUTCDate() + 1);
    }

    // For the UNTIL part of the RRULE, it should be the end of the final day.
    const untilDate = new Date(event.endDate);
    untilDate.setUTCHours(23, 59, 59, 999);

    const calStartUTC = formatToUTC(ppsStartDate);
    const calEndUTC = formatToUTC(ppsEndDate);
    const calUntilUTC = formatToUTC(untilDate);

    const description = `Horario: ${event.schedule}\nOrientación: ${event.orientation}\nUbicación: ${event.location}`;
    const rrule = `RRULE:FREQ=WEEKLY;BYDAY=${byDayRule};UNTIL=${calUntilUTC}`;

    // Google Calendar Link
    const googleParams = new URLSearchParams({
        action: 'TEMPLATE',
        text: event.name,
        dates: `${calStartUTC}/${calEndUTC}`,
        details: description,
        location: event.location,
        recur: rrule,
        ctz: 'UTC'
    });
    const google = `https://www.google.com/calendar/render?${googleParams.toString()}`;

    // iCal Data URI
    const icalContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//MiPanelAcademico//V1.0//EN',
        'BEGIN:VEVENT',
        `UID:${event.id}-recurring@mipanel.com`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]|\.\d{3}/g, '')}`,
        `DTSTART:${calStartUTC}`,
        `DTEND:${calEndUTC}`,
        rrule,
        `SUMMARY:${event.name}`,
        `DESCRIPTION:${description.replace(/\n/g, '\\n')}`,
        `LOCATION:${event.location}`,
        'END:VEVENT',
        'END:VCALENDAR'
    ].join('\r\n');

    const ical = `data:text/calendar;charset=utf8,${encodeURIComponent(icalContent)}`;

    return { google, ical };
}