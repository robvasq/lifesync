import { createClient } from "@supabase/supabase-js";

// Single shared Supabase instance for the entire app
const supabase = createClient(
  "https://qrtdvkzaffzhhyebnnof.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFydGR2a3phZmZ6aGh5ZWJubm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NTM5OTMsImV4cCI6MjA4ODIyOTk5M30.ex7LNx7Fl8GR8CpAf4vXwUlOLl3qGWxLGkxuE194pkE"
);

export default supabase;
