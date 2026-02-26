-- Dirty Data Boyz - Supabase Schema
-- Run this in Supabase Dashboard → SQL Editor

-- Analyses table
CREATE TABLE analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('xlsx', 'csv', 'pdf')),
  file_size TEXT,
  row_count INTEGER,
  col_count INTEGER,
  the_good JSONB DEFAULT '[]'::jsonb,
  the_bad JSONB DEFAULT '[]'::jsonb,
  the_dirty JSONB DEFAULT '[]'::jsonb,
  raw_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (open for now, lock down later with auth)
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (no auth)
CREATE POLICY "Allow all reads" ON analyses FOR SELECT USING (true);
CREATE POLICY "Allow all inserts" ON analyses FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all deletes" ON analyses FOR DELETE USING (true);

-- Index for faster queries
CREATE INDEX idx_analyses_created_at ON analyses (created_at DESC);
