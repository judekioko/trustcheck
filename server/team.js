import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "./db.js";
import { getPlan } from "./plans.js";

export function listMembers(orgId) {
  return db
    .prepare("SELECT id, name, email, role, created_at FROM users WHERE org_id = ? ORDER BY created_at ASC")
    .all(orgId)
    .map((r) => ({ id: r.id, name: r.name, email: r.email, role: r.role, createdAt: r.created_at }));
}

export function countMembers(orgId) {
  return db.prepare("SELECT COUNT(*) AS n FROM users WHERE org_id = ?").get(orgId).n;
}

export function listPendingInvites(orgId) {
  return db
    .prepare(
      "SELECT id, email, role, token, created_at FROM invites WHERE org_id = ? AND accepted_at IS NULL ORDER BY created_at DESC"
    )
    .all(orgId);
}

export function createInvite(org, invitedBy, { email, role }) {
  const plan = getPlan(org.plan);
  const currentMembers = countMembers(org.id);
  const pendingInvites = listPendingInvites(org.id).length;
  if (currentMembers + pendingInvites >= plan.maxTeamMembers) {
    const err = new Error(
      `Your ${plan.name} plan allows up to ${plan.maxTeamMembers} team member(s). Upgrade to invite more.`
    );
    err.code = "TEAM_LIMIT_REACHED";
    throw err;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(normalizedEmail);
  if (existing) {
    const err = new Error("Someone with that email already has an account");
    err.code = "EMAIL_TAKEN";
    throw err;
  }

  const token = crypto.randomBytes(24).toString("hex");
  db.prepare(
    "INSERT INTO invites (org_id, email, role, token, invited_by) VALUES (?, ?, ?, ?, ?)"
  ).run(org.id, normalizedEmail, role === "owner" ? "owner" : "staff", token, invitedBy.id);

  return { token, email: normalizedEmail, role: role === "owner" ? "owner" : "staff" };
}

export function getInviteByToken(token) {
  return db.prepare("SELECT * FROM invites WHERE token = ?").get(token);
}

export async function acceptInvite({ token, name, password }) {
  const invite = getInviteByToken(token);
  if (!invite) {
    const err = new Error("This invite link is invalid or has expired");
    err.code = "INVITE_NOT_FOUND";
    throw err;
  }
  if (invite.accepted_at) {
    const err = new Error("This invite has already been used");
    err.code = "INVITE_USED";
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  db.exec("BEGIN");
  try {
    const insert = db
      .prepare(
        "INSERT INTO users (org_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)"
      )
      .run(invite.org_id, name.trim(), invite.email, passwordHash, invite.role);
    db.prepare("UPDATE invites SET accepted_at = datetime('now') WHERE id = ?").run(invite.id);
    db.exec("COMMIT");
    return Number(insert.lastInsertRowid);
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export function removeMember(org, requestingUser, memberId) {
  if (memberId === requestingUser.id) {
    const err = new Error("You can't remove your own account");
    err.code = "CANNOT_REMOVE_SELF";
    throw err;
  }
  const info = db
    .prepare("DELETE FROM users WHERE id = ? AND org_id = ?")
    .run(memberId, org.id);
  return info.changes > 0;
}
