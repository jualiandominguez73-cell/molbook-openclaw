/**
 * React Query hooks for cron job management.
 */

import { useQuery } from "@tanstack/react-query";
import {
  listCronJobs,
  getCronJob,
  type CronJob,
  type CronJobListResult,
} from "@/lib/api/cron";

// Query keys factory
export const cronKeys = {
  all: ["cron"] as const,
  lists: () => [...cronKeys.all, "list"] as const,
  list: (filters: Record<string, unknown>) => [...cronKeys.lists(), filters] as const,
  details: () => [...cronKeys.all, "detail"] as const,
  detail: (id: string) => [...cronKeys.details(), id] as const,
};

/**
 * Hook to list all cron jobs
 */
export function useCronJobs(params?: { enabled?: boolean; agentId?: string }) {
  return useQuery({
    queryKey: cronKeys.list(params ?? {}),
    queryFn: () => listCronJobs(params),
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Hook to get a specific cron job
 */
export function useCronJob(id: string) {
  return useQuery({
    queryKey: cronKeys.detail(id),
    queryFn: () => getCronJob(id),
    enabled: !!id,
  });
}

/**
 * Hook to get cron jobs filtered by agent
 */
export function useCronJobsByAgent(agentId: string) {
  return useCronJobs({ agentId });
}

/**
 * Hook to get only enabled cron jobs
 */
export function useEnabledCronJobs() {
  return useCronJobs({ enabled: true });
}

// Re-export types
export type { CronJob, CronJobListResult };
