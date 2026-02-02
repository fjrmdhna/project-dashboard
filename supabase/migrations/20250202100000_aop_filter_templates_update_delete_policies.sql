-- Allow UPDATE and DELETE on aop_filter_templates (for Update template / Delete template)
CREATE POLICY "Allow update aop_filter_templates" ON aop_filter_templates
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow delete aop_filter_templates" ON aop_filter_templates
  FOR DELETE USING (true);
