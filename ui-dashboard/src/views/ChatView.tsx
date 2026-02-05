import { useCallback } from 'react';
import { ResizableLayout, Sidebar, TrackContextPanel } from '../components/layout';
import { MessageList, MessageInput } from '../components/features/chat';
import { Terminal } from '../components/features/terminal';
import { useDashboardStore } from '../stores/dashboardStore';
import { useGateway, useSendMessage } from '../hooks/useGateway';

export function ChatView() {
  // Use individual selectors to prevent unnecessary re-renders
  const messages = useDashboardStore((s) => s.messages);
  const tracks = useDashboardStore((s) => s.tracks);
  const workers = useDashboardStore((s) => s.workers);
  const reviews = useDashboardStore((s) => s.reviews);
  const selectedTrackId = useDashboardStore((s) => s.selectedTrackId);
  const selectTrack = useDashboardStore((s) => s.selectTrack);

  const { connected } = useGateway();
  const sendMessage = useSendMessage();

  const handleSend = useCallback(
    (content: string) => {
      sendMessage(content, selectedTrackId || undefined);
    },
    [sendMessage, selectedTrackId]
  );

  const filteredMessages = selectedTrackId
    ? messages.filter(
        (m) => m.trackId === selectedTrackId || m.sender === 'user' || m.sender === 'lead'
      )
    : messages;

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
          <MessageList messages={filteredMessages} />
          <MessageInput
            onSend={handleSend}
            disabled={!connected}
            placeholder={
              selectedTrackId
                ? `Message about track...`
                : 'Describe what you want to build...'
            }
          />
        </div>
      }
      context={<TrackContextPanel />}
      terminal={<Terminal />}
    />
  );
}
