import { useState } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { Button, Badge } from '../../ui';
import { cn } from '@/lib/utils';
import type { WorktreeInfo } from '../../../types';

// Mock data for worktrees
const mockWorktrees: WorktreeInfo[] = [
  {
    id: 'wt1',
    taskId: 'task1',
    path: '/workspace/project/.worktrees/feature-auth',
    branch: 'feature/auth-system',
    baseBranch: 'main',
    createdAt: Date.now() - 3600000,
    lastUsedAt: Date.now() - 60000,
  },
  {
    id: 'wt2',
    taskId: 'task2',
    path: '/workspace/project/.worktrees/fix-login',
    branch: 'fix/login-validation',
    baseBranch: 'main',
    createdAt: Date.now() - 7200000,
    lastUsedAt: Date.now() - 300000,
  },
];

// Explicit original and modified content for the Monaco DiffEditor.
// These represent the file before and after the changes in the worktree.
const mockOriginalContent = `import { validateToken } from './token';

export async function login(credentials: Credentials) {
  const user = await validateCredentials(credentials);
  if (!user) {
    throw new Error('Invalid credentials');
  }

  const token = await generateToken(user);
  return { user, token };
}`;

const mockModifiedContent = `import { validateToken } from './token';
import { logger } from '../utils/logger';

export async function login(credentials: Credentials) {
  logger.info('Login attempt', { username: credentials.username });

  const user = await validateCredentials(credentials);
  if (!user) {
    logger.warn('Login failed', { username: credentials.username });
    throw new Error('Invalid credentials');
  }

  const token = await generateToken(user);
  logger.info('Login successful', { userId: user.id });
  return { user, token };
}`;

const mockDiffStats = { filesChanged: 1, additions: 45, deletions: 12 };
const mockDiffFilePath = 'src/auth/login.ts';

export function WorktreeView() {
  const [selectedWorktreeId, setSelectedWorktreeId] = useState<string | null>(null);
  const worktrees = mockWorktrees;

  const selectedWorktree = worktrees.find((w) => w.id === selectedWorktreeId);

  // Detect language from mock file path
  const language = mockDiffFilePath.endsWith('.ts') ? 'typescript' : 'javascript';

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Git Worktrees</h2>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">
            Cleanup All
          </Button>
          <Button variant="default" size="sm">
            + New Worktree
          </Button>
        </div>
      </div>

      {/* Content: sidebar + main area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-[280px] shrink-0 flex flex-col border-r border-[var(--color-border)] overflow-y-auto">
          {/* Active Worktrees section */}
          <div className="p-4">
            <div className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">
              Active Worktrees
            </div>
            <div className="flex flex-col gap-2">
              {worktrees.map((worktree) => (
                <div
                  key={worktree.id}
                  className={cn(
                    'p-3 border-b border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-bg-tertiary)] rounded-md transition-colors',
                    selectedWorktreeId === worktree.id && 'bg-[var(--color-bg-tertiary)] border-[var(--color-accent)]'
                  )}
                  onClick={() => setSelectedWorktreeId(worktree.id)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm">&#x2387;</span>
                    <span className="text-[13px] font-medium text-[var(--color-text-primary)] font-mono truncate">
                      {worktree.branch}
                    </span>
                  </div>
                  <div className="text-[11px] text-[var(--color-text-muted)] font-mono mb-2 truncate">
                    {worktree.path}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-[var(--color-text-secondary)]">
                    <Badge variant="muted" size="sm">
                      {worktree.baseBranch}
                    </Badge>
                    <span className="ml-auto">
                      {new Date(worktree.lastUsedAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Base Branches section */}
          <div className="p-4">
            <div className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">
              Base Branches
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2 px-3 py-2 text-[13px] text-[var(--color-accent)] bg-[var(--color-bg-tertiary)] rounded-md cursor-pointer">
                <span className="text-xs">&#x25CF;</span>
                <span className="flex-1 font-mono">main</span>
                <Badge variant="muted" size="sm">2 ahead</Badge>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 text-[13px] text-[var(--color-text-secondary)] rounded-md cursor-pointer hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors">
                <span className="text-xs">&#x25CB;</span>
                <span className="flex-1 font-mono">develop</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main area */}
        <div className="flex-1 flex flex-col">
          {selectedWorktree ? (
            <>
              {/* Stats bar */}
              <div className="flex items-center gap-3 px-4 py-2 text-[12px] border-b border-[var(--color-border)]">
                <span className="font-semibold text-[var(--color-text-primary)]">
                  {selectedWorktree.branch} vs {selectedWorktree.baseBranch}
                </span>
                <span className="ml-auto text-[var(--color-text-secondary)]">
                  {mockDiffStats.filesChanged} file{mockDiffStats.filesChanged !== 1 ? 's' : ''}
                </span>
                <span className="text-[var(--color-success)]">+{mockDiffStats.additions}</span>
                <span className="text-[var(--color-error)]">-{mockDiffStats.deletions}</span>
                <Badge variant="outline" size="sm" className="ml-2 font-mono">
                  {mockDiffFilePath}
                </Badge>
              </div>

              {/* Monaco DiffEditor */}
              <div className="flex-1">
                <DiffEditor
                  height="100%"
                  language={language}
                  original={mockOriginalContent}
                  modified={mockModifiedContent}
                  theme="vs-dark"
                  options={{
                    readOnly: true,
                    renderSideBySide: true,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    fontSize: 13,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-muted)] text-center">
              <div className="text-5xl mb-4 opacity-50">&#x2387;</div>
              <div>Select a worktree to view changes</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
