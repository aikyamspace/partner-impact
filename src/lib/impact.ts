/**
 * The impact page's figures, from the partner's activities (owner's call,
 * 29 Sep 2026: sessions run, attendances, hours, outcomes worked on).
 *
 * ⛔ ATTENDANCES, NOT CHILDREN. Strapi records a headcount per session, not
 * who each child is, so the sum of "took part" counts a child once for every
 * session they came to. It is labelled as attendances everywhere.
 * ⛔ A figure is only ever a sum of what was RECORDED; the counts of sessions
 * that recorded it travel with it, so the page can say "on 12 of 41 sessions".
 */
import type { Activity } from './strapi';

export interface Impact {
  sessions: number;
  attendances: number;
  attendanceSessions: number;
  hours: number;
  hourSessions: number;
  outcomes: { name: string; times: number }[];
}

export function impactOf(activities: Pick<Activity, 'attendance' | 'toc'>[]): Impact {
  let attendances = 0;
  let attendanceSessions = 0;
  let hours = 0;
  let hourSessions = 0;
  const outcomeTimes = new Map<string, number>();
  for (const a of activities) {
    if (a.attendance.participants !== null) {
      attendances += a.attendance.participants;
      attendanceSessions++;
    }
    if (a.toc.hours !== null && Number.isFinite(a.toc.hours) && a.toc.hours > 0) {
      hours += a.toc.hours;
      hourSessions++;
    }
    for (const o of a.toc.outcomes) outcomeTimes.set(o, (outcomeTimes.get(o) ?? 0) + 1);
  }
  const outcomes = [...outcomeTimes].map(([name, times]) => ({ name, times })).sort((x, y) => y.times - x.times || x.name.localeCompare(y.name));
  return { sessions: activities.length, attendances, attendanceSessions, hours: Math.round(hours * 10) / 10, hourSessions, outcomes };
}
