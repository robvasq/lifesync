import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import Landing from './landing';
import LifeSync from './LifeSync';
import Auth from './Auth';

const supabase = createClient(
  "https://qrtdvkzaffzhhyebnnof.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFydGR2a3phZmZ6aGh5ZWJubm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NTM5OTMsImV4cCI6MjA4ODIyOTk5M30.ex7LNx7Fl8GR8CpAf4vXwUlOLl3qGWxLGkxuE194pkE"
);

function AppRoutes() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    navigate('/');
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#07080f', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{
          display: 'inline-block', width: 36, height: 36,
          border: '3px solid #818cf8', borderTopColor: 'transparent',
          borderRadius: '50%', animation: 'spin 0.7s linear infinite',
        }} />
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={
        user ? <LifeSync user={user} onSignOut={handleSignOut} /> : <Auth onAuthenticated={(u) => { setUser(u); navigate('/app'); }} />
      } />
      <Route path="/app" element={
        user
          ? <LifeSync user={user} onSignOut={handleSignOut} />
          : <Auth onAuthenticated={(u) => { setUser(u); navigate('/app'); }} />
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
