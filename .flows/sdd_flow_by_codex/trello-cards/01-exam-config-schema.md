# Card 01: Exam System Config Schema

| Field | Value |
|-------|-------|
| **ID** | EXAM-01 |
| **Story Points** | 2 |
| **Depends On** | None |
| **Sprint** | 1 - Foundation |

## User Story

> As a developer, I want to define the database schema and configuration for the exam system so that we have a solid foundation for all exam features.

## Context

Read before starting:
- `exam-system-requirements.md` - Raw requirements
- `TEMPLATES/requirements.template.md` - Structure guide
- Use existing PostgreSQL patterns from project

## Instructions

### Step 1: Create Database Schema
```bash
# Create migration file for exam tables
touch src/db/migrations/014_create_exam_tables.sql
```

Add the following tables:
- `exams` - exam metadata (title, description, time_limit, start_date, end_date)
- `questions` - question bank (content, type, options, correct_answer, points, category, tags)
- `exam_questions` - linking table for exam to questions with ordering
- `student_exams` - student attempts (student_id, exam_id, start_time, end_time, status)
- `student_answers` - individual answers (student_exam_id, question_id, answer, is_graded, points_awarded)
- `grades` - final grades (student_exam_id, total_points, percentage, passed)

### Step 2: Create TypeScript Interfaces
```bash
# Create type definitions
mkdir -p src/types/exam
touch src/types/exam/index.ts
```

Define interfaces for:
- QuestionType: 'multiple-choice' | 'true-false' | 'essay' | 'fill-blank'
- ExamStatus: 'draft' | 'scheduled' | 'active' | 'completed' | 'archived'
- StudentExamStatus: 'not-started' | 'in-progress' | 'submitted' | 'graded'
- All table interfaces (Exam, Question, StudentExam, etc.)

### Step 3: Create Config Schema
```bash
# Create config file
touch src/config/exam.config.ts
```

Add exam-specific config:
- Max file upload size
- Allowed file types
- Default time limits
- Grading thresholds
- Attempt limits

## Acceptance Criteria

- [ ] Database migration runs successfully
- [ ] All tables created with proper indexes
- [ ] TypeScript interfaces match database schema
- [ ] Config schema follows existing project patterns
- [ ] Foreign key constraints properly defined

## Files Modified

- `src/db/migrations/014_create_exam_tables.sql`
- `src/types/exam/index.ts`
- `src/config/exam.config.ts`

## Next Card

-> [02-exam-question-bank.md](./02-exam-question-bank.md)