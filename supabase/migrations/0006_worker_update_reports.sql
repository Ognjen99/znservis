-- Allow workers to edit their own reports and material lines

create policy "workers can update own reports"
on public.work_reports
for update
to authenticated
using (worker_id = auth.uid() and public.is_active_worker())
with check (worker_id = auth.uid() and public.is_active_worker());

create policy "workers can delete own report items"
on public.work_report_items
for delete
to authenticated
using (
  public.is_active_worker()
  and exists (
    select 1
    from public.work_reports wr
    where wr.id = work_report_items.report_id
      and wr.worker_id = auth.uid()
  )
);
