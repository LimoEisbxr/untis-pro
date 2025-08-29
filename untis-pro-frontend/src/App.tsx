import { useEffect, useState } from 'react';
import './index.css';
import type { User } from './types';
import Login from './components/Login';
import Dashboard from './pages/Dashboard';
import AdminPage from './pages/AdminPage';

export default function App() {
    const [token, setToken] = useState<string | null>(() =>
        localStorage.getItem('token')
    );
    const [user, setUser] = useState<User | null>(() => {
        const u = localStorage.getItem('user');
        return u ? (JSON.parse(u) as User) : null;
    });
    // Default to dark mode if no preference stored; respect explicit stored choice
    const [dark, setDark] = useState<boolean>(() => {
        const stored = localStorage.getItem('theme');
        if (!stored) return true; // default dark
        return stored === 'dark';
    });

    useEffect(() => {
        const root = document.documentElement;
        if (dark) {
            root.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            root.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [dark]);

    function onAuth(tok: string, u: User) {
        localStorage.setItem('token', tok);
        localStorage.setItem('user', JSON.stringify(u));
        setToken(tok);
        setUser(u);
    }
    function onLogout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
    }

    const [view, setView] = useState<'dashboard' | 'admin'>('dashboard');

    useEffect(() => {
        function onNav(e: Event) {
            const detail = (e as CustomEvent).detail as { view?: string };
            if (detail?.view === 'admin') setView('admin');
        }
        window.addEventListener('nav', onNav as EventListener);
        return () => window.removeEventListener('nav', onNav as EventListener);
    }, []);

    if (!token || !user) return <Login onAuth={onAuth} />;

    if (view === 'admin' && user.isAdmin) {
        return (
            <AdminPage
                token={token}
                onBack={() => setView('dashboard')}
                onLogout={onLogout}
                dark={dark}
                setDark={setDark}
            />
        );
    }

    return (
        <Dashboard
            token={token}
            user={user}
            onLogout={onLogout}
            dark={dark}
            setDark={setDark}
        />
    );
}
