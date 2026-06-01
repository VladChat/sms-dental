"use client";

import { useEffect, useMemo, useState } from "react";

type TeamMember = {
  email: string;
  role: "owner" | "front_desk" | "admin";
  status: "active";
};

type Props = {
  appBaseUrl: string;
  ownerEmail: string;
  members: TeamMember[];
};

type SampleMember = {
  email: string;
  access: string;
  status: string;
  action: string;
};

const SAMPLE_MEMBERS: SampleMember[] = [
  { email: "frontdesk@example.com", access: "Front desk", status: "Invited", action: "Remove" },
  { email: "reception@example.com", access: "Front desk", status: "Active", action: "Remove" },
  { email: "oldstaff@example.com", access: "Front desk", status: "Access removed", action: "Restore" },
];
const SAMPLE_VISIBILITY_KEY = "mcd_team_samples_hidden";

export function TeamAccessCard({ appBaseUrl, ownerEmail, members }: Props) {
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [samplesHidden, setSamplesHidden] = useState(false);

  const workspaceLink = useMemo(() => {
    const base = (appBaseUrl || "https://app.missedcallsdental.com").replace(/\/+$/, "");
    return `${base}/workspace`;
  }, [appBaseUrl]);

  const normalizedOwnerEmail = ownerEmail.trim().toLowerCase();

  const realMembers = useMemo(() => {
    const seen = new Set<string>();
    const rows = members
      .map((member) => ({
        ...member,
        email: member.email.trim().toLowerCase(),
      }))
      .filter((member) => member.email.length > 0)
      .filter((member) => {
        const key = `${member.email}|${member.role}|${member.status}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    if (!rows.some((member) => member.role === "owner")) {
      rows.unshift({
        email: normalizedOwnerEmail || "owner@example.com",
        role: "owner",
        status: "active",
      });
    }
    return rows;
  }, [members, normalizedOwnerEmail]);

  useEffect(() => {
    try {
      setSamplesHidden(window.localStorage.getItem(SAMPLE_VISIBILITY_KEY) === "1");
    } catch {
      setSamplesHidden(false);
    }
  }, []);

  async function copyWorkspaceLink() {
    setCopyMessage(null);
    if (!navigator?.clipboard?.writeText) {
      setCopyMessage("Copy is not supported in this browser.");
      return;
    }
    try {
      await navigator.clipboard.writeText(workspaceLink);
      setCopyMessage("Workspace link copied.");
    } catch {
      setCopyMessage("Could not copy link. Please copy it manually.");
    }
  }

  function hideSampleBlock() {
    setSamplesHidden(true);
    try {
      window.localStorage.setItem(SAMPLE_VISIBILITY_KEY, "1");
    } catch {
      // no-op when browser storage is unavailable
    }
  }

  function showSampleBlock() {
    setSamplesHidden(false);
    try {
      window.localStorage.removeItem(SAMPLE_VISIBILITY_KEY);
    } catch {
      // no-op when browser storage is unavailable
    }
  }

  return (
    <div style={{ display: "grid", gap: "var(--space-6)" }}>
      <section className="acct-card-subsection" aria-labelledby="team-workspace-title">
        <h3 id="team-workspace-title" className="t-h4">Workspace</h3>
        <p className="t-small" style={{ marginTop: "var(--space-2)" }}>
          Front desk staff use Workspace to review missed-call replies and patient requests.
        </p>
        <div className="field" style={{ marginTop: "var(--space-4)" }}>
          <label>Workspace link</label>
          <input
            className="input acct-readonly t-mono"
            value={workspaceLink}
            readOnly
            aria-readonly="true"
            tabIndex={-1}
          />
        </div>
        <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", marginTop: "var(--space-4)" }}>
          <a className="btn btn-primary" href="/workspace">
            Open workspace
          </a>
          <button type="button" className="btn btn-secondary" onClick={copyWorkspaceLink}>
            Copy link
          </button>
        </div>
        {copyMessage && (
          <p className="t-small" role="status" aria-live="polite" style={{ margin: "var(--space-3) 0 0" }}>
            {copyMessage}
          </p>
        )}
      </section>

      <section className="acct-card-subsection" aria-labelledby="team-invite-title">
        <h3 id="team-invite-title" className="t-h4">Invite staff</h3>
        <p className="t-small" style={{ marginTop: "var(--space-2)" }}>
          Front desk staff get their own sign-in and use Workspace to review patient requests.
        </p>
        {/* Staff invitations are not wired yet. Show an honest disabled preview
            instead of a button that opens a fake "contact support" modal. No
            email is sent and no invite/user/membership is created. */}
        <div className="field" style={{ marginTop: "var(--space-4)" }}>
          <label htmlFor="team-invite-email">Work email</label>
          <input
            id="team-invite-email"
            name="work_email"
            type="email"
            className="input"
            placeholder="frontdesk@example.com"
            autoComplete="off"
            disabled
            aria-disabled="true"
          />
        </div>
        <div className="acct-team-access-row">
          <span className="t-small" style={{ color: "var(--text-secondary)" }}>Access</span>
          <span className="badge badge-neutral">Front desk</span>
        </div>
        <div style={{ marginTop: "var(--space-4)" }}>
          <button type="button" className="btn btn-primary" disabled aria-disabled="true">
            Staff invitations not connected yet
          </button>
          <p className="t-small" style={{ color: "var(--text-muted)", margin: "var(--space-2) 0 0" }}>
            Staff invitations will be connected after team access is wired.
          </p>
        </div>
      </section>

      <section className="acct-card-subsection" aria-labelledby="team-members-title">
        <h3 id="team-members-title" className="t-h4">Team members</h3>
        <div className="acct-team-table-wrap" style={{ marginTop: "var(--space-4)" }}>
          <table className="acct-team-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Access</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {realMembers.map((member) => (
                <tr key={`${member.email}-${member.role}`}>
                  <td className="t-mono">{member.email}</td>
                  <td>{roleLabel(member.role)}</td>
                  <td>{member.status === "active" ? "Active" : member.status}</td>
                  {/* Member management is not connected yet — no fake actions. */}
                  <td style={{ color: "var(--text-muted)" }}>—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!samplesHidden ? (
          <div className="acct-sample-block" style={{ marginTop: "var(--space-5)" }}>
            <div className="acct-sample-head">
              <div style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
                <h4 className="t-h4">Sample staff examples</h4>
                <span className="badge badge-info">Sample</span>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={hideSampleBlock}>
                Hide
              </button>
            </div>
            <p className="t-small" style={{ margin: "var(--space-2) 0 0" }}>
              These examples show how staff access will work. They are not saved.
            </p>

            <div className="acct-team-table-wrap" style={{ marginTop: "var(--space-4)" }}>
              <table className="acct-team-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Access</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {SAMPLE_MEMBERS.map((sample) => (
                    <tr key={sample.email}>
                      <td className="t-mono">{sample.email}</td>
                      <td>{sample.access}</td>
                      <td>{sample.status}</td>
                      {/* Sample rows render the action as plain text — no active
                          button, no modal. */}
                      <td style={{ color: "var(--text-muted)" }}>{sample.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: "var(--space-4)" }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={showSampleBlock}>
              Show sample staff examples
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function roleLabel(role: "owner" | "front_desk" | "admin"): string {
  if (role === "owner") return "Owner";
  if (role === "front_desk") return "Front desk";
  return "Admin";
}
