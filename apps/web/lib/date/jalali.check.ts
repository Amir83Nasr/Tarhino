import assert from "node:assert/strict"

import { parseJalali } from "./jalali.ts"

// Runnable check for parseJalali. No test framework: `node lib/date/jalali.check.ts`
// (Node 24 strips the types). The risky cases are the ones jalaali-js rolls over
// silently instead of rejecting — those are what the round-trip guard is for.

// ── ACCEPTED ───────────────────────────────────────────────

assert.equal(parseJalali("1404/03/15"), "2025-06-05", "persian digits, slashes")
assert.equal(parseJalali("1404-3-15"), "2025-06-05", "latin digits, dashes")
assert.equal(parseJalali("۱۴۰۴.۰۳.۱۵"), "2025-06-05", "dots, mixed input")
assert.equal(parseJalali(" 1403/12/30 "), "2025-03-20", "1403 is a leap year")

// ── REJECTED: SILENT ROLLOVER ──────────────────────────────
// jalaali-js turns each of these into a valid nearby date. The round-trip
// comparison must catch them or an import moves a plan to the wrong day.

assert.equal(parseJalali("1404/12/30"), null, "1404 has no esfand 30")
assert.equal(parseJalali("1404/13/1"), null, "month 13")
assert.equal(parseJalali("1404/0/5"), null, "month 0")
assert.equal(parseJalali("1404/03/32"), null, "day 32")

// ── REJECTED: SHAPE ────────────────────────────────────────

assert.equal(parseJalali(""), null, "empty")
assert.equal(parseJalali("1404/03"), null, "two parts")
assert.equal(parseJalali("1404/03/15/1"), null, "four parts")
assert.equal(parseJalali("abc"), null, "not a date")

// ── REJECTED: GREGORIAN LEAK ───────────────────────────────
// A Gregorian date in a Jalali column parses as a plausible year without the
// range check.

assert.equal(parseJalali("2025/06/05"), null, "gregorian year")
assert.equal(parseJalali("1999/01/01"), null, "gregorian year")
assert.equal(parseJalali("1200/01/01"), null, "below the window")

console.log("jalali.check: ok")
