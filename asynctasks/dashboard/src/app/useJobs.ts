"use client";
import { useState, useEffect } from "react";

export interface Job {
    id: number;
    type: string;
    status: string;
    created_at: string;
    updated_at: string;
}

export function useJobs() {
    const [jobs, setJobs] = useState<Job[]>([]);
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
        fetchWorkers();
    };

    useEffect(() => {
        refreshData();
        const interval = setInterval(refreshData, 3000);
        return () => clearInterval(interval);
    }, []);

    return { jobs, loading, error, workerCount };
}