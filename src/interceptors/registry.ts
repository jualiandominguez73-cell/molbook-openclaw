import type { InterceptorName, InterceptorRegistration } from "./types.js";

export function createInterceptorRegistry() {
  const entries: InterceptorRegistration[] = [];

  return {
    add(reg: InterceptorRegistration): void {
      entries.push(reg);
    },

    remove(id: string): void {
      const idx = entries.findIndex((e) => e.id === id);
      if (idx !== -1) {
        entries.splice(idx, 1);
      }
    },

    get(name: InterceptorName, toolName?: string): InterceptorRegistration[] {
      return entries
        .filter((e) => {
          if (e.name !== name) {
            return false;
          }
          if (toolName && e.toolMatcher && !e.toolMatcher.test(toolName)) {
            return false;
          }
          return true;
        })
        .toSorted((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    },

    list(): InterceptorRegistration[] {
      return entries.slice();
    },

    clear(): void {
      entries.length = 0;
    },
  };
}

export type InterceptorRegistry = ReturnType<typeof createInterceptorRegistry>;
