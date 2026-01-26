#!/usr/bin/env python3
"""
Data Analytics - Analysis Script
Provides data profiling, groupby, pivot tables, and statistical analysis.
"""

import argparse
import json
import sys
from pathlib import Path

import pandas as pd
import numpy as np


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


def cmd_load(args):
    """Load and display first rows of data."""
    df = load_data(args.file)
    print(f"Loaded {len(df)} rows, {len(df.columns)} columns")
    print(f"\nColumns: {', '.join(df.columns)}")
    print(f"\nFirst {args.rows} rows:")
    print(df.head(args.rows).to_string())


def cmd_describe(args):
    """Show descriptive statistics."""
    df = load_data(args.file)
    print("=== Data Shape ===")
    print(f"Rows: {len(df)}, Columns: {len(df.columns)}")
    print(f"\n=== Column Types ===")
    print(df.dtypes.to_string())
    print(f"\n=== Statistics ===")
    print(df.describe(include='all').to_string())


def cmd_groupby(args):
    """Perform groupby aggregation."""
    df = load_data(args.file)
    
    if args.by not in df.columns:
        print(f"Error: Column '{args.by}' not found. Available: {', '.join(df.columns)}")
        sys.exit(1)
    
    # Determine aggregation
    agg_func = args.agg if args.agg else 'count'
    
    if args.value:
        if args.value not in df.columns:
            print(f"Error: Column '{args.value}' not found.")
            sys.exit(1)
        result = df.groupby(args.by)[args.value].agg(agg_func)
    else:
        result = df.groupby(args.by).agg(agg_func)
    
    print(f"=== Groupby {args.by} ({agg_func}) ===")
    print(result.to_string())
    
    if args.output:
        result.to_csv(args.output)
        print(f"\nSaved to {args.output}")


def cmd_pivot(args):
    """Create pivot table."""
    df = load_data(args.file)
    
    for col in [args.index, args.columns, args.values]:
        if col and col not in df.columns:
            print(f"Error: Column '{col}' not found. Available: {', '.join(df.columns)}")
            sys.exit(1)
    
    pivot = pd.pivot_table(
        df,
        index=args.index,
        columns=args.columns,
        values=args.values,
        aggfunc=args.agg if args.agg else 'mean'
    )
    
    print("=== Pivot Table ===")
    print(pivot.to_string())
    
    if args.output:
        pivot.to_csv(args.output)
        print(f"\nSaved to {args.output}")


def cmd_profile(args):
    """Generate quick data profile."""
    df = load_data(args.file)
    
    print("=" * 60)
    print("DATA PROFILE")
    print("=" * 60)
    
    print(f"\n📊 Shape: {len(df)} rows × {len(df.columns)} columns")
    print(f"📁 File: {args.file}")
    
    print(f"\n=== Column Summary ===")
    for col in df.columns:
        dtype = df[col].dtype
        null_count = df[col].isnull().sum()
        null_pct = (null_count / len(df)) * 100
        unique = df[col].nunique()
        
        print(f"\n{col}:")
        print(f"  Type: {dtype}")
        print(f"  Unique: {unique}")
        print(f"  Missing: {null_count} ({null_pct:.1f}%)")
        
        if pd.api.types.is_numeric_dtype(df[col]):
            print(f"  Min: {df[col].min()}")
            print(f"  Max: {df[col].max()}")
            print(f"  Mean: {df[col].mean():.2f}")
        else:
            # Show top values for non-numeric
            top = df[col].value_counts().head(3)
            if len(top) > 0:
                print(f"  Top values: {dict(top)}")
    
    # Correlations for numeric columns
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    if len(numeric_cols) > 1:
        print(f"\n=== Correlations ===")
        corr = df[numeric_cols].corr()
        print(corr.to_string())


def cmd_filter(args):
    """Filter data by condition."""
    df = load_data(args.file)
    
    # Parse filter expression (simple column == value for now)
    try:
        result = df.query(args.condition)
        print(f"Filtered: {len(result)} rows (from {len(df)})")
        print(result.to_string())
        
        if args.output:
            result.to_csv(args.output, index=False)
            print(f"\nSaved to {args.output}")
    except Exception as e:
        print(f"Error in filter condition: {e}")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description='Data Analytics - Analysis Tool',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    subparsers = parser.add_subparsers(dest='command', help='Commands')
    
    # load command
    load_parser = subparsers.add_parser('load', help='Load and display data')
    load_parser.add_argument('file', help='Data file path')
    load_parser.add_argument('--rows', type=int, default=10, help='Number of rows to show')
    
    # describe command
    desc_parser = subparsers.add_parser('describe', help='Show descriptive statistics')
    desc_parser.add_argument('file', help='Data file path')
    
    # groupby command
    group_parser = subparsers.add_parser('groupby', help='Groupby aggregation')
    group_parser.add_argument('file', help='Data file path')
    group_parser.add_argument('--by', required=True, help='Column to group by')
    group_parser.add_argument('--value', help='Column to aggregate')
    group_parser.add_argument('--agg', default='count', help='Aggregation function (sum, mean, count, min, max)')
    group_parser.add_argument('--output', '-o', help='Output file path')
    
    # pivot command
    pivot_parser = subparsers.add_parser('pivot', help='Create pivot table')
    pivot_parser.add_argument('file', help='Data file path')
    pivot_parser.add_argument('--index', required=True, help='Row index column')
    pivot_parser.add_argument('--columns', required=True, help='Column headers')
    pivot_parser.add_argument('--values', required=True, help='Values to aggregate')
    pivot_parser.add_argument('--agg', default='mean', help='Aggregation function')
    pivot_parser.add_argument('--output', '-o', help='Output file path')
    
    # profile command
    profile_parser = subparsers.add_parser('profile', help='Quick data profile')
    profile_parser.add_argument('file', help='Data file path')
    
    # filter command
    filter_parser = subparsers.add_parser('filter', help='Filter data by condition')
    filter_parser.add_argument('file', help='Data file path')
    filter_parser.add_argument('--condition', '-c', required=True, help='Filter condition (pandas query syntax)')
    filter_parser.add_argument('--output', '-o', help='Output file path')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    commands = {
        'load': cmd_load,
        'describe': cmd_describe,
        'groupby': cmd_groupby,
        'pivot': cmd_pivot,
        'profile': cmd_profile,
        'filter': cmd_filter,
    }
    
    commands[args.command](args)


if __name__ == '__main__':
    main()
