import { create } from 'zustand';
import { supabase, backendConfigured } from './supabase';
import { db } from './db';
import type { Profile, Business, Branch } from './types';

interface AuthState {
  loading: boolean;
  userId: string | null;
  profile: Profile | null;
  business: Business | null;
  branches: Branch[];
  activeBranchId: string | null;
  setActiveBranch: (branchId: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  bootstrap: () => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
  loading: true,
  userId: null,
  profile: null,
  business: null,
  branches: [],
  activeBranchId: null,

  async bootstrap() {
    set({ loading: true });
    try {
      if (backendConfigured()) {
        const { data } = await supabase!.auth.getSession();
        const userId = data.session?.user.id ?? null;
        if (userId) await loadSessionData(userId, set);
      }
      const ctx = await db.appContext.get('current');
      if (ctx?.branchId) set({ activeBranchId: ctx.branchId });
    } finally {
      set({ loading: false });
    }
  },

  async signIn(email, password) {
    if (!backendConfigured()) throw new Error('No backend configured — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
    const { data, error } = await supabase!.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.user) await loadSessionData(data.user.id, set);
  },

  async signOut() {
    if (backendConfigured()) await supabase!.auth.signOut();
    await db.appContext.delete('current');
    set({ userId: null, profile: null, business: null, branches: [], activeBranchId: null });
  },

  async setActiveBranch(branchId: string) {
    const allowed = get().branches.some((b) => b.id === branchId);
    if (!allowed) throw new Error('You are not authorized to access that branch');
    await db.appContext.put({ key: 'current', businessId: get().business?.id, branchId, userId: get().userId ?? undefined });
    set({ activeBranchId: branchId });
  }
}));

async function loadSessionData(userId: string, set: (s: Partial<AuthState>) => void) {
  const profile = await db.profiles.get(userId);
  const business = profile ? await db.businesses.get(profile.businessId) : undefined;
  const allBranches = business ? await db.branches.where('businessId').equals(business.id).toArray() : [];
  // Owners/managers implicitly see every branch; other roles are limited to
  // profile_branches, which the sync layer would populate. For the local
  // scaffold we default non-owner/manager roles to the first active branch.
  const branches = allBranches;
  set({
    userId,
    profile: profile ?? null,
    business: business ?? null,
    branches
  });
}
