"use client";

import { createClient } from "@/lib/supabase/client";
import type {
  Profile,
  BoardItem,
  DailyActivity,
  CrmDocument,
  CrmMessage,
  ChangeRequest,
  CrmService,
  MessageThread,
} from "@/lib/types";
import { ADMIN_BOOTSTRAP_EMAILS } from "@/lib/types";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";

interface AppState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  theme: string;
  items: BoardItem[];
  activities: DailyActivity[];
  documents: CrmDocument[];
  messages: CrmMessage[];
  changeRequests: ChangeRequest[];
  teamProfiles: Profile[];
  services: CrmService[];
  selectedId: string | null;
  search: string;
  type: string;
  owner: string;
  priority: string;
  docFilterItem: string;
  messageThreadWith: string | null;
  messageThreadEmail: string | null;
  messageComposeOpen: boolean;
  inviteFormOpen: boolean;
  editingServiceId: string | null;
  calcQty: Record<string, number>;
  calcDiscount: number;
  calcTax: number;
  teamViewsOpenId: string | null;
  previewDoc: CrmDocument | null;
}

interface AppActions {
  setSelectedId: (id: string | null) => void;
  setSearch: (s: string) => void;
  setType: (t: string) => void;
  setOwner: (o: string) => void;
  setPriority: (p: string) => void;
  setDocFilterItem: (id: string) => void;
  setMessageThreadWith: (id: string | null) => void;
  setMessageThreadEmail: (email: string | null) => void;
  setMessageComposeOpen: (open: boolean) => void;
  setInviteFormOpen: (open: boolean) => void;
  setEditingServiceId: (id: string | null) => void;
  setCalcQty: (qty: Record<string, number>) => void;
  setCalcDiscount: (d: number) => void;
  setCalcTax: (t: number) => void;
  setTeamViewsOpenId: (id: string | null) => void;
  setPreviewDoc: (doc: CrmDocument | null) => void;
  setTheme: (t: string) => void;
  refreshData: () => Promise<void>;
  loadDocuments: () => Promise<void>;
  loadMessages: () => Promise<void>;
  loadTeamProfiles: () => Promise<void>;
  loadServices: () => Promise<void>;
  loadRemoteItems: () => Promise<void>;
  loadRemoteActivities: () => Promise<void>;
  loadChangeRequests: () => Promise<void>;
  signOut: () => Promise<void>;
}

type AppContextType = AppState & AppActions;

const supabase = createClient();

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({
    session: null,
    profile: null,
    loading: true,
    theme: "light",
    items: [],
    activities: [],
    documents: [],
    messages: [],
    changeRequests: [],
    teamProfiles: [],
    services: [],
    selectedId: null,
    search: "",
    type: "all",
    owner: "all",
    priority: "all",
    docFilterItem: "all",
    messageThreadWith: null,
    messageThreadEmail: null,
    messageComposeOpen: false,
    inviteFormOpen: false,
    editingServiceId: null,
    calcQty: {},
    calcDiscount: 0,
    calcTax: 0,
    teamViewsOpenId: null,
    previewDoc: null,
  });

  useEffect(() => {
    const saved = localStorage.getItem("crm-theme");
    if (saved) {
      document.documentElement.dataset.theme = saved;
      setState((s) => ({ ...s, theme: saved }));
    }
  }, []);

  const loadProfile = useCallback(async (session: Session | null) => {
    if (!session) return null;
    const fallback: Profile = {
      user_id: session.user.id,
      email: session.user.email || "",
      role: ADMIN_BOOTSTRAP_EMAILS.includes(session.user.email?.toLowerCase() || "")
        ? "admin"
        : "owner",
      display_name: session.user.email?.split("@")[0] || "User",
      status: "active",
      allowed_views: null,
      phone: "",
      department: "",
      job_title: "",
      start_date: null,
      employee_id: "",
      emergency_contact_name: "",
      emergency_contact_phone: "",
      address: "",
    };

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", session.user.id)
      .single();

    const profile = data || fallback;
    if (profile.status === "suspended") {
      await supabase.auth.signOut();
      return null;
    }
    return profile as Profile;
  }, []);

  const loadRemoteItems = useCallback(async () => {
    const { data } = await supabase
      .from("crm_board_items")
      .select("*")
      .order("created_at", { ascending: false });
    setState((s) => ({ ...s, items: (data as BoardItem[]) || [] }));
  }, []);

  const loadRemoteActivities = useCallback(async () => {
    const { data } = await supabase
      .from("crm_daily_activities")
      .select("*")
      .order("activity_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(80);
    setState((s) => ({ ...s, activities: (data as DailyActivity[]) || [] }));
  }, []);

  const loadDocuments = useCallback(async () => {
    const { data } = await supabase
      .from("crm_documents")
      .select("*")
      .order("created_at", { ascending: false });
    setState((s) => ({ ...s, documents: (data as CrmDocument[]) || [] }));
  }, []);

  const loadMessages = useCallback(async () => {
    const { data } = await supabase
      .from("crm_messages")
      .select("*")
      .order("created_at", { ascending: true });
    setState((s) => ({ ...s, messages: (data as CrmMessage[]) || [] }));
  }, []);

  const loadChangeRequests = useCallback(async () => {
    const { data } = await supabase
      .from("crm_change_requests")
      .select("*")
      .order("requested_at", { ascending: false });
    setState((s) => ({ ...s, changeRequests: (data as ChangeRequest[]) || [] }));
  }, []);

  const loadTeamProfiles = useCallback(async () => {
    const role = state.profile?.role;
    if (role !== "admin" && role !== "manager") {
      setState((s) => ({ ...s, teamProfiles: [] }));
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("user_id,email,role,display_name,status,allowed_views,phone,department,job_title,start_date,employee_id,emergency_contact_name,emergency_contact_phone,address")
      .order("email", { ascending: true });
    setState((s) => ({ ...s, teamProfiles: (data as Profile[]) || [] }));
  }, [state.profile?.role]);

  const loadServices = useCallback(async () => {
    if (state.profile?.role !== "admin") {
      setState((s) => ({ ...s, services: [] }));
      return;
    }
    const { data } = await supabase
      .from("crm_services")
      .select("*")
      .order("name", { ascending: true });
    setState((s) => ({ ...s, services: (data as CrmService[]) || [] }));
  }, [state.profile?.role]);

  const refreshData = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setState((s) => ({ ...s, loading: false, session: null }));
      return;
    }
    const profile = await loadProfile(session);
    setState((s) => ({ ...s, session, profile }));
    await Promise.all([
      loadRemoteItems(),
      loadRemoteActivities(),
      loadDocuments(),
      loadMessages(),
      loadChangeRequests(),
      loadTeamProfiles(),
      loadServices(),
    ]);
    setState((s) => ({ ...s, loading: false }));
  }, [
    loadProfile,
    loadRemoteItems,
    loadRemoteActivities,
    loadDocuments,
    loadMessages,
    loadChangeRequests,
    loadTeamProfiles,
    loadServices,
  ]);

  useEffect(() => {
    refreshData();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        setState((s) => ({
          ...s,
          session: null,
          profile: null,
          items: [],
          activities: [],
          documents: [],
          messages: [],
          changeRequests: [],
          teamProfiles: [],
          services: [],
        }));
      }
      if (session) {
        const profile = await loadProfile(session);
        setState((s) => ({ ...s, session, profile }));
        await Promise.all([
          loadRemoteItems(),
          loadRemoteActivities(),
          loadDocuments(),
          loadMessages(),
          loadChangeRequests(),
          loadTeamProfiles(),
          loadServices(),
        ]);
      }
      setState((s) => ({ ...s, loading: false }));
    });

    const channel = supabase
      .channel("crm_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "crm_board_items" },
        () => loadRemoteItems()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "crm_daily_activities" },
        () => loadRemoteActivities()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "crm_change_requests" },
        () => loadChangeRequests()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "crm_documents" },
        () => loadDocuments()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "crm_services" },
        () => loadServices()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "crm_messages" },
        () => loadMessages()
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const setTheme = useCallback((t: string) => {
    document.documentElement.dataset.theme = t;
    localStorage.setItem("crm-theme", t);
    setState((s) => ({ ...s, theme: t }));
  }, []);

  const setSelectedId = useCallback((id: string | null) => {
    setState((s) => ({ ...s, selectedId: id }));
  }, []);

  const value: AppContextType = {
    ...state,
    setSelectedId,
    setSearch: (s) => setState((prev) => ({ ...prev, search: s })),
    setType: (t) => setState((prev) => ({ ...prev, type: t })),
    setOwner: (o) => setState((prev) => ({ ...prev, owner: o })),
    setPriority: (p) => setState((prev) => ({ ...prev, priority: p })),
    setDocFilterItem: (id) => setState((prev) => ({ ...prev, docFilterItem: id })),
    setMessageThreadWith: (id) => setState((prev) => ({ ...prev, messageThreadWith: id })),
    setMessageThreadEmail: (email) => setState((prev) => ({ ...prev, messageThreadEmail: email })),
    setMessageComposeOpen: (open) => setState((prev) => ({ ...prev, messageComposeOpen: open })),
    setInviteFormOpen: (open) => setState((prev) => ({ ...prev, inviteFormOpen: open })),
    setEditingServiceId: (id) => setState((prev) => ({ ...prev, editingServiceId: id })),
    setCalcQty: (qty) => setState((prev) => ({ ...prev, calcQty: qty })),
    setCalcDiscount: (d) => setState((prev) => ({ ...prev, calcDiscount: d })),
    setCalcTax: (t) => setState((prev) => ({ ...prev, calcTax: t })),
    setTeamViewsOpenId: (id) => setState((prev) => ({ ...prev, teamViewsOpenId: id })),
    setPreviewDoc: (doc) => setState((prev) => ({ ...prev, previewDoc: doc })),
    refreshData,
    loadDocuments,
    loadMessages,
    loadTeamProfiles,
    loadServices,
    loadRemoteItems,
    loadRemoteActivities,
    loadChangeRequests,
    signOut,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export function useSupabase() {
  return supabase;
}
