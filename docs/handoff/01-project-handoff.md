# Comprehensive Project Handoff: Brill Ops Platform

## Project Overview

Build a full-stack web application called **Brill Ops** — a long-term campaign management platform designed initially for **Ingress community operations** and crossfaction global events.

The platform should not be built as a single-event website. It should serve as a reusable infrastructure for managing multiple campaigns, operations, teams, agents, statistics, archives, and community participation over time.

The first implementation will support the **"Stars for Peace"** campaign, but the architecture must be designed so that future campaigns can be added without structural changes.

---

# Core Concept

Brill Ops is a living platform connecting:

- Campaigns
- Teams
- Agents
- Countries
- Factions
- Links created
- Media galleries
- Historical archives

The system should automatically calculate and display all statistics from live database data.

No manually maintained statistics should exist.

---

# Main User Experience

## Homepage

The homepage always displays the currently active campaign.

The active campaign should include:

- Campaign name
- Hero image / branding
- Countdown timer
- Community invitation
- Live statistics
- Team dashboard
- Filters
- Rankings

When a campaign ends, it automatically moves to the archive.

---

# Campaign Management Architecture

## Campaign Entity

The system must support unlimited campaigns.

Each campaign should contain:

- Name
- Description
- Start date
- End date
- Status:
  - Draft
  - Active
  - Archived
- Hero image
- Campaign statistics
- Teams
- Agents
- Media

Adding a new campaign should require only creating a new campaign record.

---

# Archive System

Completed campaigns should automatically move to the Archive.

Archived campaigns must preserve:

- Dashboard
- Team cards
- Team galleries
- Agent participation
- Statistics
- Photos
- Videos
- Final results

The system should support importing previous campaigns directly into the archive.

The first archived campaign will be imported manually as historical data.

---

# Authentication

## Google Sign-In

Users should authenticate through Google.

Authentication should be implemented using:

- Supabase Auth (preferred)
or
- Firebase Authentication

A user account allows participants to:

- Create submissions
- Edit submissions
- Upload media
- Track participation history
- Access personal activity

---

# Agent System

## Agent Profiles

Each participant should have a permanent Agent profile.

Route:

`/agent/[id]`

Profile includes:

- Agent name
- Profile picture (from Google if available)
- Country
- City (optional)
- Faction history
- Campaign participation history
- Total links created
- Total teams joined
- Completed projects

---

# Global Agent Directory

Route:

`/agents`

A searchable directory containing all participants across all campaigns.

Features:

- Search by name
- Search by country
- Search by city
- Filter by faction
- Filter by campaign
- Sort alphabetically
- Sort by contribution

Clicking an agent opens their profile.

---

# Team System

## Team Cards Dashboard

Display teams as responsive square cards.

Each card displays:

- Team name
- Faction color
- City
- Country
- Number of links created
- Number of participants
- Current status

---

# Team Status Logic

Automatically calculate:

### Planning
Before construction start date.

### In Progress
After start date and before completion.

### Completed
After end date or when final photos are uploaded.

---

# Team Gallery

Dynamic route:

`/team/[id]`

Each team page displays:

- Construction start photo
- Construction end photos
- Additional photos
- Videos
- Team statistics
- Construction duration
- Participating agents

---

# Dynamic Filters

The dashboard should support filtering and sorting.

Required filters:

- All teams
- Blue faction
- Green faction
- Crossfaction
- Highest number of links
- Most participants
- Completed
- In progress
- Planning
- Country
- City
- Recently updated

The filtering system should be extensible.

---

# Live Global Statistics

Homepage should automatically calculate:

## Participation

- Number of countries
- Number of cities
- Number of teams
- Total agents

## Faction Statistics

Display:

- Blue agents
- Green agents
- Crossfaction agents

For each:

- Teams count
- Agents count
- Links created

## Global Metrics

Display:

- Total links created worldwide
- Average links per team
- Largest team
- Top country
- Top contributor

All values must update automatically from the database.

---

# Submission System

## Team Submission Form

Participants can submit:

- Team name
- Faction color:
  - Blue
  - Green
  - Crossfaction
- City
- Country
- Portal address
- Construction start date
- Start photo
- End date
- End photos
- Additional media
- Number of links created
- Number of participants
- Agent names

---

# Editing System

Participants must be able to return and update submissions.

Possible implementations:

- Authenticated Google account
- Magic link
- Unique editing URL

Editing should allow:

- Adding completion dates
- Uploading final media
- Updating statistics
- Correcting information

---

# Progressive Web App (PWA)

Brill Ops should work as an installable mobile app.

Requirements:

## Add to Home Screen

Homepage should contain:

Button:

**"Add Brill Ops to your Home Screen"**

The button opens instructions for:

- iPhone Safari
- Android Chrome

When supported, trigger the native install prompt.

---

# Database Architecture

Recommended stack:

## Frontend

- Next.js
- React
- Tailwind CSS
- Lucide Icons

## Backend

Preferred:

- Supabase

Required services:

- PostgreSQL database
- Authentication
- Storage buckets
- Media management

---

# Suggested Data Model

## Users

Technical authentication accounts.

Fields:

- id
- google_id
- email
- created_at

---

## Agents

Public participant identity.

Fields:

- id
- user_id
- name
- avatar
- country
- city

---

## Campaigns

Fields:

- id
- name
- description
- start_date
- end_date
- status
- image

---

## Teams

Fields:

- id
- campaign_id
- name
- faction
- city
- country
- portal_address
- construction_start_date
- construction_end_date
- start_photo
- end_photos
- links_created

---

## Participation

Many-to-many relationship:

Agent ↔ Team

Fields:

- agent_id
- team_id
- role

---

# Initial Development Tasks

1. Create Brill Ops project structure.
2. Configure database.
3. Configure authentication.
4. Configure media storage.
5. Implement campaign architecture.
6. Implement Stars for Peace as first active campaign.
7. Build submission system.
8. Build agent system.
9. Build team dashboard.
10. Build archive system.
11. Add PWA functionality.
12. Implement dynamic statistics engine.

---

# Long-Term Vision

Brill Ops should become a reusable operating system for global community campaigns:

A place where communities can create operations, collaborate across factions, document achievements, and preserve their collective history.