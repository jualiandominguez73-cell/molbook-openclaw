import { useState } from 'react';
import { useDashboardStore } from '../stores/dashboardStore';
import {
  Badge,
  Button,
  ScrollArea,
  Tabs,
  TabsList,
  TabsTrigger,
} from '../components/ui';
import { cn } from '@/lib/utils';
import type { ReviewQueueItem, ReviewStatus } from '../types';

function ReviewList({
  reviews,
  selectedId,
  onSelect,
}: {
  reviews: ReviewQueueItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (reviews.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-muted)] text-center">
        <div className="text-5xl mb-4 opacity-50">👁</div>
        <div className="text-sm">No reviews in this category</div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4">
        {reviews.map((review) => (
          <div
            key={review.id}
            className={cn(
              'p-4 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg mb-3 cursor-pointer transition-all hover:border-[var(--color-accent)]',
              selectedId === review.id &&
                'border-[var(--color-accent)] shadow-[0_0_0_2px_rgba(88,166,255,0.2)]',
            )}
            onClick={() => onSelect(review.id)}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                {review.title}
              </span>
              <Badge
                variant={
                  review.status === 'pending'
                    ? 'warning'
                    : review.status === 'approved'
                      ? 'success'
                      : review.status === 'rejected'
                        ? 'error'
                        : 'purple'
                }
                size="sm"
              >
                {review.status}
              </Badge>
            </div>
            <div className="text-[11px] text-[var(--color-text-muted)] mb-2">
              Track: {review.trackId.slice(0, 8)}
            </div>
            <div className="text-xs text-[var(--color-text-secondary)] mb-3 line-clamp-2">
              {review.description}
            </div>
            <div className="flex items-center gap-3 text-[11px] text-[var(--color-text-muted)]">
              <span>{new Date(review.createdAt).toLocaleDateString()}</span>
              <div className="flex gap-2">
                <span className="text-[var(--color-success)]">
                  +{review.diffStats.additions}
                </span>
                <span className="text-[var(--color-error)]">
                  -{review.diffStats.deletions}
                </span>
                <span>{review.diffStats.filesChanged} files</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

function ReviewDetail({ review }: { review: ReviewQueueItem }) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
        <div className="text-sm font-semibold text-[var(--color-text-primary)]">
          {review.title}
        </div>
        {review.status === 'pending' && (
          <div className="flex gap-2">
            <Button variant="destructive" size="sm">
              Reject
            </Button>
            <Button size="sm">Approve</Button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-5">
        <div className="p-4 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg mb-5">
          <div className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-[0.5px] mb-2">
            Summary
          </div>
          <div className="text-[13px] text-[var(--color-text-primary)] leading-relaxed">
            {review.description}
          </div>
        </div>

        {review.comments.length > 0 && (
          <div className="mt-5">
            <div className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-[0.5px] mb-3">
              Comments
            </div>
            {review.comments.map((comment) => (
              <div
                key={comment.id}
                className="p-3 bg-[var(--color-bg-secondary)] rounded-md mb-2"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                    {comment.author}
                  </span>
                  <span className="text-[11px] text-[var(--color-text-muted)]">
                    {new Date(comment.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="text-[13px] text-[var(--color-text-secondary)]">
                  {comment.content}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ReviewQueueView() {
  const reviews = useDashboardStore((s) => s.reviews);
  const selectedReviewId = useDashboardStore((s) => s.selectedReviewId);
  const selectReview = useDashboardStore((s) => s.selectReview);
  const [activeTab, setActiveTab] = useState<ReviewStatus | 'all'>('pending');

  const filteredReviews =
    activeTab === 'all' ? reviews : reviews.filter((r) => r.status === activeTab);

  const selectedReview = reviews.find((r) => r.id === selectedReviewId);

  const pendingCount = reviews.filter((r) => r.status === 'pending').length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            Review Queue
          </h2>
          {pendingCount > 0 && (
            <Badge variant="purple" size="sm">
              {pendingCount} pending
            </Badge>
          )}
        </div>
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as ReviewStatus | 'all')}
        >
          <TabsList>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
            <TabsTrigger value="merged">Merged</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[340px] shrink-0 border-r border-[var(--color-border)]">
          <ReviewList
            reviews={filteredReviews}
            selectedId={selectedReviewId}
            onSelect={selectReview}
          />
        </div>
        {selectedReview ? (
          <ReviewDetail review={selectedReview} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-[var(--color-text-muted)] text-center">
            <div className="text-5xl mb-4 opacity-50">👁</div>
            <div className="text-sm">Select a review to view details</div>
          </div>
        )}
      </div>
    </div>
  );
}
