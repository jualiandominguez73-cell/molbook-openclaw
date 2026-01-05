# Feature: Premium Publishing System with Interactive HTML Generation

## Description
A shell-based system that transforms any Markdown file into two complementary premium HTML pages: a clean manuscript view and an interactive visual experience, using world-class typography house templates.

## Raw Requirements

- For every MD file, generate TWO HTML pages:
  1. **Manuscript Page**: 1:1 faithful representation with premium typography, no decoration, optimized for deep reading
  2. **Experience Page**: Creative reinterpretation with interactive elements (collapsible sections, symbol explorers, timelines)

- Create typography house template library:
  * Boutique presses: The Folio Society, Fitzcarraldo Editions, Persephone Books, Notting Hill Editions
  * Art & Design: Phaidon, Viction:ary, Slanted Publishers, MACK, Hatje Cantz
  * Typographic indie: Fitzcarraldo-style brutal minimalism, Mack's "quiet design"

- Shell script interface: `html_me.sh input.md` generates both pages automatically

- Template selection logic analyzes content (word count, genre, code blocks, quotes) to select optimal typography house

- Each template has visual language definition: font stack, spacing, colors, layout principles

- Navigation system: Top bar linking "View Manuscript" ↔ "View Experience" on every page

- Creative brief generation: For each conversion, generate markdown-to-visual-concept.md documenting reasoning

- Interactive elements library:
  * Collapsible Table of Contents
  * Symbol Explorer (click emoji → reveal meaning)
  * Timeline visualizations for chronological content
  * Connection maps for relationship-heavy content

- Design principles: Progressive disclosure, dual coding theory (text+visual), mobile-first, accessibility

- Source MD content must be 100% preserved in Manuscript page, restructured for Experience page

## Questions

- Should Manuscript page be completely static or have minimal JS (like smooth scroll)?
- Should Experience page include the original text or just visualizations?
- Template selection: weighted scoring or decision tree based on content features?
- Typography licensing: how to handle premium fonts (Google Fonts only, or include fallbacks)?
- Navigation: persistent top bar or section-based navigation?
- Output naming: input-manuscript.html + input-experience.html, or input.html + input-visual.html?

## Expected Workflow

User runs: `html_me.sh report.md`

System does:
1. Extracts content structure from report.md
2. Analyzes: word count=8423, genre=literary, quotes=12, code=0, images=0
3. Selects: Fitzcarraldo Editions template for Manuscript, Mack Books interactive for Experience
4. Generates: report-manuscript.html (pure typography) + report-experience.html (interactive)
5. Creates: report-visual-brief.md (reasoning documentation)
6. Injects: Navigation linking both pages
7. Outputs: Success message with URLs

## Goals

- Transforms passive reading into active exploration
- Maintains content fidelity while adding visual dimension
- Makes academic/intensive content more accessible and memorable
- Systematic approach ensures repeatability without losing creative intelligence