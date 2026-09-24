import { db } from "./db.js";

export function getOverview() {
  const totalOrgs = db.prepare("SELECT COUNT(*) AS n FROM organizations").get().n;
  const totalUsers = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
  const activeSubscriptions = db
    .prepare("SELECT COUNT(*) AS n FROM organizations WHERE plan = 'pro' AND subscription_status = 'active'")
    .get().n;
  const checksThisMonth = db
    .prepare(
      "SELECT COUNT(*) AS n FROM checks WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')"
    )
    .get().n;
  const totalChecks = db.prepare("SELECT COUNT(*) AS n FROM checks").get().n;
  const revenueKES = db
    .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE status = 'success'")
    .get().total;
  const highRiskChecks = db
    .prepare("SELECT COUNT(*) AS n FROM checks WHERE overall_risk = 'HIGH'")
    .get().n;

  return {
    totalOrgs,
    totalUsers,
    activeSubscriptions,
    checksThisMonth,
    totalChecks,
    highRiskChecks,
    revenueKES,
  };
}

export function listOrganizations(limit = 100) {
  return db
    .prepare(
      `SELECT o.id, o.name, o.plan, o.subscription_status, o.current_period_end, o.created_at,
              (SELECT COUNT(*) FROM users u WHERE u.org_id = o.id) AS member_count,
              (SELECT COUNT(*) FROM checks c WHERE c.org_id = o.id) AS check_count
       FROM organizations o
       ORDER BY o.created_at DESC
       LIMIT ?`
    )
    .all(limit)
    .map((r) => ({
      id: r.id,
      name: r.name,
      plan: r.plan,
      subscriptionStatus: r.subscription_status,
      currentPeriodEnd: r.current_period_end,
      createdAt: r.created_at,
      memberCount: r.member_count,
      checkCount: r.check_count,
    }));
}
