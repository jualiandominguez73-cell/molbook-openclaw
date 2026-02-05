import { ResizableLayout, Sidebar, ContextPanel, ContextSection } from '../components/layout';
import { useDashboardStore } from '../stores/dashboardStore';
import { Badge, Card, CardContent } from '../components/ui';

export function TimelineView() {
  const tracks = useDashboardStore((s) => s.tracks);
  const workers = useDashboardStore((s) => s.workers);
  const reviews = useDashboardStore((s) => s.reviews);
  const tasks = useDashboardStore((s) => s.tasks);
  const selectedTrackId = useDashboardStore((s) => s.selectedTrackId);
  const selectTrack = useDashboardStore((s) => s.selectTrack);

  // Combine all events for timeline
  const events = [
    ...tasks.map((t) => ({
      id: t.id,
      type: 'task' as const,
      title: t.title,
      status: t.status,
      timestamp: t.createdAt,
    })),
    ...reviews.map((r) => ({
      id: r.id,
      type: 'review' as const,
      title: r.title,
      status: r.status,
      timestamp: r.createdAt,
    })),
  ].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <ResizableLayout
      sidebar={
        <Sidebar
          tracks={tracks}
          workers={workers}
          reviewCount={reviews.filter((r) => r.status === 'pending').length}
          selectedTrackId={selectedTrackId}
          onTrackSelect={selectTrack}
        />
      }
      main={
        <div className="flex flex-col h-full overflow-hidden">
          <div className="flex items-center px-5 py-4 border-b border-[var(--color-border)]">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
              Timeline
            </h2>
          </div>
          <div className="flex-1 overflow-auto p-5">
            {events.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-muted)] text-center">
                <div className="text-5xl mb-4 opacity-50">&#9719;</div>
                <div className="text-sm">No events yet</div>
              </div>
            ) : (
              <div className="flex flex-col gap-0 relative before:content-[''] before:absolute before:left-[3px] before:top-2 before:bottom-2 before:w-0.5 before:bg-[var(--color-border)]">
                {events.map((event) => (
                  <div key={event.id} className="flex gap-4 py-3 relative">
                    <div className="w-2 h-2 rounded-full bg-[var(--color-accent)] border-2 border-[var(--color-bg-primary)] mt-1.5 z-[1] shrink-0" />
                    <div className="flex-1 p-3 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-md">
                      <div className="flex items-center justify-between mb-1">
                        <Badge
                          variant={event.type === 'task' ? 'default' : 'purple'}
                          size="sm"
                        >
                          {event.type}
                        </Badge>
                        <span className="text-[11px] text-[var(--color-text-muted)]">
                          {new Date(event.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-[13px] font-medium text-[var(--color-text-primary)] mb-1">
                        {event.title}
                      </div>
                      <div className="text-[11px] text-[var(--color-text-secondary)]">
                        {event.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      }
      context={
        <ContextPanel>
          <ContextSection title="Activity Stats">
            <div className="flex flex-col gap-3">
              <Card>
                <CardContent className="p-4">
                  <div className="text-[11px] text-[var(--color-text-muted)]">
                    Total Events
                  </div>
                  <div className="text-lg font-semibold text-[var(--color-text-primary)]">
                    {events.length}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-[11px] text-[var(--color-text-muted)]">
                    Tasks Created
                  </div>
                  <div className="text-lg font-semibold text-[var(--color-text-primary)]">
                    {tasks.length}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-[11px] text-[var(--color-text-muted)]">
                    Reviews Submitted
                  </div>
                  <div className="text-lg font-semibold text-[var(--color-text-primary)]">
                    {reviews.length}
                  </div>
                </CardContent>
              </Card>
            </div>
          </ContextSection>
        </ContextPanel>
      }
    />
  );
}
