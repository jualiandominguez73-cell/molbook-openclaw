// Liminal — File Browser & Status Board

let fileTreeData = null;
let currentDetailPath = null;

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    loadFileTree();
    loadPrinciples();
});

// Load file tree from API
async function loadFileTree() {
    const treeContainer = document.getElementById('file-tree');
    treeContainer.innerHTML = '<div class="loading">Loading...</div>';
    
    try {
        const response = await fetch('/api/liminal/contents');
        const data = await response.json();
        
        if (!data.success) {
            treeContainer.innerHTML = `<div class="error">Error: ${data.error}</div>`;
            return;
        }
        
        fileTreeData = data.tree;
        renderFileTree(fileTreeData, treeContainer);
        updateStatusBoard(fileTreeData);
    } catch (err) {
        treeContainer.innerHTML = `<div class="error">Failed to load: ${err.message}</div>`;
        document.getElementById('connection-status').classList.add('disconnected');
    }
}

// Render file tree recursively
function renderFileTree(node, container, level = 0) {
    container.innerHTML = '';
    
    if (node.children && node.children.length > 0) {
        node.children.forEach(child => {
            const item = document.createElement('div');
            item.className = `tree-item ${child.type}`;
            
            const icon = child.type === 'directory' ? '📁' : getFileIcon(child.name);
            const size = child.type === 'file' && child.size !== undefined
                ? formatSize(child.size)
                : '';
            
            item.innerHTML = `
                <span class="tree-icon">${icon}</span>
                <span class="tree-label">${escapeHtml(child.name)}</span>
                <span class="tree-meta">${size}</span>
            `;
            
            item.onclick = () => {
                if (child.type === 'directory') {
                    toggleDirectory(item, child);
                } else {
                    openFile(child.path);
                }
            };
            
            container.appendChild(item);
            
            // Recursively render children for directories
            if (child.type === 'directory') {
                const childrenContainer = document.createElement('div');
                childrenContainer.className = 'tree-children';
                childrenContainer.style.display = 'none';
                childrenContainer.id = `tree-children-${child.path.replace(/\//g, '-')}`;
                container.appendChild(childrenContainer);
                
                // Pre-render but hide
                if (child.children) {
                    renderFileTree(child, childrenContainer, level + 1);
                }
            }
        });
    } else {
        container.innerHTML = '<div class="tree-item" style="color: #666; font-style: italic;">Empty folder</div>';
    }
}

// Toggle directory expand/collapse
function toggleDirectory(item, node) {
    const path = node.path;
    const childrenId = `tree-children-${path.replace(/\//g, '-')}`;
    const childrenContainer = document.getElementById(childrenId);
    
    if (childrenContainer) {
        const isExpanded = childrenContainer.style.display !== 'none';
        childrenContainer.style.display = isExpanded ? 'none' : 'block';
        item.querySelector('.tree-icon').textContent = isExpanded ? '📁' : '📂';
    }
    
    // Also show detail panel for this directory
    showProjectDetail(path);
}

// Open file or directory detail
async function openFile(path) {
    showProjectDetail(path);
}

// Show project detail panel
async function showProjectDetail(path) {
    const detailPanel = document.getElementById('project-detail');
    const detailTitle = document.getElementById('detail-title');
    const detailContent = document.getElementById('detail-content');
    
    detailPanel.style.display = 'block';
    detailTitle.textContent = path.split('/').pop() || 'liminal';
    detailContent.innerHTML = '<div class="loading">Loading...</div>';
    currentDetailPath = path;
    
    try {
        const response = await fetch(`/api/liminal/project?path=${encodeURIComponent(path)}`);
        const data = await response.json();
        
        if (!data.success) {
            detailContent.innerHTML = `<div class="error">Error: ${data.error}</div>`;
            return;
        }
        
        let html = '';
        
        // README content
        if (data.readme) {
            html += `<div class="readme-content">${markdownToHtml(data.readme)}</div>`;
        }
        
        // File list
        if (data.files && data.files.length > 0) {
            html += '<h3>Files</h3><div class="file-list">';
            data.files.forEach(file => {
                const icon = file.type === 'directory' ? '📁' : getFileIcon(file.name);
                const size = file.size !== undefined ? formatSize(file.size) : '';
                html += `
                    <div class="file-item" onclick="openFile('${escapeHtml(data.path + '/' + file.name)}')">
                        <div class="file-item-name">${icon} ${escapeHtml(file.name)}</div>
                        <div class="file-item-meta">${size} ${formatDate(file.modified)}</div>
                    </div>
                `;
            });
            html += '</div>';
        }
        
        // Single file content
        if (data.content) {
            html += `<h3>Content</h3>`;
            if (data.name.endsWith('.md')) {
                html += `<div class="readme-content">${markdownToHtml(data.content)}</div>`;
            } else {
                html += `<pre style="background: #0d0d0d; border: 1px solid #333; border-radius: 6px; padding: 16px; overflow-x: auto;"><code>${escapeHtml(data.content)}</code></pre>`;
            }
        }
        
        detailContent.innerHTML = html || '<p style="color: #666;">No additional details</p>';
    } catch (err) {
        detailContent.innerHTML = `<div class="error">Failed to load: ${err.message}</div>`;
    }
}

// Close detail panel
function closeDetail() {
    document.getElementById('project-detail').style.display = 'none';
    currentDetailPath = null;
}

// Update status board
function updateStatusBoard(tree) {
    let projectCount = 0;
    let experimentCount = 0;
    let sketchCount = 0;
    let totalFiles = 0;
    let recentFiles = [];
    
    function traverse(node, path = '') {
        if (!node.children) return;
        
        node.children.forEach(child => {
            const fullPath = path ? `${path}/${child.name}` : child.name;
            
            if (child.type === 'directory') {
                if (child.name === 'projects') projectCount = countFiles(child);
                if (child.name === 'experiments') experimentCount = countFiles(child);
                if (child.name === 'sketches') sketchCount = countFiles(child);
                traverse(child, fullPath);
            } else {
                totalFiles++;
                recentFiles.push({
                    name: child.name,
                    path: fullPath,
                    modified: child.modified
                });
            }
        });
    }
    
    function countFiles(node) {
        if (!node.children) return 0;
        let count = 0;
        node.children.forEach(child => {
            if (child.type === 'file') count++;
            else count += countFiles(child);
        });
        return count;
    }
    
    traverse(tree);
    
    // Update counters
    document.getElementById('project-count').textContent = projectCount;
    document.getElementById('experiment-count').textContent = experimentCount;
    document.getElementById('sketch-count').textContent = sketchCount;
    document.getElementById('total-files').textContent = totalFiles;
    
    // Update recent files (sorted by modified date)
    recentFiles.sort((a, b) => new Date(b.modified) - new Date(a.modified));
    const recentList = document.getElementById('recent-files');
    
    if (recentFiles.length === 0) {
        recentList.innerHTML = '<div style="color: #666; font-style: italic;">No files yet</div>';
    } else {
        recentList.innerHTML = recentFiles.slice(0, 10).map(file => `
            <div class="recent-item" onclick="openFile('${escapeHtml(file.path)}')" style="cursor: pointer;">
                <span class="recent-item-name">${escapeHtml(file.name)}</span>
                <span class="recent-item-time">${timeAgo(file.modified)}</span>
            </div>
        `).join('');
    }
}

// Load principles
async function loadPrinciples() {
    const principlesText = document.getElementById('principles-text');
    
    try {
        const response = await fetch('/api/liminal/principles');
        const data = await response.json();
        
        if (data.success) {
            principlesText.innerHTML = markdownToHtml(data.content);
        } else {
            principlesText.innerHTML = `<div class="error">Failed to load principles</div>`;
        }
    } catch (err) {
        principlesText.innerHTML = `<div class="error">${err.message}</div>`;
    }
}

// Toggle principles panel
function togglePrinciples() {
    const content = document.getElementById('principles-content');
    const btn = document.querySelector('.btn-toggle');
    
    if (content.style.display === 'none') {
        content.style.display = 'block';
        btn.textContent = '▲';
    } else {
        content.style.display = 'none';
        btn.textContent = '▼';
    }
}

// Utility functions
function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const icons = {
        'md': '📝',
        'py': '🐍',
        'js': '📜',
        'rs': '⚙️',
        'html': '🌐',
        'css': '🎨',
        'json': '📋',
        'txt': '📄',
        'jpg': '🖼️',
        'png': '🖼️',
        'gif': '🖼️',
        'mp3': '🎵',
        'mp4': '🎬'
    };
    return icons[ext] || '📄';
}

function formatSize(bytes) {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function formatDate(isoDate) {
    const date = new Date(isoDate);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function timeAgo(isoDate) {
    const date = new Date(isoDate);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Simple markdown to HTML converter
function markdownToHtml(markdown) {
    let html = markdown
        // Headers
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        // Bold and italic
        .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // Code blocks
        .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // Lists
        .replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>')
        .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
        // Paragraphs
        .replace(/\n\n/g, '</p><p>')
        // Line breaks
        .replace(/\n/g, '<br>');
    
    return `<p>${html}</p>`;
}
