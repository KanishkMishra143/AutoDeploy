"use client";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export interface AppAccess {
    id: string;
    user_id: string;
    role: string;
    created_at: string;
    profile?: Profile;
}

export interface Application {
    id: string;
    name: string;
    repo_url: string;
    branch?: string;
    stack: string;
    pre_build_steps: string[];
    post_build_steps: string[];
    env_vars: Record<string, string>;
    created_at: string;
    updated_at: string;
    role?: "OWNER" | "ADMIN" | "VIEWER";
    owner_profile?: Profile;
    access_list?: AppAccess[];
}

export interface Job {
    id: string;
    app_id?: string;
    build_number?: number;
    type: string;
    status: string;
    trigger_reason?: string;
    trigger_metadata?: any;
    result?: {
        url?: string;
        message?: string;
        progress_msg?: string;
        progress_pct?: number;
    };
    created_at: string;
    updated_at: string;
}

export interface Profile {
    user_id: string;
    username: string;
    full_name?: string;
    avatar_url?: string;
}

export interface UserSettings {
    notifications_enabled: Record<string, boolean>;
    appearance_mode: string;
}

export interface APIKey {
    id: string;
    name: string;
    key_prefix: string;
    created_at: string;
    last_used_at?: string;
    secret_key?: string;
}

export function useJobs() {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [apps, setApps] = useState<Application[]>([]);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [settings, setSettings] = useState<UserSettings | null>(null);
    const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [workerCount, setWorkerCount] = useState(0);

    const getAuthHeaders = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return {
            "Authorization": `Bearer ${session?.access_token}`,
            "Content-Type": "application/json"
        };
    };

    const fetchProfile = async () => {
        try {
            const headers = await getAuthHeaders();
            const response = await fetch("http://127.0.0.1:8000/auth/profile", { headers });
            if (response.ok) {
                const data = await response.json();
                setProfile(data);
            }
        } catch (err) {
            console.error("Failed to fetch profile:", err);
        }
    };

    const fetchSettings = async () => {
        try {
            const headers = await getAuthHeaders();
            const response = await fetch("http://127.0.0.1:8000/auth/settings", { headers });
            if (response.ok) {
                const data = await response.json();
                setSettings(data);
            }
        } catch (err) {
            console.error("Failed to fetch settings:", err);
        }
    };

    const updateSettings = async (newSettings: UserSettings) => {
        try {
            const headers = await getAuthHeaders();
            const response = await fetch("http://127.0.0.1:8000/auth/settings", {
                method: "PATCH",
                headers,
                body: JSON.stringify(newSettings)
            });
            if (response.ok) {
                const data = await response.json();
                setSettings(data);
                return data;
            }
        } catch (err) {
            console.error("Failed to update settings:", err);
            throw err;
        }
    };

    const fetchApiKeys = async () => {
        try {
            const headers = await getAuthHeaders();
            const response = await fetch("http://127.0.0.1:8000/auth/keys", { headers });
            if (response.ok) {
                const data = await response.json();
                setApiKeys(data);
            }
        } catch (err) {
            console.error("Failed to fetch API keys:", err);
        }
    };

    const createApiKey = async (name: string) => {
        try {
            const headers = await getAuthHeaders();
            const response = await fetch("http://127.0.0.1:8000/auth/keys", {
                method: "POST",
                headers,
                body: JSON.stringify({ name })
            });
            if (response.ok) {
                const data = await response.json();
                setApiKeys(prev => [...prev, data]);
                return data;
            }
        } catch (err) {
            console.error("Failed to create API key:", err);
            throw err;
        }
    };

    const revokeApiKey = async (id: string) => {
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`http://127.0.0.1:8000/auth/keys/${id}`, {
                method: "DELETE",
                headers
            });
            if (response.ok) {
                setApiKeys(prev => prev.filter(k => k.id !== id));
            }
        } catch (err) {
            console.error("Failed to revoke API key:", err);
        }
    };

    const fetchWorkers = async () => {
        try {
            const headers = await getAuthHeaders();
            const response = await fetch("http://127.0.0.1:8000/workers", { headers });
            if (!response.ok) throw new Error();
            const data = await response.json();
            setWorkerCount(data.count);
        } catch {
            setWorkerCount(0);
        }
    };

    const fetchApps = async () => {
        try {
            const headers = await getAuthHeaders();
            const response = await fetch("http://127.0.0.1:8000/apps", { headers });
            if (response.ok) {
                const data = await response.json();
                setApps(data.apps || []);
            }
        } catch (err) {
            console.error("Failed to fetch apps:", err);
        }
    };

    const fetchJobs = async () => {
      try {
        const headers = await getAuthHeaders();
        const response = await fetch("http://127.0.0.1:8000/jobs?limit=50", { headers });
        if (!response.ok) throw new Error("API Unreachable");
        const data = await response.json();
        setJobs(data.jobs || []);
        setError(null);
      } catch (error) {
        console.error("Failed to fetch jobs:", error);
        setError("API Offline");
      } finally {
        setLoading(false);
      }
    };

    const refreshData = () => {
        fetchJobs();
        fetchApps();
        fetchWorkers();
        fetchProfile();
        fetchSettings();
        fetchApiKeys();
    };

    useEffect(() => {
        refreshData();
        const interval = setInterval(refreshData, 3000);
        return () => clearInterval(interval);
    }, []);

    return { 
        jobs, apps, profile, settings, apiKeys, loading, error, workerCount,
        updateSettings, createApiKey, revokeApiKey
    };
}
