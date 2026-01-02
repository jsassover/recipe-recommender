// src/App.jsx
import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import MealPlanPage from './pages/MealPlanPage';
import ShoppingListPage from './pages/ShoppingListPage';
import PantryPage from './pages/PantryPage';
import './App.css';

// --- THE MAIN APP LAYOUT WITH NAVIGATION ---
function AppLayout({ session }) {
  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <h1>Meal Planner</h1>
        <div className="user-info">
          <span>{session.user.email}</span>
          <button onClick={handleSignOut} className="btn-ghost btn-sm">
            Sign Out
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="app-nav">
        <NavLink to="/" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`} end>
          <span className="nav-icon">📅</span>
          <span className="nav-label">Meal Plan</span>
        </NavLink>
        <NavLink to="/shopping" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
          <span className="nav-icon">🛒</span>
          <span className="nav-label">Shopping List</span>
        </NavLink>
        <NavLink to="/pantry" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
          <span className="nav-icon">🏠</span>
          <span className="nav-label">Pantry</span>
        </NavLink>
      </nav>

      {/* Main Content */}
      <main className="main-content container">
        <Routes>
          <Route path="/" element={<MealPlanPage />} />
          <Route path="/shopping" element={<ShoppingListPage />} />
          <Route path="/pantry" element={<PantryPage />} />
        </Routes>
      </main>
    </div>
  );
}

// --- THE MAIN APP COMPONENT ---
function App() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!session) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h1>Meal Planner</h1>
          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#5ebd21',
                    brandAccent: '#4a9a1a',
                  },
                },
              },
            }}
          />
        </div>
      </div>
    )
  } else {
    return (
      <BrowserRouter>
        <AppLayout session={session} />
      </BrowserRouter>
    );
  }
}

export default App;
