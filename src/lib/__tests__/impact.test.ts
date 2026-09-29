import { describe, expect, it } from 'vitest';
import { impactOf } from '../impact';

const toc = (over = {}) => ({ materials: null, outsideHelp: null, hours: null, costInr: null, made: [], outcomes: [], evidence: null, evidenceType: null, learnings: null, ...over });
const act = (participants: number | null, tocOver = {}) => ({ attendance: { participants, facilitators: null, audience: null }, toc: toc(tocOver) });

describe('impactOf', () => {
  it('adds up attendances only where a headcount was recorded, and says on how many sessions', () => {
    const i = impactOf([act(10), act(null), act(0), act(12)]);
    expect(i).toMatchObject({ sessions: 4, attendances: 22, attendanceSessions: 3 });
  });
  it('adds up recorded hours and counts the sessions that recorded them', () => {
    const i = impactOf([act(1, { hours: 0.75 }), act(1, { hours: 2 }), act(1)]);
    expect(i).toMatchObject({ hours: 2.8, hourSessions: 2 });
  });
  it('counts each outcome once per session that worked on it, most often first', () => {
    const i = impactOf([act(1, { outcomes: ['Teamwork', 'Empathy'] }), act(1, { outcomes: ['Teamwork'] })]);
    expect(i.outcomes).toEqual([{ name: 'Teamwork', times: 2 }, { name: 'Empathy', times: 1 }]);
  });
  it('is all zeros for no activities', () => {
    expect(impactOf([])).toEqual({ sessions: 0, attendances: 0, attendanceSessions: 0, hours: 0, hourSessions: 0, outcomes: [] });
  });
});
