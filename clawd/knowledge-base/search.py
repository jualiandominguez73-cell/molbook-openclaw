#!/usr/bin/env python3
"""
Knowledge Base Search and Visualization
Search notes and visualize connections between them.
"""

import os
import re
import json
from pathlib import Path
from collections import defaultdict
import networkx as nx
import matplotlib.pyplot as plt

# Install required packages if not available
try:
    import networkx
    import matplotlib
except ImportError:
    print("Installing required packages...")
    os.system("pip install networkx matplotlib")

class KnowledgeBase:
    def __init__(self, base_dir="~/clawd/knowledge-base"):
        self.base_dir = Path(base_dir).expanduser()
        self.notes_dir = self.base_dir / "notes"
        
    def get_all_notes(self):
        """Get all markdown notes in the knowledge base."""
        notes = []
        if self.notes_dir.exists():
            for file in self.notes_dir.glob("*.md"):
                notes.append(file.stem)
        return sorted(notes)
    
    def search_notes(self, query):
        """Search notes for a query."""
        results = []
        query_lower = query.lower()
        
        for note_file in self.notes_dir.glob("*.md"):
            content = note_file.read_text()
            content_lower = content.lower()
            
            if query_lower in content_lower:
                # Count occurrences
                count = content_lower.count(query_lower)
                
                # Get context (first 200 chars around each match)
                matches = []
                for match in re.finditer(re.escape(query), content, re.IGNORECASE):
                    start = max(0, match.start() - 100)
                    end = min(len(content), match.end() + 100)
                    context = content[start:end]
                    matches.append(context)
                
                results.append({
                    'note': note_file.stem,
                    'count': count,
                    'matches': matches[:3]  # Limit to 3 examples
                })
        
        return sorted(results, key=lambda x: x['count'], reverse=True)
    
    def extract_links(self, note_name):
        """Extract wikilinks from a note."""
        note_file = self.notes_dir / f"{note_name}.md"
        if not note_file.exists():
            return []
        
        content = note_file.read_text()
        # Find [[wikilinks]]
        links = re.findall(r'\[\[([^\]]+)\]\]', content)
        return [link.strip() for link in links]
    
    def build_connection_graph(self):
        """Build a graph of note connections."""
        graph = nx.Graph()
        notes = self.get_all_notes()
        
        for note in notes:
            links = self.extract_links(note)
            for link in links:
                if link in notes:  # Only include links to existing notes
                    graph.add_edge(note, link)
        
        return graph
    
    def visualize_connections(self, output_file="knowledge-graph.png"):
        """Visualize the knowledge base connections."""
        graph = self.build_connection_graph()
        
        if len(graph.nodes()) == 0:
            print("No connections to visualize.")
            return
        
        plt.figure(figsize=(12, 8))
        
        # Use spring layout for organic look
        pos = nx.spring_layout(graph, k=0.5, iterations=50)
        
        # Draw nodes and edges
        nx.draw_networkx_nodes(graph, pos, node_size=2000, node_color="#0088ff", alpha=0.8)
        nx.draw_networkx_edges(graph, pos, width=1.5, alpha=0.5, edge_color="#666666")
        nx.draw_networkx_labels(graph, pos, font_size=10, font_weight="bold")
        
        plt.title("Knowledge Base Connections", fontsize=16, fontweight="bold")
        plt.axis("off")
        plt.tight_layout()
        
        output_path = self.base_dir / "graphs" / output_file
        output_path.parent.mkdir(exist_ok=True)
        plt.savefig(output_path, dpi=300, bbox_inches="tight")
        plt.close()
        
        print(f"Graph saved to: {output_path}")
        return output_path
    
    def get_note_info(self, note_name):
        """Get information about a specific note."""
        note_file = self.notes_dir / f"{note_name}.md"
        if not note_file.exists():
            return None
        
        content = note_file.read_text()
        lines = content.split('\n')
        
        # Extract metadata
        info = {
            'name': note_name,
            'content': content,
            'tags': [],
            'links': self.extract_links(note_name),
            'word_count': len(content.split()),
            'line_count': len(lines)
        }
        
        # Extract tags
        for line in lines[:10]:  # Check first 10 lines for tags
            if line.startswith('**Tags**'):
                tags_line = line.split(':', 1)[1] if ':' in line else ''
                info['tags'] = [tag.strip() for tag in tags_line.split('#') if tag.strip()]
                break
        
        return info

def main():
    kb = KnowledgeBase()
    
    print("📚 Knowledge Base Manager")
    print(f"Base directory: {kb.base_dir}")
    print(f"Notes directory: {kb.notes_dir}")
    
    if not kb.notes_dir.exists():
        print("❌ Notes directory not found.")
        return
    
    notes = kb.get_all_notes()
    print(f"\n📝 Found {len(notes)} notes:")
    for i, note in enumerate(notes, 1):
        print(f"  {i}. {note}")
    
    # Search example
    print("\n🔍 Searching for 'content intelligence':")
    results = kb.search_notes("content intelligence")
    for result in results:
        print(f"  • {result['note']} ({result['count']} matches)")
    
    # Connection analysis
    print("\n🔗 Analyzing connections:")
    graph = kb.build_connection_graph()
    print(f"  • {len(graph.nodes())} notes with connections")
    print(f"  • {len(graph.edges())} connections found")
    
    # Visualize
    print("\n📊 Visualizing knowledge graph...")
    graph_file = kb.visualize_connections()
    print(f"  ✅ Graph saved to: {graph_file}")
    
    # Note info example
    if notes:
        print(f"\n📄 Example note info ({notes[0]}):")
        info = kb.get_note_info(notes[0])
        if info:
            print(f"  • Word count: {info['word_count']}")
            print(f"  • Line count: {info['line_count']}")
            print(f"  • Tags: {', '.join(info['tags'])}")
            print(f"  • Links to: {', '.join(info['links'])}")

if __name__ == "__main__":
    main()