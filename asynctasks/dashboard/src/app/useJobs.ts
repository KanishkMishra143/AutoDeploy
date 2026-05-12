"use client";
import { useState, useEffect } from "react";

export interface Application {
    id: string;
    name: string;
    repo_url: string;
    branch?: string;
    env_vars: Record<string, string>;
    created_at: string;
    updated_at: string;
}

export interface Job {
    id: string;
    app_id?: string;
    type: string;
    status: string;
    result?: {
        url?: string;
        message?: string;
    };
    created_at: string;
    updated_at: string;
}

export function useJobs() {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [apps, setApps] = useState<Application[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [workerCount, setWorkerCount] = useState(0);

    const fetchWorkers = async () => {
        try {
            const response = await fetch("http://localhost:8000/workers");
            if (!response.ok) throw new Error();
            const data = await response.json();
            setWorkerCount(data.count);
        } catch {
            setWorkerCount(0);
        }
    };

    const fetchApps = async () => {
        try {
            const response = await fetch("http://localhost:8000/apps");
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
        const response = await fetch("http://localhost:8000/jobs?limit=50");
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
    };

    useEffect(() => {
        refreshData();
        const interval = setInterval(refreshData, 3000);
        return () => clearInterval(interval);
    }, []);

    return { jobs, apps, loading, error, workerCount };
}
