"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  UserProfile,
  Organization,
  fetchCurrentUser,
  fetchUserOrganizations,
  checkSystemHealth,
} from "../api-client";

interface OrganizationContextType {
  user: UserProfile | null;
  organizations: Organization[];
  activeOrg: Organization | null;
  loading: boolean;
  error: string | null;
  healthStatus: "healthy" | "unhealthy" | "unavailable";
  switchOrganization: (orgId: string) => void;
  refreshOrganizations: () => Promise<void>;
  refreshHealth: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

const STORAGE_KEY = "finintel_active_org_id";

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [healthStatus, setHealthStatus] = useState<"healthy" | "unhealthy" | "unavailable">("unavailable");

  const refreshHealth = useCallback(async () => {
    try {
      const status = await checkSystemHealth();
      setHealthStatus(status);
    } catch {
      setHealthStatus("unavailable");
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [uData, orgsData] = await Promise.all([
        fetchCurrentUser().catch(() => null),
        fetchUserOrganizations().catch(() => []),
      ]);
      setUser(uData);

      const uniqueOrgs = Array.from(
        new Map(orgsData.map((org) => [org.id, org])).values()
      );
      setOrganizations(uniqueOrgs);

      // Check saved preference or URL param
      const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
      const urlOrgId = urlParams?.get("orgId");
      const savedOrgId = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      const targetId = urlOrgId || savedOrgId;

      if (uniqueOrgs.length > 0) {
        const found = uniqueOrgs.find((o) => o.id === targetId);
        const selected = found || uniqueOrgs[0];
        setActiveOrg(selected);
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY, selected.id);
        }
      } else {
        setActiveOrg(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unable to connect to FinIntel API";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    refreshHealth();
  }, [loadData, refreshHealth]);

  const switchOrganization = useCallback(
    (orgId: string) => {
      const selected = organizations.find((o) => o.id === orgId);
      if (selected) {
        setActiveOrg(selected);
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY, selected.id);
          // Preserve query parameter on URL if user desires
          const url = new URL(window.location.href);
          url.searchParams.set("orgId", selected.id);
          window.history.replaceState({}, "", url.toString());
        }
      }
    },
    [organizations]
  );

  const refreshOrganizations = useCallback(async () => {
    try {
      const orgsData = await fetchUserOrganizations();
      const uniqueOrgs = Array.from(
        new Map(orgsData.map((org) => [org.id, org])).values()
      );
      setOrganizations(uniqueOrgs);
      if (activeOrg) {
        const stillExists = uniqueOrgs.find((o) => o.id === activeOrg.id);
        if (stillExists) {
          setActiveOrg(stillExists);
        } else if (uniqueOrgs.length > 0) {
          setActiveOrg(uniqueOrgs[0]);
        }
      } else if (uniqueOrgs.length > 0) {
        setActiveOrg(uniqueOrgs[0]);
      }
    } catch (err: unknown) {
      console.error("Failed to refresh organizations:", err);
    }
  }, [activeOrg]);

  const contextValue = React.useMemo(
    () => ({
      user,
      organizations,
      activeOrg,
      loading,
      error,
      healthStatus,
      switchOrganization,
      refreshOrganizations,
      refreshHealth,
    }),
    [
      user,
      organizations,
      activeOrg,
      loading,
      error,
      healthStatus,
      switchOrganization,
      refreshOrganizations,
      refreshHealth,
    ]
  );

  return (
    <OrganizationContext.Provider value={contextValue}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization(): OrganizationContextType {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error("useOrganization must be used within an OrganizationProvider");
  }
  return context;
}
