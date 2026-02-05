import { useState, useCallback } from 'react';
import { Tree } from 'react-arborist';
import Editor from '@monaco-editor/react';
import { ResizableLayout } from '../components/layout';
import { ContextPanel, ContextSection, ContextRow } from '../components/layout';
import { cn } from '@/lib/utils';
import type { NodeRendererProps } from 'react-arborist';

// --- Mock data ---

interface FileTreeNode {
  id: string;
  name: string;
  children: FileTreeNode[] | null;
}

const mockFileTree: FileTreeNode[] = [
  {
    id: '1', name: 'src', children: [
      { id: '2', name: 'App.tsx', children: null },
      { id: '3', name: 'main.tsx', children: null },
      { id: '4', name: 'components', children: [
        { id: '5', name: 'Header.tsx', children: null },
        { id: '6', name: 'Sidebar.tsx', children: null },
      ]},
      { id: '7', name: 'stores', children: [
        { id: '8', name: 'dashboardStore.ts', children: null },
      ]},
    ]
  },
  { id: '9', name: 'package.json', children: null },
  { id: '10', name: 'tsconfig.json', children: null },
];

const mockFileContents: Record<string, string> = {
  '2': `import { useState } from 'react';
import { Header, Sidebar, ResizableLayout } from './components/layout';
import { ChatView, BoardView, FilesView } from './views';
import './App.css';

function App() {
  const [view, setView] = useState<string>('chat');

  return (
    <div className="app">
      <Header />
      <main className="app-main">
        {view === 'chat' && <ChatView />}
        {view === 'board' && <BoardView />}
        {view === 'files' && <FilesView />}
      </main>
    </div>
  );
}

export default App;
`,
  '3': `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
`,
  '9': `{
  "name": "openclaw-dashboard",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  }
}
`,
  '10': `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["src"]
}
`,
  '5': `interface HeaderProps {
  title?: string;
}

export function Header({ title = 'OpenClaw' }: HeaderProps) {
  return (
    <header className="header">
      <h1>{title}</h1>
    </header>
  );
}
`,
  '6': `interface SidebarProps {
  items: string[];
  selected?: string;
  onSelect: (item: string) => void;
}

export function Sidebar({ items, selected, onSelect }: SidebarProps) {
  return (
    <nav className="sidebar">
      {items.map((item) => (
        <button
          key={item}
          className={item === selected ? 'active' : ''}
          onClick={() => onSelect(item)}
        >
          {item}
        </button>
      ))}
    </nav>
  );
}
`,
  '8': `import { create } from 'zustand';

interface DashboardState {
  tracks: Track[];
  workers: Worker[];
  selectedTrackId: string | null;
  selectTrack: (id: string) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  tracks: [],
  workers: [],
  selectedTrackId: null,
  selectTrack: (id) => set({ selectedTrackId: id }),
}));
`,
};

// --- Helpers ---

/** Map file extensions to Monaco language identifiers */
function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'tsx': return 'typescript';
    case 'ts': return 'typescript';
    case 'jsx': return 'javascript';
    case 'js': return 'javascript';
    case 'json': return 'json';
    case 'css': return 'css';
    case 'html': return 'html';
    case 'md': return 'markdown';
    case 'yaml':
    case 'yml': return 'yaml';
    case 'sh': return 'shell';
    case 'py': return 'python';
    case 'rs': return 'rust';
    case 'go': return 'go';
    default: return 'plaintext';
  }
}

/** Build the full path from root to a given node id */
function getFilePath(id: string, tree: FileTreeNode[]): string {
  const parts: string[] = [];
  function walk(nodes: FileTreeNode[], path: string[]): boolean {
    for (const node of nodes) {
      if (node.id === id) {
        parts.push(...path, node.name);
        return true;
      }
      if (node.children && walk(node.children, [...path, node.name])) {
        return true;
      }
    }
    return false;
  }
  walk(tree, []);
  return parts.join('/');
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// --- File tree node renderer ---

function FileNode({ node, style, dragHandle }: NodeRendererProps<FileTreeNode>) {
  const isFolder = node.isInternal;

  return (
    <div
      ref={dragHandle}
      style={style}
      className={cn(
        'flex items-center gap-1 px-2 py-1 text-[13px] text-[var(--color-text-secondary)] cursor-pointer hover:bg-[var(--color-bg-tertiary)] rounded-sm',
        node.isSelected && 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]',
      )}
      onClick={() => node.isInternal ? node.toggle() : node.select()}
    >
      <span className="flex-shrink-0 text-sm leading-none">
        {isFolder ? (node.isOpen ? '\u{1F4C2}' : '\u{1F4C1}') : '\u{1F4C4}'}
      </span>
      <span className="truncate">{node.data.name}</span>
    </div>
  );
}

// --- Main view ---

export function FilesView() {
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  const selectedFileName = selectedFileId
    ? getNodeName(selectedFileId, mockFileTree)
    : null;
  const selectedContent = selectedFileId ? (mockFileContents[selectedFileId] ?? null) : null;
  const selectedPath = selectedFileId ? getFilePath(selectedFileId, mockFileTree) : null;
  const isFolder = selectedFileId ? isNodeFolder(selectedFileId, mockFileTree) : false;

  const handleActivate = useCallback((node: { id: string; isLeaf: boolean }) => {
    if (node.isLeaf) {
      setSelectedFileId(node.id);
    }
  }, []);

  return (
    <ResizableLayout
      defaultSidebarSize={20}
      defaultContextSize={20}
      sidebar={
        <div className="h-full flex flex-col overflow-hidden">
          <div className="flex items-center px-4 py-3 border-b border-[var(--color-border)]">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Explorer
            </span>
          </div>
          <div className="flex-1 overflow-auto py-1">
            <Tree<FileTreeNode>
              data={mockFileTree}
              openByDefault
              width="100%"
              height={600}
              indent={16}
              rowHeight={28}
              disableDrag
              disableDrop
              disableEdit
              onActivate={handleActivate}
            >
              {FileNode}
            </Tree>
          </div>
        </div>
      }
      main={
        <div className="h-full flex flex-col overflow-hidden bg-[var(--color-bg-primary)]">
          {/* Tab bar */}
          <div className="flex items-center h-9 px-3 gap-1 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
            {selectedFileName ? (
              <div className="flex items-center gap-1.5 px-2 py-1 text-[12px] text-[var(--color-text-primary)] bg-[var(--color-bg-primary)] rounded-t-sm border border-b-0 border-[var(--color-border)]">
                <span className="text-xs">{'\u{1F4C4}'}</span>
                <span>{selectedFileName}</span>
              </div>
            ) : (
              <span className="text-[12px] text-[var(--color-text-muted)]">No file open</span>
            )}
          </div>
          {/* Editor area */}
          <div className="flex-1 min-h-0">
            {selectedContent != null ? (
              <Editor
                height="100%"
                language={detectLanguage(selectedFileName ?? '')}
                value={selectedContent}
                theme="vs-dark"
                options={{
                  readOnly: true,
                  minimap: { enabled: true },
                  fontSize: 13,
                  fontFamily: "'JetBrains Mono', monospace",
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-muted)]">
                <div className="text-5xl mb-4 opacity-30">{'\u{1F4C1}'}</div>
                <div className="text-sm">Select a file to view its contents</div>
                <div className="text-xs mt-2 opacity-60">Browse the file tree on the left</div>
              </div>
            )}
          </div>
        </div>
      }
      context={
        <ContextPanel>
          {selectedFileId && selectedFileName && !isFolder ? (
            <>
              <ContextSection title="File Info">
                <ContextRow label="Name" value={selectedFileName} />
                <ContextRow label="Path" value={selectedPath ?? ''} />
                <ContextRow label="Language" value={detectLanguage(selectedFileName)} />
                <ContextRow
                  label="Size"
                  value={formatBytes(
                    new TextEncoder().encode(selectedContent ?? '').byteLength
                  )}
                />
                <ContextRow
                  label="Lines"
                  value={(selectedContent ?? '').split('\n').length}
                />
              </ContextSection>
              <ContextSection title="Git Status">
                <ContextRow label="Status" value={
                  <span className="text-[var(--color-success)] text-xs font-medium">Modified</span>
                } />
                <ContextRow label="Last commit" value="3h ago" />
                <ContextRow label="Author" value="developer" />
              </ContextSection>
            </>
          ) : (
            <div className="p-4 text-center text-[13px] text-[var(--color-text-muted)]">
              Select a file to view details
            </div>
          )}
        </ContextPanel>
      }
    />
  );
}

// --- Tree traversal helpers ---

function getNodeName(id: string, tree: FileTreeNode[]): string | null {
  for (const node of tree) {
    if (node.id === id) return node.name;
    if (node.children) {
      const found = getNodeName(id, node.children);
      if (found) return found;
    }
  }
  return null;
}

function isNodeFolder(id: string, tree: FileTreeNode[]): boolean {
  for (const node of tree) {
    if (node.id === id) return node.children != null;
    if (node.children) {
      const found = isNodeFolder(id, node.children);
      if (found) return true;
    }
  }
  return false;
}
