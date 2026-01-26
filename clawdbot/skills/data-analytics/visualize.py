#!/usr/bin/env python3
"""
Data Analytics - Visualization Script
Generate charts and graphs from data files.
"""

import argparse
import sys
from pathlib import Path

import pandas as pd
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend for server use

# Try to import plotly for interactive charts
try:
    import plotly.express as px
    import plotly.graph_objects as go
    HAS_PLOTLY = True
except ImportError:
    HAS_PLOTLY = False


def load_data(filepath: str) -> pd.DataFrame:
    """Load data from various file formats."""
    path = Path(filepath)
    suffix = path.suffix.lower()
    
    if suffix == '.csv':
        return pd.read_csv(filepath)
    elif suffix == '.json':
        return pd.read_json(filepath)
    elif suffix in ['.xlsx', '.xls']:
        return pd.read_excel(filepath)
    elif suffix == '.parquet':
        return pd.read_parquet(filepath)
    else:
        raise ValueError(f"Unsupported file format: {suffix}")


def save_chart(fig, output: str, title: str = None):
    """Save matplotlib figure to file."""
    if title:
        plt.title(title)
    plt.tight_layout()
    fig.savefig(output, dpi=150, bbox_inches='tight')
    plt.close(fig)
    print(f"Chart saved to {output}")


def cmd_bar(args):
    """Create bar chart."""
    df = load_data(args.file)
    
    if args.x not in df.columns or args.y not in df.columns:
        print(f"Error: Column not found. Available: {', '.join(df.columns)}")
        sys.exit(1)
    
    fig, ax = plt.subplots(figsize=(10, 6))
    
    if args.horizontal:
        ax.barh(df[args.x], df[args.y], color=args.color or 'steelblue')
        ax.set_xlabel(args.y)
        ax.set_ylabel(args.x)
    else:
        ax.bar(df[args.x], df[args.y], color=args.color or 'steelblue')
        ax.set_xlabel(args.x)
        ax.set_ylabel(args.y)
    
    plt.xticks(rotation=45, ha='right')
    save_chart(fig, args.output, args.title)


def cmd_line(args):
    """Create line chart."""
    df = load_data(args.file)
    
    if args.x not in df.columns:
        print(f"Error: Column '{args.x}' not found. Available: {', '.join(df.columns)}")
        sys.exit(1)
    
    fig, ax = plt.subplots(figsize=(10, 6))
    
    # Support multiple y columns
    y_cols = args.y.split(',')
    for y_col in y_cols:
        y_col = y_col.strip()
        if y_col not in df.columns:
            print(f"Warning: Column '{y_col}' not found, skipping")
            continue
        ax.plot(df[args.x], df[y_col], marker='o' if args.markers else None, label=y_col)
    
    ax.set_xlabel(args.x)
    ax.set_ylabel(args.y)
    if len(y_cols) > 1:
        ax.legend()
    
    plt.xticks(rotation=45, ha='right')
    save_chart(fig, args.output, args.title)


def cmd_scatter(args):
    """Create scatter plot."""
    df = load_data(args.file)
    
    if args.x not in df.columns or args.y not in df.columns:
        print(f"Error: Column not found. Available: {', '.join(df.columns)}")
        sys.exit(1)
    
    fig, ax = plt.subplots(figsize=(10, 6))
    
    # Color by category if specified
    if args.color_by and args.color_by in df.columns:
        for category in df[args.color_by].unique():
            subset = df[df[args.color_by] == category]
            ax.scatter(subset[args.x], subset[args.y], label=category, alpha=0.7)
        ax.legend()
    else:
        ax.scatter(df[args.x], df[args.y], alpha=0.7, color=args.color or 'steelblue')
    
    # Add regression line if requested
    if args.regression:
        import numpy as np
        z = np.polyfit(df[args.x], df[args.y], 1)
        p = np.poly1d(z)
        ax.plot(df[args.x], p(df[args.x]), "r--", alpha=0.8, label='Trend')
    
    ax.set_xlabel(args.x)
    ax.set_ylabel(args.y)
    save_chart(fig, args.output, args.title)


def cmd_heatmap(args):
    """Create correlation heatmap."""
    df = load_data(args.file)
    
    # Select numeric columns only
    numeric_df = df.select_dtypes(include=['number'])
    
    if len(numeric_df.columns) < 2:
        print("Error: Need at least 2 numeric columns for heatmap")
        sys.exit(1)
    
    corr = numeric_df.corr()
    
    fig, ax = plt.subplots(figsize=(10, 8))
    im = ax.imshow(corr, cmap='coolwarm', aspect='auto', vmin=-1, vmax=1)
    
    # Add labels
    ax.set_xticks(range(len(corr.columns)))
    ax.set_yticks(range(len(corr.columns)))
    ax.set_xticklabels(corr.columns, rotation=45, ha='right')
    ax.set_yticklabels(corr.columns)
    
    # Add colorbar
    plt.colorbar(im)
    
    # Add correlation values
    if args.annotate:
        for i in range(len(corr)):
            for j in range(len(corr)):
                text = ax.text(j, i, f'{corr.iloc[i, j]:.2f}',
                             ha='center', va='center', fontsize=8)
    
    save_chart(fig, args.output, args.title or 'Correlation Matrix')


def cmd_histogram(args):
    """Create histogram."""
    df = load_data(args.file)
    
    if args.column not in df.columns:
        print(f"Error: Column '{args.column}' not found. Available: {', '.join(df.columns)}")
        sys.exit(1)
    
    fig, ax = plt.subplots(figsize=(10, 6))
    
    ax.hist(df[args.column].dropna(), bins=args.bins or 30, 
            color=args.color or 'steelblue', edgecolor='white', alpha=0.7)
    
    ax.set_xlabel(args.column)
    ax.set_ylabel('Frequency')
    save_chart(fig, args.output, args.title or f'Distribution of {args.column}')


def cmd_pie(args):
    """Create pie chart."""
    df = load_data(args.file)
    
    if args.labels not in df.columns or args.values not in df.columns:
        print(f"Error: Column not found. Available: {', '.join(df.columns)}")
        sys.exit(1)
    
    fig, ax = plt.subplots(figsize=(10, 8))
    
    ax.pie(df[args.values], labels=df[args.labels], autopct='%1.1f%%', 
           startangle=90, colors=plt.cm.Pastel1.colors)
    ax.axis('equal')
    
    save_chart(fig, args.output, args.title)


def cmd_box(args):
    """Create box plot."""
    df = load_data(args.file)
    
    columns = args.columns.split(',')
    columns = [c.strip() for c in columns if c.strip() in df.columns]
    
    if not columns:
        print(f"Error: No valid columns found. Available: {', '.join(df.columns)}")
        sys.exit(1)
    
    fig, ax = plt.subplots(figsize=(10, 6))
    
    df[columns].boxplot(ax=ax)
    ax.set_ylabel('Value')
    
    save_chart(fig, args.output, args.title or 'Box Plot')


def main():
    parser = argparse.ArgumentParser(
        description='Data Analytics - Visualization Tool',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    subparsers = parser.add_subparsers(dest='command', help='Chart types')
    
    # bar command
    bar_parser = subparsers.add_parser('bar', help='Bar chart')
    bar_parser.add_argument('file', help='Data file')
    bar_parser.add_argument('--x', required=True, help='X-axis column')
    bar_parser.add_argument('--y', required=True, help='Y-axis column')
    bar_parser.add_argument('--output', '-o', required=True, help='Output file')
    bar_parser.add_argument('--title', '-t', help='Chart title')
    bar_parser.add_argument('--horizontal', action='store_true', help='Horizontal bars')
    bar_parser.add_argument('--color', help='Bar color')
    
    # line command
    line_parser = subparsers.add_parser('line', help='Line chart')
    line_parser.add_argument('file', help='Data file')
    line_parser.add_argument('--x', required=True, help='X-axis column')
    line_parser.add_argument('--y', required=True, help='Y-axis column(s), comma-separated')
    line_parser.add_argument('--output', '-o', required=True, help='Output file')
    line_parser.add_argument('--title', '-t', help='Chart title')
    line_parser.add_argument('--markers', action='store_true', help='Show markers')
    
    # scatter command
    scatter_parser = subparsers.add_parser('scatter', help='Scatter plot')
    scatter_parser.add_argument('file', help='Data file')
    scatter_parser.add_argument('--x', required=True, help='X-axis column')
    scatter_parser.add_argument('--y', required=True, help='Y-axis column')
    scatter_parser.add_argument('--output', '-o', required=True, help='Output file')
    scatter_parser.add_argument('--title', '-t', help='Chart title')
    scatter_parser.add_argument('--color-by', help='Color by category column')
    scatter_parser.add_argument('--color', help='Point color')
    scatter_parser.add_argument('--regression', action='store_true', help='Add regression line')
    
    # heatmap command
    heatmap_parser = subparsers.add_parser('heatmap', help='Correlation heatmap')
    heatmap_parser.add_argument('file', help='Data file')
    heatmap_parser.add_argument('--output', '-o', required=True, help='Output file')
    heatmap_parser.add_argument('--title', '-t', help='Chart title')
    heatmap_parser.add_argument('--annotate', action='store_true', help='Show correlation values')
    
    # histogram command
    hist_parser = subparsers.add_parser('histogram', help='Histogram')
    hist_parser.add_argument('file', help='Data file')
    hist_parser.add_argument('--column', '-c', required=True, help='Column to plot')
    hist_parser.add_argument('--output', '-o', required=True, help='Output file')
    hist_parser.add_argument('--title', '-t', help='Chart title')
    hist_parser.add_argument('--bins', type=int, help='Number of bins')
    hist_parser.add_argument('--color', help='Bar color')
    
    # pie command
    pie_parser = subparsers.add_parser('pie', help='Pie chart')
    pie_parser.add_argument('file', help='Data file')
    pie_parser.add_argument('--labels', required=True, help='Labels column')
    pie_parser.add_argument('--values', required=True, help='Values column')
    pie_parser.add_argument('--output', '-o', required=True, help='Output file')
    pie_parser.add_argument('--title', '-t', help='Chart title')
    
    # box command
    box_parser = subparsers.add_parser('box', help='Box plot')
    box_parser.add_argument('file', help='Data file')
    box_parser.add_argument('--columns', '-c', required=True, help='Columns to plot (comma-separated)')
    box_parser.add_argument('--output', '-o', required=True, help='Output file')
    box_parser.add_argument('--title', '-t', help='Chart title')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    commands = {
        'bar': cmd_bar,
        'line': cmd_line,
        'scatter': cmd_scatter,
        'heatmap': cmd_heatmap,
        'histogram': cmd_histogram,
        'pie': cmd_pie,
        'box': cmd_box,
    }
    
    commands[args.command](args)


if __name__ == '__main__':
    main()
