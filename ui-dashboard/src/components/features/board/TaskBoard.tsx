import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  useDroppable,
  useDraggable,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useDashboardStore } from '../../../stores/dashboardStore';
import { Badge } from '../../ui';
import { cn } from '@/lib/utils';
import type { TaskDefinition, TaskStatus } from '../../../types';

const COLUMNS: { id: TaskStatus; title: string; icon: string }[] = [
  { id: 'pending', title: 'Pending', icon: '\u25CB' },
  { id: 'queued', title: 'Queued', icon: '\u25F7' },
  { id: 'running', title: 'Running', icon: '\u25D0' },
  { id: 'review', title: 'Review', icon: '\uD83D\uDC41' },
  { id: 'complete', title: 'Complete', icon: '\u2713' },
  { id: 'failed', title: 'Failed', icon: '\u2717' },
];

// --- Draggable Task Card ---

interface DraggableTaskCardProps {
  task: TaskDefinition;
  selected: boolean;
  onClick: () => void;
}

function DraggableTaskCard({ task, selected, onClick }: DraggableTaskCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });

  return (
    <div ref={setNodeRef} {...listeners} {...attributes}>
      <TaskCardContent
        task={task}
        selected={selected}
        onClick={onClick}
        isDragging={isDragging}
      />
    </div>
  );
}

// --- Task Card Content (shared between draggable and overlay) ---

interface TaskCardContentProps {
  task: TaskDefinition;
  selected: boolean;
  onClick: () => void;
  isDragging?: boolean;
  isOverlay?: boolean;
}

function TaskCardContent({
  task,
  selected,
  onClick,
  isDragging = false,
  isOverlay = false,
}: TaskCardContentProps) {
  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  const getDuration = () => {
    if (!task.startedAt) return null;
    const end = task.completedAt || Date.now();
    return formatDuration(end - task.startedAt);
  };

  return (
    <div
      className={cn(
        'bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-md p-3 cursor-pointer hover:border-[var(--color-border-hover)] transition-colors',
        selected && 'border-[var(--color-accent)] shadow-[0_0_0_2px_rgba(88,166,255,0.2)]',
        isDragging && 'opacity-50',
        isOverlay && 'shadow-lg rotate-[2deg]',
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-2 mb-2">
        <span className="text-[11px] text-[var(--color-text-muted)] font-mono">
          #{task.id.slice(0, 6)}
        </span>
      </div>
      <div className="flex-1 text-[13px] font-medium text-[var(--color-text-primary)] leading-[1.4]">
        {task.title}
      </div>
      {task.description && (
        <div className="text-[12px] text-[var(--color-text-secondary)] mb-3 line-clamp-2">
          {task.description}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] text-[var(--color-text-muted)]">
          <span className="flex items-center gap-1">
            \u2699 {task.workerType.replace('worker-', '')}
          </span>
          {getDuration() && <span>\u25F7 {getDuration()}</span>}
        </div>
        <div className="flex gap-1">
          {task.requiresReview && (
            <Badge variant="purple" size="sm">
              review
            </Badge>
          )}
          {task.maxRetries > 0 && <Badge size="sm">R{task.maxRetries}</Badge>}
        </div>
      </div>
    </div>
  );
}

// --- Droppable Column ---

interface TaskColumnProps {
  columnId: TaskStatus;
  title: string;
  icon: string;
  tasks: TaskDefinition[];
  selectedTaskId: string | null;
  onTaskSelect: (id: string) => void;
}

function TaskColumn({
  columnId,
  title,
  icon,
  tasks,
  selectedTaskId,
  onTaskSelect,
}: TaskColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: columnId,
    data: { columnId },
  });

  return (
    <div
      className={cn(
        'w-[280px] shrink-0 flex flex-col bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)] overflow-hidden',
        isOver && 'bg-[rgba(88,166,255,0.1)]',
      )}
    >
      <div className="px-3 py-2 text-[12px] font-semibold uppercase text-[var(--color-text-muted)] flex items-center justify-between bg-[var(--color-bg-tertiary)] border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--color-text-primary)] normal-case">
          <span>{icon}</span>
          <span>{title}</span>
        </div>
        <span className="px-2 py-0.5 text-[11px] font-semibold text-[var(--color-text-secondary)] bg-[var(--color-bg-secondary)] rounded-[10px]">
          {tasks.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className="flex-1 p-3 overflow-y-auto flex flex-col gap-2"
      >
        {tasks.length === 0 ? (
          <div className="py-6 text-center text-[12px] text-[var(--color-text-muted)]">
            No tasks
          </div>
        ) : (
          tasks.map((task) => (
            <DraggableTaskCard
              key={task.id}
              task={task}
              selected={selectedTaskId === task.id}
              onClick={() => onTaskSelect(task.id)}
            />
          ))
        )}
        <button className="w-full py-2 text-[12px] text-[var(--color-text-secondary)] bg-transparent border border-dashed border-[var(--color-border)] rounded-md cursor-pointer transition-colors hover:text-[var(--color-accent)] hover:border-[var(--color-accent)] hover:bg-[rgba(88,166,255,0.1)]">
          + Add task
        </button>
      </div>
    </div>
  );
}

// --- Main TaskBoard ---

export function TaskBoard() {
  const tasks = useDashboardStore((s) => s.tasks);
  const selectedTaskId = useDashboardStore((s) => s.selectedTaskId);
  const selectTask = useDashboardStore((s) => s.selectTask);
  const updateTask = useDashboardStore((s) => s.updateTask);
  const tracks = useDashboardStore((s) => s.tracks);
  const [filterTrackId, setFilterTrackId] = useState<string | 'all'>('all');
  const [activeTask, setActiveTask] = useState<TaskDefinition | null>(null);

  // Require a small drag distance before activating (prevents click conflicts)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  const filteredTasks =
    filterTrackId === 'all'
      ? tasks
      : tasks.filter((t) => t.trackId === filterTrackId);

  const tasksByColumn = COLUMNS.map((col) => ({
    ...col,
    tasks: filteredTasks.filter((t) => t.status === col.id),
  }));

  const handleDragStart = (event: DragStartEvent) => {
    const task = event.active.data.current?.task as TaskDefinition | undefined;
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);

    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const newStatus = over.id as TaskStatus;

    // Find the dragged task and check if the status actually changed
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    // Update the task status in the store
    updateTask(taskId, { status: newStatus });
  };

  const handleDragCancel = () => {
    setActiveTask(null);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
        <h2 className="text-[16px] font-semibold text-[var(--color-text-primary)]">
          Task Board
        </h2>
        <div className="flex gap-3">
          <select
            value={filterTrackId}
            onChange={(e) => setFilterTrackId(e.target.value)}
            className="px-3 py-1.5 text-[13px] text-[var(--color-text-primary)] bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-md cursor-pointer outline-none focus:border-[var(--color-accent)]"
          >
            <option value="all">All Tracks</option>
            {tracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex gap-4 p-4 overflow-x-auto h-full">
          {tasksByColumn.map((column) => (
            <TaskColumn
              key={column.id}
              columnId={column.id}
              title={column.title}
              icon={column.icon}
              tasks={column.tasks}
              selectedTaskId={selectedTaskId}
              onTaskSelect={selectTask}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTask ? (
            <TaskCardContent
              task={activeTask}
              selected={false}
              onClick={() => {}}
              isOverlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
