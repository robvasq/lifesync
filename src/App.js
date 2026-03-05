import { useState, useEffect } from 'react';
import supabase from "./supabase";
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import Landing from './landing';
import LifeSync from './LifeSync';
import Auth from './Auth';


const Spinner = () => (
  <div style={{ minHeight:"100vh", background:"#07080f", display:"flex", alignItems:"center", justifyContent:"center" }}>
    <span style={{ display:"inline-block", width:36, height:36, border:"3px solid #818cf8", borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.7s linear infinite" }} />
    <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
  </div>
);

function AppRoutes() {
  const [user, setUser] = useState(undefined);
  const navigate = useNavigate();

  useEffect(() => {
    // Get initial session first
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Then listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    navigate("/");
  };

  const handleAuthenticated = (authUser) => {
    setUser(authUser);
    navigate("/app");
  };

  if (user === undefined) return <Spinner />;

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={
        user ? <LifeSync user={user} onSignOut={handleSignOut} /> : <Auth onAuthenticated={handleAuthenticated} />
      } />
      <Route path="/app" element={
        user
          ? <LifeSync user={user} onSignOut={handleSignOut} />
          : <LifeSync user={null} onSignOut={() => navigate("/")} isDemo={true} />
      } />
      <Route path="*" element={<Landing />} />
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
