CREATE POLICY "Clients read submission files for own assignments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documents' AND EXISTS (
    SELECT 1 FROM public.assignment_submissions s
    JOIN public.assignment_claims c ON c.id = s.claim_id
    JOIN public.assignments a ON a.id = c.assignment_id
    JOIN public.employer_profiles e ON e.id = a.employer_id
    WHERE s.file_path = storage.objects.name AND e.owner_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public._on_ticket_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  if new.staff_response is distinct from old.staff_response and new.staff_response is not null then
    perform public._notify(new.user_id, 'support', 'Support replied: ' || left(new.subject, 80), left(new.staff_response, 300), '/report');
  elsif new.status is distinct from old.status then
    perform public._notify(new.user_id, 'support', 'Ticket ' || replace(new.status, '_', ' '), left(new.subject, 120), '/report');
  end if;
  return new;
end $$;

REVOKE ALL ON FUNCTION public._on_ticket_update() FROM public, anon, authenticated;

CREATE TRIGGER support_tickets_after_update
AFTER UPDATE ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public._on_ticket_update();