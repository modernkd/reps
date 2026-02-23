import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";

import type { WorkoutDataSnapshot } from "./db";

const SNAPSHOT_TABLE = "user_workout_snapshots";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

type SnapshotRow = {
  user_id: string;
  payload: WorkoutDataSnapshot;
  updated_at: string;
};

let supabaseClient: SupabaseClient | null | undefined;

function getSupabaseClient(): SupabaseClient | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  if (supabaseClient === undefined) {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  }

  return supabaseClient;
}

export function isCloudSyncConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export async function getCurrentCloudUser(): Promise<User | null> {
  const client = getSupabaseClient();
  if (!client) {
    return null;
  }

  const { data: sessionData, error: sessionError } =
    await client.auth.getSession();
  if (sessionError) {
    throw sessionError;
  }

  if (!sessionData.session?.user) {
    return null;
  }

  const { data, error } = await client.auth.getUser();
  if (error) {
    throw error;
  }

  return data.user ?? sessionData.session.user;
}

export function subscribeToCloudAuthState(
  onChange: (user: User | null) => void,
): (() => void) | null {
  const client = getSupabaseClient();
  if (!client) {
    return null;
  }

  const {
    data: { subscription },
  } = client.auth.onAuthStateChange((_event, session) => {
    onChange(session?.user ?? null);
  });

  return () => {
    subscription.unsubscribe();
  };
}

export async function signInCloudUser(
  email: string,
  password: string,
): Promise<void> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error("Cloud sync is not configured.");
  }

  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw error;
  }
}

export async function signInCloudUserWithGoogle(
  redirectTo?: string,
): Promise<void> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error("Cloud sync is not configured.");
  }

  const { error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: redirectTo ? { redirectTo } : undefined,
  });

  if (error) {
    throw error;
  }
}

export async function signUpCloudUser(
  email: string,
  password: string,
  displayName?: string,
): Promise<{ requiresEmailConfirmation: boolean }> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error("Cloud sync is not configured.");
  }

  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: displayName
      ? {
          data: {
            full_name: displayName,
            name: displayName,
            display_name: displayName,
          },
        }
      : undefined,
  });
  if (error) {
    throw error;
  }

  return {
    requiresEmailConfirmation: !data.session,
  };
}

export async function signOutCloudUser(): Promise<void> {
  const client = getSupabaseClient();
  if (!client) {
    return;
  }

  const { error } = await client.auth.signOut();
  if (error) {
    throw error;
  }
}

export async function updateCloudUserName(displayName: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error("Cloud sync is not configured.");
  }

  const trimmed = displayName.trim();
  if (!trimmed) {
    return;
  }

  const { error } = await client.auth.updateUser({
    data: {
      full_name: trimmed,
      name: trimmed,
      display_name: trimmed,
    },
  });

  if (error) {
    throw error;
  }
}

export async function pullCloudSnapshot(
  userId: string,
): Promise<{ snapshot: WorkoutDataSnapshot | null; updatedAt: string | null }> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error("Cloud sync is not configured.");
  }

  const { data, error } = await client
    .from(SNAPSHOT_TABLE)
    .select("payload,updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const row = data as Pick<SnapshotRow, "payload" | "updated_at"> | null;
  if (!row) {
    return { snapshot: null, updatedAt: null };
  }

  return {
    snapshot: row.payload ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

export async function pushCloudSnapshot(
  userId: string,
  snapshot: WorkoutDataSnapshot,
): Promise<string> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error("Cloud sync is not configured.");
  }

  const updatedAt = new Date().toISOString();
  const payload: SnapshotRow = {
    user_id: userId,
    payload: snapshot,
    updated_at: updatedAt,
  };

  const { error } = await client
    .from(SNAPSHOT_TABLE)
    .upsert(payload, { onConflict: "user_id" });

  if (error) {
    throw error;
  }

  return updatedAt;
}
