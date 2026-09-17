-- Allow anon role to update qonun_moddalari (needed for embedding backfill from client scripts)
CREATE POLICY "update_qonun_moddalari_anon" ON qonun_moddalari
  FOR UPDATE TO anon USING (true) WITH CHECK (true);
