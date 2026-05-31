"use client";

import { useMemo, useState } from "react";

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
  sample: true;
};

const SAMPLE_MEMBERS: SampleMember[] = [
  { email: "frontdesk@example.com", access: "Front desk", status: "Invited", sample: true },
  { email: "reception@example.com", access: "Front desk", status: "Active", sample: true },
  { email: "oldstaff@example.com", access: "Front desk", status: "Access removed", sample: true },
];

export function TeamAccessCard({ appBaseUrl, ownerEmail, members }: Props) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);

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

  const hasRealStaff = realMembers.some((member) => member.role !== "owner");

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

  function onSendInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInviteError(null);
    const candidate = inviteEmail.trim().toLowerCase();
    if (!candidate) {
      setInviteError("Enter a work email.");
      return;
    }
    if (candidate === normalizedOwnerEmail) {
      setInviteError("This email already has owner access.");
      return;
    }
    setShowInviteModal(true);
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
        <p className="t-helper" style={{ margin: "var(--space-3) 0 0" }}>
          Staff can use this link after they accept an invitation.
        </p>
        {copyMessage && (
          <p className="t-small" role="status" aria-live="polite" style={{ margin: "var(--space-2) 0 0" }}>
            {copyMessage}
          </p>
        )}
      </section>

      <section className="acct-card-subsection" aria-labelledby="team-invite-title">
        <h3 id="team-invite-title" className="t-h4">Invite staff</h3>
        <p className="t-small" style={{ marginTop: "var(--space-2)" }}>
          Send an invitation to a front desk team member. They will create their own password and use Workspace to review patient requests.
        </p>
        <form onSubmit={onSendInvite} className="acct-form" style={{ marginTop: "var(--space-4)" }} noValidate>
          <div className="field">
            <label htmlFor="team-invite-email">Work email</label>
            <input
              id="team-invite-email"
              name="work_email"
              type="email"
              className="input"
              placeholder="frontdesk@example.com"
              autoComplete="email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              required
              spellCheck={false}
            />
          </div>

          <div className="acct-team-access-row">
            <span className="t-small" style={{ color: "var(--text-secondary)" }}>Access</span>
            <span className="badge badge-neutral">Front desk</span>
          </div>

          {inviteError && (
            <div className="alert alert-error" role="alert" aria-live="polite">
              <span>{inviteError}</span>
            </div>
          )}

          <div>
            <button type="submit" className="btn btn-primary">Send invite</button>
          </div>
        </form>
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
                  <td>—</td>
                </tr>
              ))}
              {!hasRealStaff &&
                SAMPLE_MEMBERS.map((sample) => (
                  <tr key={sample.email}>
                    <td className="t-mono">{sample.email}</td>
                    <td>{sample.access}</td>
                    <td>{sample.status}</td>
                    <td><span className="badge badge-info">Sample</span></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      {showInviteModal && (
        <div className="acct-modal-backdrop" role="presentation" onClick={() => setShowInviteModal(false)}>
          <div
            className="acct-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-invite-placeholder-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="team-invite-placeholder-title" className="t-h4">Team access</h3>
            <p className="t-small" style={{ margin: 0 }}>
              Staff invitations will be available after team access is connected.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowInviteModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function roleLabel(role: "owner" | "front_desk" | "admin"): string {
  if (role === "owner") return "Owner";
  if (role === "front_desk") return "Front desk";
  return "Admin";
}
