/**
 * Calendar helper functions for natural language parsing and slot finding.
 */

export interface TimeSlot {
  start: Date;
  end: Date;
}

export interface BusyPeriod {
  start: string;
  end: string;
}

export interface FindSlotsOptions {
  durationMinutes: number;
  rangeStart: Date;
  rangeEnd: Date;
  busyPeriods: BusyPeriod[];
  workingHoursOnly?: boolean;
  workingHoursStart?: number; // hour (0-23), default 9
  workingHoursEnd?: number; // hour (0-23), default 17
  maxSlots?: number;
  timezone?: string;
}

/**
 * Parse natural language datetime text to ISO strings.
 * Uses built-in Date parsing with pattern matching for common phrases.
 */
export function parseNaturalDateTime(
  text: string,
  timezone = "Europe/Vienna",
): { start: string; end?: string; parsed: string } | null {
  const now = new Date();
  const input = text.toLowerCase().trim();

  // Try to extract time
  let hour: number | null = null;
  let minute = 0;
  let durationMinutes: number | null = null;

  // Parse time patterns
  const timePatterns = [
    // "3pm", "3:30pm", "15:30"
    /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i,
  ];

  for (const pattern of timePatterns) {
    const match = input.match(pattern);
    if (match) {
      hour = parseInt(match[1], 10);
      minute = match[2] ? parseInt(match[2], 10) : 0;
      const ampm = match[3]?.toLowerCase();
      if (ampm === "pm" && hour < 12) hour += 12;
      if (ampm === "am" && hour === 12) hour = 0;
      break;
    }
  }

  // Parse duration patterns
  const durationPatterns = [
    /for\s+(\d+)\s*(?:hour|hr)s?/i,
    /(\d+)\s*(?:hour|hr)s?\s+(?:long|meeting|call)/i,
    /for\s+(\d+)\s*(?:minute|min)s?/i,
  ];

  for (const pattern of durationPatterns) {
    const match = input.match(pattern);
    if (match) {
      const value = parseInt(match[1], 10);
      if (pattern.source.includes("minute|min")) {
        durationMinutes = value;
      } else {
        durationMinutes = value * 60;
      }
      break;
    }
  }

  // Parse date patterns
  let targetDate: Date | null = null;

  // "today"
  if (/\btoday\b/.test(input)) {
    targetDate = new Date(now);
  }
  // "tomorrow"
  else if (/\btomorrow\b/.test(input)) {
    targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + 1);
  }
  // "next week"
  else if (/\bnext\s+week\b/.test(input)) {
    targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + 7);
  }
  // "this weekend"
  else if (/\bthis\s+weekend\b/.test(input)) {
    targetDate = new Date(now);
    const dayOfWeek = targetDate.getDay();
    const daysUntilSaturday = (6 - dayOfWeek + 7) % 7 || 7;
    targetDate.setDate(targetDate.getDate() + daysUntilSaturday);
  }
  // Day names: "monday", "tuesday", etc.
  else {
    const days = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    const nextMatch = input.match(
      /\b(?:next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i,
    );
    if (nextMatch) {
      const targetDay = days.indexOf(nextMatch[1].toLowerCase());
      const isNext = input.includes("next");
      targetDate = new Date(now);
      const currentDay = targetDate.getDay();
      let daysToAdd = (targetDay - currentDay + 7) % 7;
      if (daysToAdd === 0) daysToAdd = 7; // Same day means next week
      if (isNext) daysToAdd += 7;
      targetDate.setDate(targetDate.getDate() + daysToAdd);
    }
  }

  // Time of day defaults
  if (hour === null) {
    if (/\bmorning\b/.test(input)) {
      hour = 9;
      minute = 0;
    } else if (/\bafternoon\b/.test(input)) {
      hour = 14;
      minute = 0;
    } else if (/\bevening\b/.test(input)) {
      hour = 18;
      minute = 0;
    } else if (/\bnoon\b/.test(input)) {
      hour = 12;
      minute = 0;
    } else {
      // Default to 9am if no time specified
      hour = 9;
      minute = 0;
    }
  }

  // If no date found, default to today or tomorrow if time has passed
  if (!targetDate) {
    targetDate = new Date(now);
    if (hour !== null) {
      const targetTime = new Date(targetDate);
      targetTime.setHours(hour, minute, 0, 0);
      if (targetTime <= now) {
        targetDate.setDate(targetDate.getDate() + 1);
      }
    }
  }

  // Set the time
  targetDate.setHours(hour, minute, 0, 0);

  const start = targetDate.toISOString();
  let end: string | undefined;
  if (durationMinutes) {
    const endDate = new Date(targetDate);
    endDate.setMinutes(endDate.getMinutes() + durationMinutes);
    end = endDate.toISOString();
  }

  return {
    start,
    end,
    parsed: `${targetDate.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: timezone,
    })} at ${targetDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: timezone,
    })}${durationMinutes ? ` for ${durationMinutes} minutes` : ""}`,
  };
}

/**
 * Find available time slots given busy periods.
 */
export function findAvailableSlots(options: FindSlotsOptions): TimeSlot[] {
  const {
    durationMinutes,
    rangeStart,
    rangeEnd,
    busyPeriods,
    workingHoursOnly = true,
    workingHoursStart = 9,
    workingHoursEnd = 17,
    maxSlots = 5,
  } = options;

  // Convert busy periods to Date objects and sort
  const busy = busyPeriods
    .map((b) => ({
      start: new Date(b.start),
      end: new Date(b.end),
    }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const slots: TimeSlot[] = [];
  const durationMs = durationMinutes * 60 * 1000;

  // Iterate day by day
  const currentDay = new Date(rangeStart);
  currentDay.setHours(0, 0, 0, 0);

  while (currentDay < rangeEnd && slots.length < maxSlots) {
    // Skip weekends if working hours only
    const dayOfWeek = currentDay.getDay();
    if (workingHoursOnly && (dayOfWeek === 0 || dayOfWeek === 6)) {
      currentDay.setDate(currentDay.getDate() + 1);
      continue;
    }

    // Set working hours boundaries for this day
    const dayStart = new Date(currentDay);
    const dayEnd = new Date(currentDay);

    if (workingHoursOnly) {
      dayStart.setHours(workingHoursStart, 0, 0, 0);
      dayEnd.setHours(workingHoursEnd, 0, 0, 0);
    } else {
      dayStart.setHours(0, 0, 0, 0);
      dayEnd.setHours(23, 59, 59, 999);
    }

    // Clamp to search range
    const searchStart = new Date(
      Math.max(dayStart.getTime(), rangeStart.getTime()),
    );
    const searchEnd = new Date(Math.min(dayEnd.getTime(), rangeEnd.getTime()));

    // Get busy periods for this day
    const dayBusy = busy.filter(
      (b) => b.start < searchEnd && b.end > searchStart,
    );

    // Find gaps
    let pointer = searchStart;

    for (const b of dayBusy) {
      // Gap before this busy period?
      if (b.start > pointer) {
        const gapEnd = new Date(
          Math.min(b.start.getTime(), searchEnd.getTime()),
        );
        const gapMs = gapEnd.getTime() - pointer.getTime();

        if (gapMs >= durationMs) {
          slots.push({
            start: new Date(pointer),
            end: new Date(pointer.getTime() + durationMs),
          });
          if (slots.length >= maxSlots) break;
        }
      }
      // Move pointer past this busy period
      pointer = new Date(Math.max(pointer.getTime(), b.end.getTime()));
    }

    // Gap after all busy periods?
    if (pointer < searchEnd && slots.length < maxSlots) {
      const gapMs = searchEnd.getTime() - pointer.getTime();
      if (gapMs >= durationMs) {
        slots.push({
          start: new Date(pointer),
          end: new Date(pointer.getTime() + durationMs),
        });
      }
    }

    currentDay.setDate(currentDay.getDate() + 1);
  }

  return slots.slice(0, maxSlots);
}
