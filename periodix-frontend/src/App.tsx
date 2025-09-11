import { useEffect, useState } from 'react';
import './index.css';
import type { User } from './types';
import Login from './components/Login';
import Dashboard from './pages/Dashboard';
import { setGlobalLogoutHandler, setGlobalTokenUpdateHandler } from './api';

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

    function onTokenUpdate(newToken: string) {
        localStorage.setItem('token', newToken);
        setToken(newToken);
    }

    // Set up global logout handler for automatic logout on invalid token
    // Set up global token update handler for automatic token refresh
    useEffect(() => {
        setGlobalLogoutHandler(onLogout);
        setGlobalTokenUpdateHandler(onTokenUpdate);
    }, []);

    function onUserUpdate(next: User) {
        setUser(next);
        localStorage.setItem('user', JSON.stringify(next));
    }

    // Manage scroll locking: only lock when authenticated dashboard is visible
    useEffect(() => {
        if (token && user) {
            document.body.classList.add('scroll-lock');
        } else {
            document.body.classList.remove('scroll-lock');
        }
    }, [token, user]);

    if (!token || !user) return <Login onAuth={onAuth} />;

    return (
        <Dashboard
            token={token}
            user={user}
            onLogout={onLogout}
            dark={dark}
            setDark={setDark}
            onUserUpdate={onUserUpdate}
        />
    );
}
