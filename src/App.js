import { useState, useEffect } from 'react';
import supabase from "./supabase";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import LandingPage from './LandingPage';
import LifeSync from './LifeSync';
import Auth from './Auth';

const Spinner = () => (
  <div style={{ minHeight:"100vh", background:"#f5f4f0", display:"flex", alignItems:"center", justifyContent:"center" }}>
    <span style={{ display:"inline-block", width:36, height:36, border:"3px solid #d4860a", borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.7s linear infinite" }} />
    <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
  </div>
);

function AppRoutes() {
  const [user, setUser] = useState(undefined);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
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
      <Route path="/" element={
        user
          ? <Navigate to="/app" />
          : <LandingPage
              onGetStarted={() => navigate("/login")}
              onSignIn={() => navigate("/login")}
              onDemo={() => navigate("/demo")}
            />
      } />
      <Route path="/login" element={
        user
          ? <Navigate to="/app" />
          : <Auth
              onAuthenticated={handleAuthenticated}
              onBack={() => navigate("/")}
              onDemo={() => navigate("/demo")}
            />
      } />
      <Route path="/demo"  element={<LifeSync isDemo={true} />} />
      <Route path="/app"   element={
        user
          ? <LifeSync user={user} onSignOut={handleSignOut} />
          : <Navigate to="/login" />
      } />
      <Route path="*" element={<Navigate to="/" />} />
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
