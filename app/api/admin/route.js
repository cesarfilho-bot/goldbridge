import { createClient } from "@supabase/supabase-js";

const ADMIN_EMAIL = "cesar.filho@vireo.capital";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function verifyAdmin(req) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await adminSupabase.auth.getUser(token);
  if (error || !user || user.email !== ADMIN_EMAIL) return null;
  return user;
}

export async function GET(req) {
  const caller = await verifyAdmin(req);
  if (!caller) return Response.json({ error: "Forbidden" }, { status: 403 });

  // Fetch all auth users
  const { data: { users }, error: usersErr } = await adminSupabase.auth.admin.listUsers({ perPage: 1000 });
  if (usersErr) return Response.json({ error: usersErr.message }, { status: 500 });

  // Fetch all data in parallel
  const [
    { data: activity },
    { data: profileRows },
    { data: imoveis },
    { count: totalImoveisCount },
  ] = await Promise.all([
    adminSupabase.from("user_activity").select("user_id, last_seen"),
    adminSupabase.from("profiles").select("*").order("criado_em", { ascending: false }),
    adminSupabase.from("imoveis").select("user_id, type, city"),
    adminSupabase.from("imoveis").select("*", { count: "exact", head: true }),
  ]);

  // Build lookup maps
  const activityMap = {};
  (activity || []).forEach(a => { activityMap[a.user_id] = a.last_seen; });

  const profileStatusMap = {};
  (profileRows || []).forEach(p => { profileStatusMap[p.id] = p.status; });

  const imoveisMap = {};
  (imoveis || []).forEach(im => {
    if (!imoveisMap[im.user_id]) imoveisMap[im.user_id] = [];
    imoveisMap[im.user_id].push(im);
  });

  const now = new Date();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const enrichedUsers = users.map(u => {
    const lastSeen = activityMap[u.id] ? new Date(activityMap[u.id]) : null;
    const userImoveis = imoveisMap[u.id] || [];
    const cidades = [...new Set(userImoveis.map(im => im.city).filter(Boolean))];
    const tipos = [...new Set(userImoveis.map(im => im.type).filter(Boolean))];
    return {
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_seen: activityMap[u.id] || null,
      imoveis_count: userImoveis.length,
      cidades,
      tipos,
      isAtivo: lastSeen && lastSeen > thirtyDaysAgo,
      profileStatus: profileStatusMap[u.id] || null,
    };
  }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  // Summary stats
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  return Response.json({
    users: enrichedUsers,
    profiles: profileRows || [],
    summary: {
      totalUsers: users.length,
      activeUsers: enrichedUsers.filter(u => u.isAtivo).length,
      totalImoveis: totalImoveisCount ?? (imoveis || []).length,
      usersThisMonth: users.filter(u => {
        const d = new Date(u.created_at);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      }).length,
      usersPrevMonth: users.filter(u => {
        const d = new Date(u.created_at);
        return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
      }).length,
    },
  });
}

export async function POST(req) {
  const caller = await verifyAdmin(req);
  if (!caller) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { action, profileId } = await req.json();

  if (action === "aprovar") {
    const { error } = await adminSupabase
      .from("profiles")
      .update({ status: "active", aprovado_em: new Date().toISOString() })
      .eq("id", profileId);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ ok: true });
  }

  if (action === "bloquear") {
    const { error } = await adminSupabase
      .from("profiles")
      .update({ status: "blocked" })
      .eq("id", profileId);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
