---
name: data-analytics
description: Comprehensive data analytics capabilities including SQL/SQLite querying, Python/pandas analysis, Excel processing, and visualization generation.
metadata: {"clawdbot":{"requires":{"bins":["python3","sqlite3"]}}}
---

# Data Analytics Skill

Professional data analytics capabilities for Simon's workflow.

## Prerequisites

- Python 3.10+ (available)
- SQLite3 (available)
- Virtual environment with dependencies at `{baseDir}/.venv/`

**Using the scripts:**
```bash
# Use the venv Python directly
{baseDir}/.venv/bin/python {baseDir}/analyze.py <command>
{baseDir}/.venv/bin/python {baseDir}/excel.py <command>
{baseDir}/.venv/bin/python {baseDir}/visualize.py <command>
```

## Capabilities

### 1. SQL/SQLite Querying

Query any SQLite database with full SQL support.

```bash
# Basic query
sqlite3 /path/to/database.sqlite "SELECT * FROM table LIMIT 10;"

# Complex query with exports
sqlite3 -header -csv /path/to/db.sqlite "SELECT * FROM users WHERE created > '2026-01-01';" > output.csv
```

**Supported operations:**
- SELECT with JOINs, subqueries, CTEs
- Window functions (ROW_NUMBER, RANK, LAG, LEAD)
- Aggregations (GROUP BY, HAVING)
- Export to CSV, JSON, or formatted table

### 2. Python/Pandas Analysis

Use `{baseDir}/analyze.py` for data processing:

```bash
python3 {baseDir}/analyze.py load /path/to/data.csv
python3 {baseDir}/analyze.py describe /path/to/data.csv
python3 {baseDir}/analyze.py groupby /path/to/data.csv --by column_name --agg sum
python3 {baseDir}/analyze.py pivot /path/to/data.csv --index col1 --columns col2 --values col3
```

**Features:**
- Load CSV, JSON, Excel, Parquet
- Descriptive statistics (mean, median, std, correlations)
- Data cleaning (missing values, duplicates, type conversion)
- Groupby aggregations
- Pivot tables
- Time series analysis
- Custom transforms via Python expressions

### 3. Excel Processing

Use `{baseDir}/excel.py` for .xlsx files:

```bash
python3 {baseDir}/excel.py read /path/to/file.xlsx --sheet "Sheet1"
python3 {baseDir}/excel.py write /path/to/output.xlsx --data '{"A1": "Hello", "B1": "World"}'
python3 {baseDir}/excel.py list-sheets /path/to/file.xlsx
```

**Features:**
- Read/write .xlsx files
- Preserve formatting when possible
- Handle multiple sheets
- Formula support (read existing, write new)
- Named ranges
- VLOOKUP/XLOOKUP equivalent via pandas merge

### 4. Visualization

Use `{baseDir}/visualize.py` to generate charts:

```bash
python3 {baseDir}/visualize.py bar /path/to/data.csv --x category --y value --output chart.png
python3 {baseDir}/visualize.py line /path/to/data.csv --x date --y sales --output trend.png
python3 {baseDir}/visualize.py scatter /path/to/data.csv --x x_col --y y_col --output scatter.png
python3 {baseDir}/visualize.py heatmap /path/to/data.csv --output correlation.png
```

**Chart types:**
- Bar charts (vertical, horizontal, stacked, grouped)
- Line charts (single, multi-series, with markers)
- Scatter plots (with regression line option)
- Histograms and distributions
- Box plots
- Heatmaps (correlation matrices)
- Pie/donut charts

**Output formats:**
- PNG (default, good for Telegram)
- SVG (scalable)
- HTML (interactive with Plotly)

## Common Workflows

### Analyze CSV and Generate Report

```python
import pandas as pd

# Load data
df = pd.read_csv('data.csv')

# Basic stats
print(df.describe())

# Groupby analysis
summary = df.groupby('category').agg({'value': ['sum', 'mean', 'count']})
print(summary)

# Save results
summary.to_csv('summary.csv')
```

### Excel to SQLite Pipeline

```bash
# Read Excel, process, store in SQLite
python3 {baseDir}/excel.py read input.xlsx --sheet "Data" --output temp.csv
sqlite3 analytics.db < {baseDir}/scripts/import_csv.sql
```

### Quick Data Profile

```bash
python3 {baseDir}/analyze.py profile /path/to/data.csv
```

Outputs:
- Row/column counts
- Data types per column
- Missing value %
- Unique value counts
- Statistical summary
- Sample values

## Integration Notes

- All outputs can be sent to Telegram as files or images
- Large datasets: use sampling for initial exploration
- For sensitive data: process locally, don't upload to external services
- Simon's expertise areas: Workday, SAP SuccessFactors, Salesforce CRM data
