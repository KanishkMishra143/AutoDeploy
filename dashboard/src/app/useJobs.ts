"use client";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { API_BASE_URL } from "../lib/api";

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
    internal_port: number;
    pre_build_steps: string[];
    post_build_steps: string[];
    env_vars: Record<string, string>;
    root_dir?: string;
    retention_limit?: number;
    retention_days?: number;
    volumes?: string[];
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
        diagnosis?: {
            title: string;
            suggestion: string;
            category: string;
            detected_at: string;
        };
        container?: {
            container_id: string;
            container_name: string;
            hostname: string;
            port: string;
            url: string;
        };
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
    expires_at?: string;
    last_used_at?: string;
    secret_key?: string;
}

export interface Credential {
    id: string;
    name: string;
    type: string;
    created_at: string;
}

export function useJobs() {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [apps, setApps] = useState<Application[]>([]);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [settings, setSettings] = useState<UserSettings | null>(null);
    const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
    const [credentials, setCredentials] = useState<Credential[]>([]);
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
            const response = await fetch("${API_BASE_URL}/auth/profile", { headers });
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
            const response = await fetch("${API_BASE_URL}/auth/settings", { headers });
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
            const response = await fetch("${API_BASE_URL}/auth/settings", {
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
            const response = await fetch("${API_BASE_URL}/auth/keys", { headers });
            if (response.ok) {
                const data = await response.json();
                setApiKeys(data);
            }
        } catch (err) {
            console.error("Failed to fetch API keys:", err);
        }
    };

    const createApiKey = async (name: string, validityDays: number = 7) => {
        try {
            const headers = await getAuthHeaders();
            const response = await fetch("${API_BASE_URL}/auth/keys", {
                method: "POST",
                headers,
                body: JSON.stringify({ name, validity_days: validityDays })
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
            const response = await fetch(`${API_BASE_URL}/auth/keys/${id}`, {
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

    const fetchCredentials = async () => {
        try {
            const headers = await getAuthHeaders();
            const response = await fetch("${API_BASE_URL}/auth/credentials", { headers });
            if (response.ok) {
                const data = await response.json();
                setCredentials(data);
            }
        } catch (err) {
            console.error("Failed to fetch credentials:", err);
        }
    };

    const createCredential = async (name: string, type: string, value: string) => {
        try {
            const headers = await getAuthHeaders();
            const response = await fetch("${API_BASE_URL}/auth/credentials", {
                method: "POST",
                headers,
                body: JSON.stringify({ name, type, value })
            });
            if (response.ok) {
                const data = await response.json();
                setCredentials(prev => [...prev, data]);
                return data;
            }
        } catch (err) {
            console.error("Failed to create credential:", err);
            throw err;
        }
    };

    const deleteCredential = async (id: string) => {
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_BASE_URL}/auth/credentials/${id}`, {
                method: "DELETE",
                headers
            });
            if (response.ok) {
                setCredentials(prev => prev.filter(c => c.id !== id));
            }
        } catch (err) {
            console.error("Failed to delete credential:", err);
        }
    };

    const fetchWorkers = async () => {
        try {
            const headers = await getAuthHeaders();
            const response = await fetch("${API_BASE_URL}/workers", { headers });
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
            const response = await fetch("${API_BASE_URL}/apps", { headers });
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
        const response = await fetch("${API_BASE_URL}/jobs?limit=50", { headers });
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
        fetchCredentials();
    };

    useEffect(() => {
        refreshData();
        const interval = setInterval(refreshData, 3000);
        return () => clearInterval(interval);
    }, []);

    return { 
        jobs, apps, profile, settings, apiKeys, credentials, loading, error, workerCount,
        updateSettings, createApiKey, revokeApiKey, createCredential, deleteCredential
    };
}
