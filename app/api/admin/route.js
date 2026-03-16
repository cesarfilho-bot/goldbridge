import { createClient } from "@supabase/supabase-js";

const ADMIN_EMAIL = "cesar.filho@vireo.capital";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(req) {
  // Verify caller is the admin via their JWT
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const token = authHeader.replace("Bearer ", "");
  const { data: { user: caller }, error: callerErr } = await adminSupabase.auth.getUser(token);
  if (callerErr || !caller || caller.email !== ADMIN_EMAIL) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch all auth users
  const { data: { users }, error: usersErr } = await adminSupabase.auth.admin.listUsers({ perPage: 1000 });
  if (usersErr) return Response.json({ error: usersErr.message }, { status: 500 });

  // Fetch user activity (last_seen per user)
  const { data: activity } = await adminSupabase.from("user_activity").select("user_id, last_seen");

  // Fetch all imoveis (user_id + type + city only)
  const { data: imoveis } = await adminSupabase.from("imoveis").select("user_id, type, city");

  // Build lookup maps
  const activityMap = {};
  (activity || []).forEach(a => { activityMap[a.user_id] = a.last_seen; });

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
    };
  }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  // Summary stats
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  const usersThisMonth = users.filter(u => {
    const d = new Date(u.created_at);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }).length;
  const usersPrevMonth = users.filter(u => {
    const d = new Date(u.created_at);
    return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
  }).length;

  return Response.json({
    users: enrichedUsers,
    summary: {
      totalUsers: users.length,
      activeUsers: enrichedUsers.filter(u => u.isAtivo).length,
      totalImoveis: (imoveis || []).length,
      usersThisMonth,
      usersPrevMonth,
    },
  });
}
