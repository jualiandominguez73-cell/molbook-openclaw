import { useEffect, useRef } from 'react';
import { Avatar, AvatarFallback, Badge } from '../../ui';
import { cn } from '@/lib/utils';
import type { Message, TaskDefinition, Worker } from '../../../types';

interface MessageListProps {
  messages: Message[];
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function TaskCard({ task }: { task: TaskDefinition }) {
  return (
    <div className="mt-3 p-3 bg-bg-card border border-border rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <span>📋</span>
        <span className="text-[13px] font-semibold text-text-primary">{task.title}</span>
        <Badge
          variant={
            task.status === 'running'
              ? 'success'
              : task.status === 'pending'
              ? 'warning'
              : 'muted'
          }
          size="sm"
        >
          {task.status}
        </Badge>
      </div>
      {task.description && (
        <div className="text-xs text-text-secondary mb-2">{task.description}</div>
      )}
      <div className="flex gap-3 text-[11px] text-text-muted">
        <span>⚙ {task.workerType}</span>
        {task.queuePosition !== undefined && (
          <span>Queue #{task.queuePosition}</span>
        )}
      </div>
    </div>
  );
}

function WorkerCard({ worker }: { worker: Worker }) {
  return (
    <div className="mt-3 p-3 bg-bg-card border border-border rounded-lg flex items-center gap-3">
      <Avatar className="size-6">
        <AvatarFallback>{worker.name.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <div className="text-[13px] font-medium text-text-primary">{worker.name}</div>
        <div className="text-[11px] text-text-secondary">
          {worker.status === 'active'
            ? `Working on: ${worker.taskDescription || 'Task'}`
            : worker.status}
        </div>
      </div>
    </div>
  );
}

const senderColorMap: Record<string, string> = {
  user: 'text-purple',
  worker: 'text-success',
};

function MessageItem({ message }: { message: Message }) {

  const renderContent = () => {
    // Simple markdown-like rendering
    const lines = message.content.split('\n');
    return lines.map((line, i) => {
      // Headers
      if (line.startsWith('### ')) {
        return (
          <p key={i} className="text-sm font-semibold mt-3">
            {line.slice(4)}
          </p>
        );
      }
      // Bullet points
      if (line.startsWith('- ')) {
        return (
          <p key={i} className="pl-4 relative">
            <span className="absolute left-1">•</span>
            {line.slice(2)}
          </p>
        );
      }
      // Numbered lists
      if (/^\d+\. /.test(line)) {
        return (
          <p key={i} className="pl-4">
            {line}
          </p>
        );
      }
      // Code blocks
      if (line.startsWith('```')) {
        return null; // Handle code blocks separately
      }
      // Empty lines
      if (!line.trim()) {
        return <br key={i} />;
      }
      return <p key={i}>{line}</p>;
    });
  };

  const task = message.metadata?.task as TaskDefinition | undefined;
  const worker = message.metadata?.worker as Worker | undefined;

  const isLead = message.sender === 'lead';
  const senderClasses = isLead
    ? 'bg-gradient-to-br from-accent to-purple bg-clip-text text-transparent'
    : senderColorMap[message.sender] || 'text-text-primary';

  return (
    <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-center gap-2.5">
        <Avatar className="size-6">
            <AvatarFallback>{message.senderName.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
        <span className={cn('text-[13px] font-semibold', senderClasses)}>
          {message.senderName}
        </span>
        <span className="text-[11px] text-text-muted">{formatTime(message.timestamp)}</span>
      </div>
      <div className="pl-[38px] text-sm leading-relaxed text-text-primary whitespace-pre-wrap [&_p]:mb-2 [&_p:last-child]:mb-0">
        {renderContent()}
      </div>

      {/* Embedded cards based on metadata */}
      {task && <TaskCard task={task} />}
      {worker && <WorkerCard worker={worker} />}
    </div>
  );
}

export function MessageList({ messages }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
        <div className="flex flex-col items-center justify-center h-full text-text-muted text-center">
          <div className="text-5xl mb-4 opacity-50">💬</div>
          <div className="text-sm">No messages yet</div>
          <div className="text-xs mt-2 opacity-70">
            Start a conversation with the Lead Agent
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
      {messages.map((message) => (
        <MessageItem key={message.id} message={message} />
      ))}
    </div>
  );
}
