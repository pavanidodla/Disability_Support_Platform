import { useEffect, useState, useCallback } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("accessai_user");
      const token = localStorage.getItem("accessai_token");
      if (stored && token) {
        setUser(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
    setIsLoading(false);
  }, []);

  const signIn = useCallback(async (email, password) => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");
    localStorage.setItem("accessai_token", data.token);
    localStorage.setItem("accessai_user", JSON.stringify(data.user));
    setUser(data.user);
    return data;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const res = await fetch(`${API_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Registration failed");
    localStorage.setItem("accessai_token", data.token);
    localStorage.setItem("accessai_user", JSON.stringify(data.user));
    setUser(data.user);
    return data;
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem("accessai_token");
    localStorage.removeItem("accessai_user");
    setUser(null);
  }, []);

  const isAuthenticated = !!user;

  return {
    isLoading,
    isAuthenticated,
    user,
    signIn,
    register,
    signOut,
    isLocalAuth: isAuthenticated,
  };
}
