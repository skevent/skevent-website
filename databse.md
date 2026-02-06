# 📘 Database Overview (`database.md`)

## Purpose

This document describes the **database schema, relationships, security rules, and storage setup** for this project.
It acts as the **single source of truth** for any future replication, migration, or agent-based development.

⚠️ **Agents must strictly follow this schema. No structural changes without explicit instruction.**

---

## 🗂️ Tables Overview

### 1️⃣ `events`

**Purpose:** Stores all event-related information.

**Columns:**

* `id` (UUID) → **Primary Key**
* `title` (text)
* `description` (text, nullable)
* `date` (timestamp)
* `location` (text)
* `price` (numeric)
* `capacity` (bigint)
* `image_url` (text)
* `external_link` (text, nullable)
* `created_at` (timestamp)

**Relationships:**

* Referenced by:

  * `bookings.event_id`
  * `featured_events.event_id`

---

Got it — continuing **the same `database.md` content**, clean and consistent.
You can paste everything together as one file.

---

### 2️⃣ `bookings` (continued)

**Columns (continued):**

* `status` (text)

  * Allowed values: `pending`, `paid`, `cancelled`, `refunded`
* `razorpay_order_id` (text, nullable, **unique**)
* `razorpay_payment_id` (text, nullable)
* `email_sent_at` (timestamp, nullable)
* `created_at` (timestamp)

**Relationships:**

* `event_id` → references `events.id` (**ON DELETE CASCADE**)
* `influencer_code` → references `influencers.code`

**Notes:**

* A booking **must always belong to an existing event**
* Payment-related fields are updated asynchronously (webhook flow)

---

### 3️⃣ `featured_events`

**Purpose:** Controls which events are highlighted/featured and their display order.

**Columns:**

* `id` (UUID) → **Primary Key**
* `event_id` (UUID) → **Foreign Key → events.id**
* `display_order` (integer, default `0`)
* `created_at` (timestamp)

**Relationships:**

* `event_id` → references `events.id` (**ON DELETE CASCADE**)

**Notes:**

* Each record represents a featured event
* Display order controls UI placement

---

### 4️⃣ `influencers`

**Purpose:** Stores influencer metadata and referral codes.

**Columns:**

* `id` (UUID) → **Primary Key**
* `user_id` (UUID) → links to authenticated user
* `code` (text) → **Unique referral code**
* `name` (text)
* `email` (text) <!-- Added missing column -->
* `active` (boolean) <!-- Changed from is_active to active -->
* `created_at` (timestamp)

**Relationships:**

* `user_id` → maps to authenticated user (Supabase Auth)
* Referenced by:

  * `bookings.influencer_code`

**Notes:**

* Only active influencers can be used for referrals
* Influencers can manage only their own records

---

### 5️⃣ `profiles`

**Purpose:** Stores user profile information linked to authentication.

**Columns:**

* `id` (UUID) → **Primary Key** (matches auth user ID)
* `name` (text)
* `email` (text)
* `avatar_url` (text, nullable)
* `updated_at` (timestamp) <!-- Added missing column -->
* `created_at` (timestamp)

**Relationships:**

* `id` maps directly to Supabase Auth user ID

---

### 6️⃣ `email_verifications`

**Purpose:** Handles OTP-based email verification.

**Columns:**

* `email` (text) → **Primary Key**
* `otp` (text)
* `expires_at` (timestamp)
* `created_at` (timestamp)

**Notes:**

* Used for short-lived email verification flows
* Records are time-bound via `expires_at`

---

## 🔧 Functions

### `remove_future_featured_events`

**Purpose:**
Ensures featured events remain valid when an event’s date changes.

**Behavior:**

* Triggered when an event’s `date` is updated
* Automatically removes future-dated featured entries if conditions are met

**Used By:**

* Trigger on `events` table

---

## ⚡ Triggers

### `check_featured_date_update`

**Table:** `events`
**Event:** `AFTER UPDATE OF date`

**Purpose:**

* Calls `remove_future_featured_events`
* Keeps featured events logically consistent with event dates

---

## 🔐 Row Level Security (RLS)

**Status:**

* RLS is enabled on all application tables

Tables with RLS enabled:

* `events`
* `bookings`
* `featured_events`
* `influencers`
* `profiles`

Tables without RLS enabled:
* `email_verifications`

---

## 🛡️ Policies (High-Level Summary)

### Public Access

* Events and featured events are **publicly readable**
* Public users can create bookings

### Authenticated Users

* Can upload images to storage
* Can manage (update/delete) only their own records where applicable
* Influencers can manage only their own influencer data

### Admin / Backend (Service Role)

* Full access to:

  * Create, update, delete events
  * Manage bookings
  * Manage influencers
* Used for backend APIs, webhooks, and admin operations

⚠️ **No client-side code should ever use the service role key**

---

## 🗃️ Storage

### Bucket: `influencer-images`

**Purpose:** Stores influencer profile images.

**Access Rules:**

* Public read access (images can be viewed via public URL)
* Only authenticated users can upload
* Users can update/delete only their own files

**Notes:**

* Bucket name is case-sensitive
* Policies are managed via Supabase Dashboard (not SQL editor)

---

## 🔁 Replication Rules (IMPORTANT)

When creating a new project/client:

1. **Schema must remain identical**
2. Only the following may change:

   * API keys
   * Supabase project
   * Branding / UI
3. No table, column, or relationship changes without review
4. Policies must be recreated exactly
5. Storage buckets and access rules must match

---

## 📌 Final Notes

* This database is treated as a **contract**
* All agents must assume:

  * Foreign keys are enforced
  * RLS is active
  * Policies define the true access rules
* Any deviation must be explicitly approved

---


