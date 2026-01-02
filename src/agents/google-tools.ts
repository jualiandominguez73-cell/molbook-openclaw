import fs from "node:fs/promises";
import path from "node:path";

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-ai";
import { type TSchema, Type } from "@sinclair/typebox";
import { type Auth, type calendar_v3, type gmail_v1, google } from "googleapis";

import {
  type BusyPeriod,
  findAvailableSlots,
  parseNaturalDateTime,
} from "./calendar-helpers.js";

type AnyAgentTool = AgentTool<TSchema, unknown>;

const CREDS_DIR = path.join(
  process.env.HOME ?? "/tmp",
  ".clawdis",
  "credentials",
  "google",
);
const OAUTH_CLIENT_PATH = path.join(CREDS_DIR, "oauth-client.json");
const TOKENS_PATH = path.join(CREDS_DIR, "tokens.json");

// ─────────────────────────────────────────────────────────────────────────────
// OAuth2 Client Singleton
// ─────────────────────────────────────────────────────────────────────────────

let cachedAuth: Auth.OAuth2Client | null = null;

async function getAuthClient(): Promise<Auth.OAuth2Client> {
  if (cachedAuth) return cachedAuth;

  const [clientRaw, tokensRaw] = await Promise.all([
    fs.readFile(OAUTH_CLIENT_PATH, "utf-8"),
    fs.readFile(TOKENS_PATH, "utf-8"),
  ]);

  const client = JSON.parse(clientRaw) as {
    installed: { client_id: string; client_secret: string };
  };
  const tokens = JSON.parse(tokensRaw) as {
    access_token: string;
    refresh_token?: string;
    expiry_date?: number;
  };

  const oauth2Client = new google.auth.OAuth2(
    client.installed.client_id,
    client.installed.client_secret,
  );
  oauth2Client.setCredentials(tokens);

  // Auto-refresh tokens
  oauth2Client.on("tokens", async (newTokens) => {
    const existingTokens = JSON.parse(await fs.readFile(TOKENS_PATH, "utf-8"));
    await fs.writeFile(
      TOKENS_PATH,
      JSON.stringify({ ...existingTokens, ...newTokens }, null, 2),
      { mode: 0o600 },
    );
  });

  cachedAuth = oauth2Client;
  return oauth2Client;
}

function jsonResult(payload: unknown): AgentToolResult<unknown> {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Gmail Tool
// ─────────────────────────────────────────────────────────────────────────────

const GmailSchema = Type.Union([
  Type.Object({
    action: Type.Literal("list"),
    query: Type.Optional(Type.String({ description: "Gmail search query" })),
    maxResults: Type.Optional(Type.Number({ default: 10 })),
    labelIds: Type.Optional(Type.Array(Type.String())),
  }),
  Type.Object({
    action: Type.Literal("read"),
    messageId: Type.String({ description: "Message ID to read" }),
  }),
  Type.Object({
    action: Type.Literal("search"),
    query: Type.String({
      description:
        "Gmail search (e.g. 'from:user@example.com', 'subject:meeting', 'is:unread')",
    }),
    maxResults: Type.Optional(Type.Number({ default: 10 })),
  }),
  Type.Object({
    action: Type.Literal("send"),
    to: Type.String({ description: "Recipient email" }),
    subject: Type.String(),
    body: Type.String(),
    cc: Type.Optional(Type.String()),
    bcc: Type.Optional(Type.String()),
  }),
  Type.Object({
    action: Type.Literal("draft"),
    to: Type.String({ description: "Recipient email" }),
    subject: Type.String(),
    body: Type.String(),
  }),
  Type.Object({
    action: Type.Literal("labels"),
  }),
  Type.Object({
    action: Type.Literal("profile"),
  }),
]);

function extractEmailBody(
  payload: gmail_v1.Schema$MessagePart | undefined,
): string {
  if (!payload) return "";

  if (payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8");
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return Buffer.from(part.body.data, "base64").toString("utf-8");
      }
    }
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        return Buffer.from(part.body.data, "base64").toString("utf-8");
      }
    }
    for (const part of payload.parts) {
      const nested = extractEmailBody(part);
      if (nested) return nested;
    }
  }

  return "";
}

function parseEmailMessage(message: gmail_v1.Schema$Message) {
  const headers = message.payload?.headers ?? [];
  const getHeader = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value;

  return {
    id: message.id,
    threadId: message.threadId,
    from: getHeader("From"),
    to: getHeader("To"),
    subject: getHeader("Subject"),
    date: getHeader("Date"),
    snippet: message.snippet,
    body: extractEmailBody(message.payload),
    labels: message.labelIds,
  };
}

function createGmailTool(): AnyAgentTool {
  return {
    label: "Gmail",
    name: "google_gmail",
    description:
      "Read, search, send, and draft emails via Gmail. Use search with Gmail query syntax (from:, subject:, is:unread, etc.).",
    parameters: GmailSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const action = params.action as string;

      const auth = await getAuthClient();
      const gmail = google.gmail({ version: "v1", auth });

      switch (action) {
        case "profile": {
          const profile = await gmail.users.getProfile({ userId: "me" });
          return jsonResult({
            email: profile.data.emailAddress,
            messagesTotal: profile.data.messagesTotal,
            threadsTotal: profile.data.threadsTotal,
          });
        }

        case "labels": {
          const labels = await gmail.users.labels.list({ userId: "me" });
          return jsonResult({
            labels: labels.data.labels?.map((l) => ({
              id: l.id,
              name: l.name,
              type: l.type,
            })),
          });
        }

        case "list": {
          const query = params.query as string | undefined;
          const maxResults = (params.maxResults as number) ?? 10;
          const labelIds = params.labelIds as string[] | undefined;

          const list = await gmail.users.messages.list({
            userId: "me",
            q: query,
            maxResults,
            labelIds: labelIds ?? ["INBOX"],
          });

          const messages = await Promise.all(
            (list.data.messages ?? []).slice(0, maxResults).map(async (m) => {
              const msg = await gmail.users.messages.get({
                userId: "me",
                id: m.id!,
                format: "metadata",
                metadataHeaders: ["From", "Subject", "Date"],
              });
              const headers = msg.data.payload?.headers ?? [];
              const getHeader = (name: string) =>
                headers.find(
                  (h) => h.name?.toLowerCase() === name.toLowerCase(),
                )?.value;
              return {
                id: msg.data.id,
                from: getHeader("From"),
                subject: getHeader("Subject"),
                date: getHeader("Date"),
                snippet: msg.data.snippet,
              };
            }),
          );

          return jsonResult({ count: messages.length, messages });
        }

        case "search": {
          const query = params.query as string;
          const maxResults = (params.maxResults as number) ?? 10;

          const list = await gmail.users.messages.list({
            userId: "me",
            q: query,
            maxResults,
          });

          const messages = await Promise.all(
            (list.data.messages ?? []).slice(0, maxResults).map(async (m) => {
              const msg = await gmail.users.messages.get({
                userId: "me",
                id: m.id!,
                format: "metadata",
                metadataHeaders: ["From", "Subject", "Date"],
              });
              const headers = msg.data.payload?.headers ?? [];
              const getHeader = (name: string) =>
                headers.find(
                  (h) => h.name?.toLowerCase() === name.toLowerCase(),
                )?.value;
              return {
                id: msg.data.id,
                from: getHeader("From"),
                subject: getHeader("Subject"),
                date: getHeader("Date"),
                snippet: msg.data.snippet,
              };
            }),
          );

          return jsonResult({ query, count: messages.length, messages });
        }

        case "read": {
          const messageId = params.messageId as string;
          const msg = await gmail.users.messages.get({
            userId: "me",
            id: messageId,
            format: "full",
          });
          return jsonResult(parseEmailMessage(msg.data));
        }

        case "send": {
          const to = params.to as string;
          const subject = params.subject as string;
          const body = params.body as string;
          const cc = params.cc as string | undefined;
          const bcc = params.bcc as string | undefined;

          const headers = [
            `To: ${to}`,
            `Subject: ${subject}`,
            "Content-Type: text/plain; charset=utf-8",
          ];
          if (cc) headers.push(`Cc: ${cc}`);
          if (bcc) headers.push(`Bcc: ${bcc}`);

          const raw = [...headers, "", body].join("\r\n");
          const encoded = Buffer.from(raw)
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");

          const sent = await gmail.users.messages.send({
            userId: "me",
            requestBody: { raw: encoded },
          });

          return jsonResult({
            success: true,
            messageId: sent.data.id,
            threadId: sent.data.threadId,
            to,
            subject,
          });
        }

        case "draft": {
          const to = params.to as string;
          const subject = params.subject as string;
          const body = params.body as string;

          const raw = [
            `To: ${to}`,
            `Subject: ${subject}`,
            "Content-Type: text/plain; charset=utf-8",
            "",
            body,
          ].join("\r\n");

          const encoded = Buffer.from(raw)
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");

          const draft = await gmail.users.drafts.create({
            userId: "me",
            requestBody: { message: { raw: encoded } },
          });

          return jsonResult({
            success: true,
            draftId: draft.data.id,
            to,
            subject,
          });
        }

        default:
          throw new Error(`Unknown Gmail action: ${action}`);
      }
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Google Calendar Tool
// ─────────────────────────────────────────────────────────────────────────────

const CalendarSchema = Type.Union([
  Type.Object({
    action: Type.Literal("list_calendars"),
  }),
  Type.Object({
    action: Type.Literal("list_events"),
    calendarId: Type.Optional(Type.String({ default: "primary" })),
    maxResults: Type.Optional(Type.Number({ default: 10 })),
    timeMin: Type.Optional(Type.String({ description: "ISO date string" })),
    timeMax: Type.Optional(Type.String({ description: "ISO date string" })),
  }),
  Type.Object({
    action: Type.Literal("get_event"),
    eventId: Type.String(),
    calendarId: Type.Optional(Type.String({ default: "primary" })),
  }),
  Type.Object({
    action: Type.Literal("create_event"),
    summary: Type.String({ description: "Event title" }),
    start: Type.String({ description: "Start datetime (ISO format)" }),
    end: Type.String({ description: "End datetime (ISO format)" }),
    description: Type.Optional(Type.String()),
    location: Type.Optional(Type.String()),
    attendees: Type.Optional(Type.Array(Type.String())),
    calendarId: Type.Optional(Type.String({ default: "primary" })),
    timezone: Type.Optional(Type.String({ default: "Europe/Vienna" })),
  }),
  Type.Object({
    action: Type.Literal("update_event"),
    eventId: Type.String(),
    calendarId: Type.Optional(Type.String({ default: "primary" })),
    summary: Type.Optional(Type.String()),
    start: Type.Optional(Type.String()),
    end: Type.Optional(Type.String()),
    description: Type.Optional(Type.String()),
    location: Type.Optional(Type.String()),
  }),
  Type.Object({
    action: Type.Literal("delete_event"),
    eventId: Type.String(),
    calendarId: Type.Optional(Type.String({ default: "primary" })),
  }),
  Type.Object({
    action: Type.Literal("freebusy"),
    timeMin: Type.String({ description: "Start time (ISO)" }),
    timeMax: Type.String({ description: "End time (ISO)" }),
    calendarIds: Type.Optional(Type.Array(Type.String())),
  }),
  // Enhanced calendar actions
  Type.Object({
    action: Type.Literal("parse_natural"),
    text: Type.String({
      description:
        "Natural language datetime (e.g., 'Tuesday 3pm', 'next Friday at 2:30', 'tomorrow morning')",
    }),
    timezone: Type.Optional(Type.String({ default: "Europe/Vienna" })),
  }),
  Type.Object({
    action: Type.Literal("find_available_slots"),
    durationMinutes: Type.Number({
      description: "Meeting duration in minutes",
    }),
    rangeStart: Type.Optional(
      Type.String({
        description: "Start of search range (ISO date). Defaults to now.",
      }),
    ),
    rangeEnd: Type.Optional(
      Type.String({
        description:
          "End of search range (ISO date). Defaults to 7 days from now.",
      }),
    ),
    calendarIds: Type.Optional(Type.Array(Type.String())),
    workingHoursOnly: Type.Optional(
      Type.Boolean({
        description: "Only suggest slots during 9am-5pm. Default true.",
      }),
    ),
    maxSlots: Type.Optional(Type.Number({ default: 5 })),
    timezone: Type.Optional(Type.String({ default: "Europe/Vienna" })),
  }),
  Type.Object({
    action: Type.Literal("create_event_natural"),
    text: Type.String({
      description:
        "Natural language event (e.g., 'Meeting with John tomorrow at 3pm for 1 hour')",
    }),
    summary: Type.Optional(
      Type.String({ description: "Event title if not parsed from text" }),
    ),
    durationMinutes: Type.Optional(
      Type.Number({ description: "Duration if not parsed. Default 60." }),
    ),
    description: Type.Optional(Type.String()),
    location: Type.Optional(Type.String()),
    calendarId: Type.Optional(Type.String({ default: "primary" })),
    timezone: Type.Optional(Type.String({ default: "Europe/Vienna" })),
  }),
]);

function formatEvent(event: calendar_v3.Schema$Event) {
  return {
    id: event.id,
    summary: event.summary,
    description: event.description,
    location: event.location,
    start: event.start?.dateTime ?? event.start?.date,
    end: event.end?.dateTime ?? event.end?.date,
    attendees: event.attendees?.map((a) => ({
      email: a.email,
      responseStatus: a.responseStatus,
    })),
    htmlLink: event.htmlLink,
    status: event.status,
  };
}

function createCalendarTool(): AnyAgentTool {
  return {
    label: "Google Calendar",
    name: "google_calendar",
    description:
      "Manage Google Calendar events. List, create, update, delete events and check availability.",
    parameters: CalendarSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const action = params.action as string;

      const auth = await getAuthClient();
      const calendar = google.calendar({ version: "v3", auth });

      switch (action) {
        case "list_calendars": {
          const list = await calendar.calendarList.list();
          return jsonResult({
            calendars: list.data.items?.map((c) => ({
              id: c.id,
              summary: c.summary,
              primary: c.primary,
              timeZone: c.timeZone,
            })),
          });
        }

        case "list_events": {
          const calendarId = (params.calendarId as string) ?? "primary";
          const maxResults = (params.maxResults as number) ?? 10;
          const timeMin =
            (params.timeMin as string) ?? new Date().toISOString();
          const timeMax = params.timeMax as string | undefined;

          const events = await calendar.events.list({
            calendarId,
            maxResults,
            timeMin,
            timeMax,
            singleEvents: true,
            orderBy: "startTime",
          });

          return jsonResult({
            calendar: calendarId,
            count: events.data.items?.length ?? 0,
            events: events.data.items?.map(formatEvent),
          });
        }

        case "get_event": {
          const eventId = params.eventId as string;
          const calendarId = (params.calendarId as string) ?? "primary";

          const event = await calendar.events.get({ calendarId, eventId });
          return jsonResult(formatEvent(event.data));
        }

        case "create_event": {
          const calendarId = (params.calendarId as string) ?? "primary";
          const timezone = (params.timezone as string) ?? "Europe/Vienna";
          const attendees = params.attendees as string[] | undefined;

          const event = await calendar.events.insert({
            calendarId,
            sendUpdates: attendees ? "all" : "none",
            requestBody: {
              summary: params.summary as string,
              description: params.description as string | undefined,
              location: params.location as string | undefined,
              start: {
                dateTime: params.start as string,
                timeZone: timezone,
              },
              end: {
                dateTime: params.end as string,
                timeZone: timezone,
              },
              attendees: attendees?.map((email) => ({ email })),
            },
          });

          return jsonResult({
            success: true,
            event: formatEvent(event.data),
          });
        }

        case "update_event": {
          const eventId = params.eventId as string;
          const calendarId = (params.calendarId as string) ?? "primary";

          const existing = await calendar.events.get({ calendarId, eventId });
          const updates: calendar_v3.Schema$Event = {};

          if (params.summary) updates.summary = params.summary as string;
          if (params.description)
            updates.description = params.description as string;
          if (params.location) updates.location = params.location as string;
          if (params.start)
            updates.start = {
              dateTime: params.start as string,
              timeZone: existing.data.start?.timeZone,
            };
          if (params.end)
            updates.end = {
              dateTime: params.end as string,
              timeZone: existing.data.end?.timeZone,
            };

          const event = await calendar.events.patch({
            calendarId,
            eventId,
            requestBody: updates,
          });

          return jsonResult({
            success: true,
            event: formatEvent(event.data),
          });
        }

        case "delete_event": {
          const eventId = params.eventId as string;
          const calendarId = (params.calendarId as string) ?? "primary";

          await calendar.events.delete({ calendarId, eventId });
          return jsonResult({ success: true, eventId, deleted: true });
        }

        case "freebusy": {
          const timeMin = params.timeMin as string;
          const timeMax = params.timeMax as string;
          const calendarIds = (params.calendarIds as string[]) ?? ["primary"];

          const freebusy = await calendar.freebusy.query({
            requestBody: {
              timeMin,
              timeMax,
              items: calendarIds.map((id) => ({ id })),
            },
          });

          const result: Record<string, unknown> = {};
          for (const [calId, data] of Object.entries(
            freebusy.data.calendars ?? {},
          )) {
            result[calId] = {
              busy: data.busy?.map((b) => ({ start: b.start, end: b.end })),
            };
          }

          return jsonResult({ timeMin, timeMax, calendars: result });
        }

        // Enhanced calendar actions
        case "parse_natural": {
          const text = params.text as string;
          const timezone = (params.timezone as string) ?? "Europe/Vienna";

          const parsed = parseNaturalDateTime(text, timezone);
          if (!parsed) {
            return jsonResult({
              success: false,
              error: "Could not parse datetime from text",
              text,
            });
          }

          return jsonResult({
            success: true,
            text,
            start: parsed.start,
            end: parsed.end,
            parsed: parsed.parsed,
          });
        }

        case "find_available_slots": {
          const durationMinutes = params.durationMinutes as number;
          const timezone = (params.timezone as string) ?? "Europe/Vienna";
          const calendarIds = (params.calendarIds as string[]) ?? ["primary"];
          const workingHoursOnly = (params.workingHoursOnly as boolean) ?? true;
          const maxSlots = (params.maxSlots as number) ?? 5;

          const now = new Date();
          const rangeStart = params.rangeStart
            ? new Date(params.rangeStart as string)
            : now;
          const rangeEnd = params.rangeEnd
            ? new Date(params.rangeEnd as string)
            : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

          // Get busy periods from freebusy API
          const freebusy = await calendar.freebusy.query({
            requestBody: {
              timeMin: rangeStart.toISOString(),
              timeMax: rangeEnd.toISOString(),
              items: calendarIds.map((id) => ({ id })),
            },
          });

          // Collect all busy periods across calendars
          const busyPeriods: BusyPeriod[] = [];
          for (const data of Object.values(freebusy.data.calendars ?? {})) {
            for (const busy of data.busy ?? []) {
              if (busy.start && busy.end) {
                busyPeriods.push({ start: busy.start, end: busy.end });
              }
            }
          }

          const slots = findAvailableSlots({
            durationMinutes,
            rangeStart,
            rangeEnd,
            busyPeriods,
            workingHoursOnly,
            maxSlots,
            timezone,
          });

          return jsonResult({
            durationMinutes,
            rangeStart: rangeStart.toISOString(),
            rangeEnd: rangeEnd.toISOString(),
            workingHoursOnly,
            count: slots.length,
            slots: slots.map((s) => ({
              start: s.start.toISOString(),
              end: s.end.toISOString(),
              formatted: `${s.start.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                timeZone: timezone,
              })} ${s.start.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                timeZone: timezone,
              })} - ${s.end.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                timeZone: timezone,
              })}`,
            })),
          });
        }

        case "create_event_natural": {
          const text = params.text as string;
          const timezone = (params.timezone as string) ?? "Europe/Vienna";
          const calendarId = (params.calendarId as string) ?? "primary";
          const defaultDuration = (params.durationMinutes as number) ?? 60;

          // Parse the natural language text
          const parsed = parseNaturalDateTime(text, timezone);
          if (!parsed) {
            return jsonResult({
              success: false,
              error: "Could not parse datetime from text",
              text,
            });
          }

          // Calculate end time
          let endDateTime: string;
          if (parsed.end) {
            endDateTime = parsed.end;
          } else {
            const endDate = new Date(parsed.start);
            endDate.setMinutes(endDate.getMinutes() + defaultDuration);
            endDateTime = endDate.toISOString();
          }

          // Use provided summary or extract from text
          const summary =
            (params.summary as string) ??
            (text
              .replace(/\b(tomorrow|today|next|this|at|for|on)\b.*$/i, "")
              .trim() ||
              "Event");

          const event = await calendar.events.insert({
            calendarId,
            requestBody: {
              summary,
              description: params.description as string | undefined,
              location: params.location as string | undefined,
              start: {
                dateTime: parsed.start,
                timeZone: timezone,
              },
              end: {
                dateTime: endDateTime,
                timeZone: timezone,
              },
            },
          });

          return jsonResult({
            success: true,
            naturalInput: text,
            parsed: parsed.parsed,
            event: formatEvent(event.data),
          });
        }

        default:
          throw new Error(`Unknown Calendar action: ${action}`);
      }
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Google Drive Tool
// ─────────────────────────────────────────────────────────────────────────────

const DriveSchema = Type.Union([
  Type.Object({
    action: Type.Literal("list"),
    query: Type.Optional(
      Type.String({
        description: "Drive search query (e.g. name contains 'report')",
      }),
    ),
    maxResults: Type.Optional(Type.Number({ default: 20 })),
    folderId: Type.Optional(Type.String({ description: "Parent folder ID" })),
  }),
  Type.Object({
    action: Type.Literal("get"),
    fileId: Type.String(),
  }),
  Type.Object({
    action: Type.Literal("read"),
    fileId: Type.String(),
    mimeType: Type.Optional(
      Type.String({ description: "Export mime type for Google Docs" }),
    ),
  }),
  Type.Object({
    action: Type.Literal("search"),
    query: Type.String({
      description:
        "Search query using Drive syntax (name contains 'x', mimeType='...', etc.)",
    }),
    maxResults: Type.Optional(Type.Number({ default: 20 })),
  }),
]);

function createDriveTool(): AnyAgentTool {
  return {
    label: "Google Drive",
    name: "google_drive",
    description:
      "Browse and read files from Google Drive. Supports searching, listing folders, and reading file contents (text/Google Docs).",
    parameters: DriveSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const action = params.action as string;

      const auth = await getAuthClient();
      const drive = google.drive({ version: "v3", auth });

      switch (action) {
        case "list": {
          const maxResults = (params.maxResults as number) ?? 20;
          const folderId = params.folderId as string | undefined;
          const query = params.query as string | undefined;

          let q = "trashed = false";
          if (folderId) q += ` and '${folderId}' in parents`;
          if (query) q += ` and ${query}`;

          const list = await drive.files.list({
            pageSize: maxResults,
            q,
            fields: "files(id, name, mimeType, size, modifiedTime, parents)",
          });

          return jsonResult({
            count: list.data.files?.length ?? 0,
            files: list.data.files?.map((f) => ({
              id: f.id,
              name: f.name,
              mimeType: f.mimeType,
              size: f.size,
              modifiedTime: f.modifiedTime,
            })),
          });
        }

        case "search": {
          const query = params.query as string;
          const maxResults = (params.maxResults as number) ?? 20;

          const list = await drive.files.list({
            pageSize: maxResults,
            q: `${query} and trashed = false`,
            fields: "files(id, name, mimeType, size, modifiedTime)",
          });

          return jsonResult({
            query,
            count: list.data.files?.length ?? 0,
            files: list.data.files?.map((f) => ({
              id: f.id,
              name: f.name,
              mimeType: f.mimeType,
              size: f.size,
              modifiedTime: f.modifiedTime,
            })),
          });
        }

        case "get": {
          const fileId = params.fileId as string;

          const file = await drive.files.get({
            fileId,
            fields:
              "id, name, mimeType, size, modifiedTime, webViewLink, parents",
          });

          return jsonResult({
            id: file.data.id,
            name: file.data.name,
            mimeType: file.data.mimeType,
            size: file.data.size,
            modifiedTime: file.data.modifiedTime,
            webViewLink: file.data.webViewLink,
          });
        }

        case "read": {
          const fileId = params.fileId as string;
          const exportMimeType = params.mimeType as string | undefined;

          // Get file metadata first
          const meta = await drive.files.get({
            fileId,
            fields: "mimeType, name",
          });
          const mimeType = meta.data.mimeType ?? "";
          const name = meta.data.name ?? "";

          // Google Docs/Sheets/Slides need export
          if (mimeType.startsWith("application/vnd.google-apps.")) {
            const exportType =
              exportMimeType ??
              (mimeType.includes("document")
                ? "text/plain"
                : mimeType.includes("spreadsheet")
                  ? "text/csv"
                  : "text/plain");

            const exported = await drive.files.export(
              { fileId, mimeType: exportType },
              { responseType: "text" },
            );

            const exportedStr = String(exported.data ?? "");
            return jsonResult({
              fileId,
              name,
              mimeType: exportType,
              content: exportedStr.slice(0, 50000),
            });
          }

          // Regular files - download content
          if (mimeType.startsWith("text/") || mimeType === "application/json") {
            const content = await drive.files.get(
              { fileId, alt: "media" },
              { responseType: "text" },
            );

            const contentStr = String(content.data ?? "");
            return jsonResult({
              fileId,
              name,
              mimeType,
              content: contentStr.slice(0, 50000),
            });
          }

          return jsonResult({
            fileId,
            name,
            mimeType,
            note: "Binary file - use 'get' for metadata only",
          });
        }

        default:
          throw new Error(`Unknown Drive action: ${action}`);
      }
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

export function createGoogleTools(): AnyAgentTool[] {
  return [createGmailTool(), createCalendarTool(), createDriveTool()];
}
