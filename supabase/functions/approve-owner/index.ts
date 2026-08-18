// Supabase Edge Function: approve-owner
//
// Deploy with: supabase functions deploy approve-owner
// Then set it to require a valid platform-admin JWT (see the auth check
// below) — this function uses the SERVICE ROLE key, which must never be
// shipped to any browser bundle. It only runs here, server-side.
//
// What it does, given an owner_requests.id:
//   1. Verifies the caller is a signed-in platform admin.
//   2. Creates the auth.users row for the new owner (via invite email).
//   3. Creates their businesses, branches (a default "Main Branch"), and
//      profiles (role='owner') rows.
//   4. Marks the owner_request as approved.
// This is the one part of onboarding that genuinely cannot be done safely
// from the browser, because creating auth users requires the service role.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await callerClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401 });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: isAdmin } = await admin.from('platform_admins').select('user_id').eq('user_id', user.id).maybeSingle();
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Not a platform admin' }), { status: 403 });
    }

    const { ownerRequestId } = await req.json();
    const { data: request, error: reqError } = await admin
      .from('owner_requests').select('*').eq('id', ownerRequestId).single();
    if (reqError || !request) {
      return new Response(JSON.stringify({ error: 'Owner request not found' }), { status: 404 });
    }
    if (request.status === 'approved') {
      return new Response(JSON.stringify({ error: 'Already approved' }), { status: 409 });
    }

    // 1. Invite the owner — they'll set their own password via the emailed link.
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(request.email);
    if (inviteError || !invited.user) {
      return new Response(JSON.stringify({ error: inviteError?.message ?? 'Could not invite user' }), { status: 500 });
    }
    const newUserId = invited.user.id;

    // 2. Business
    const { data: business, error: bizError } = await admin.from('businesses').insert({
      owner_id: newUserId, name: request.business_name, email: request.email, phone: request.phone
    }).select().single();
    if (bizError || !business) {
      return new Response(JSON.stringify({ error: bizError?.message ?? 'Could not create business' }), { status: 500 });
    }

    // 3. Default branch
    const { data: branch, error: branchError } = await admin.from('branches').insert({
      business_id: business.id, name: 'Main Branch', status: 'active'
    }).select().single();
    if (branchError || !branch) {
      return new Response(JSON.stringify({ error: branchError?.message ?? 'Could not create branch' }), { status: 500 });
    }

    // 4. Owner profile
    const { error: profileError } = await admin.from('profiles').insert({
      id: newUserId, business_id: business.id, full_name: request.full_name,
      phone: request.phone, role: 'owner', status: 'active'
    });
    if (profileError) {
      return new Response(JSON.stringify({ error: profileError.message }), { status: 500 });
    }

    // 5. Give the owner access to their own branch
    await admin.from('profile_branches').insert({ profile_id: newUserId, branch_id: branch.id });

    // 6. Mark the request approved
    await admin.from('owner_requests').update({
      status: 'approved', decided_by: user.id, decided_at: new Date().toISOString()
    }).eq('id', ownerRequestId);

    return new Response(JSON.stringify({ ok: true, businessId: business.id }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
