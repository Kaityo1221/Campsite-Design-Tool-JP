-- Allow Discord/Supabase-authenticated CA users to submit support feedback.
-- Existing anon policy remains for unauthenticated access.

create policy "allow authenticated insert ca_feedback"
on public.ca_feedback
for insert
to authenticated
with check (
  status = 'new'
  and char_length(session_id) between 8 and 120
  and char_length(content) between 1 and 2000
);
