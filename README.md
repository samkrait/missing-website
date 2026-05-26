# Missing Website

This is a two-panel website with:

- `Person1` and `Person2` vote counters
- 5-minute cooldown between button clicks
- separate comment boards for each side
- shared persistence using Supabase so counts and comments are visible to all users

## What changed

- The site now uses Supabase as a shared backend.
- Vote counts and comments are stored in a central database.
- All visitors see the same data across devices and browsers.

## Supabase setup

1. Create a free Supabase account at https://app.supabase.com.
2. Create a new project.
3. Go to `Table Editor` and create a table named `shared_state` with these columns:
   - `id` (type: `int8`, primary key)
   - `person1_count` (type: `int8`, default `0`)
   - `person2_count` (type: `int8`, default `0`)
   - `person1_last_click` (type: `timestamptz`)
   - `person2_last_click` (type: `timestamptz`)
4. Insert one row with `id = 1`.
5. Create another table named `comments` with these columns:
   - `id` (type: `bigint`, primary key, identity)
   - `person` (type: `text`)
   - `text` (type: `text`)
   - `inserted_at` (type: `timestamptz`, default `now()`)
6. Enable Row Level Security (RLS) on both tables.
7. Create RLS policies to allow public read and insert. Example:
   - For `shared_state`: Allow `SELECT` and `UPDATE` to `anon` role.
   - For `comments`: Allow `INSERT` and `SELECT` to `anon` role.
8. Open `Settings -> API` and copy your `Project URL` and new **Publishable key** (starts with `sb_publishable_`).
9. Open `supabase-config.js` and replace the placeholder values with your URL and publishable key.

## Configure allowed origins

1. In Supabase go to `Settings -> API`.
2. Add your site URL to `Allowed CORS origins`.
   - For local testing: `http://localhost:5500` or your localhost port.
   - For deployment: the published site URL.

## Deploy for free

### GitHub Pages

1. Push your repository to GitHub.
2. In repository settings, enable GitHub Pages for the `main` branch.
3. Set the source to the repository root `/`.
4. Open the published URL.

### Netlify / Vercel

1. Create a free Netlify or Vercel account.
2. Connect your GitHub repository.
3. Deploy the site as a static project.

## Notes

- This site now uses a shared backend with Supabase for real-time data consistency across users.
- The Supabase **Publishable key** (new format: `sb_publishable_xxx`) is safe for browser use when Row Level Security (RLS) is enabled on your tables.
- Legacy `anon` keys still work until end of 2026, but Supabase recommends using the new Publishable keys.
- Make sure RLS is enabled on both `shared_state` and `comments` tables with appropriate policies before deploying..
