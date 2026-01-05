# Feature: Auto-Archive Old Conversations

## Description
Automatically detect and archive inactive conversations to keep the conversation list clean and manageable.

## Raw Requirements
- Detect conversations with no activity for 30+ days
- Move old conversations to an archive storage
- Allow users to search and retrieve archived conversations
- Send notification 3 days before archiving
- Work only in Telegram for version 1
- Should not interrupt active conversations or those marked as important
- Use existing PostgreSQL database for archive storage
- Archive process should run daily at 2 AM

## Business Value
- Keeps conversation list clean
- Improves application performance
- Better user experience for active conversations
- Similar to email archive functionality users are familiar with

## Technical Considerations
- Need to track last activity timestamp
- Should handle large conversation volumes efficiently
- Must be reversible (can unarchive)
- Should work with existing Telegram integration patterns
- Follow existing notification system

## Questions
- What exactly counts as "activity"? (messages, reactions, both?)
- Should we exclude pinned conversations from auto-archiving?
- How many conversations can we archive per run?
- Do we need admin configuration for the 30-day threshold?