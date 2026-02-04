/**
 * Cloudflare Worker: GitHub Webhook → OpenClaw /hooks/agent
 *
 * Transforms GitHub issue/PR webhooks into OpenClaw agent hook format
 * and forwards to the gateway.
 */

const REPO_TO_AGENT = {
  "savestatedev/savestate": "pm-savestate",
  "meshguard/meshguard": "pm-meshguard",
};

export default {
  async fetch(request, env) {
    // Only accept POST
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    // Verify webhook secret (optional but recommended)
    const signature = request.headers.get("x-hub-signature-256");
    // TODO: verify signature with env.GITHUB_WEBHOOK_SECRET

    // Parse GitHub payload
    const event = request.headers.get("x-github-event");
    const payload = await request.json();

    // Only handle issues and pull_request events
    if (!["issues", "pull_request", "issue_comment"].includes(event)) {
      return new Response(JSON.stringify({ ok: true, skipped: true, event }), {
        headers: { "content-type": "application/json" },
      });
    }

    // Get repo and determine target agent
    const repo = payload.repository?.full_name;
    const agentId = REPO_TO_AGENT[repo];

    if (!agentId) {
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: "unmapped repo", repo }),
        {
          headers: { "content-type": "application/json" },
        },
      );
    }

    // Build message based on event type
    let message;
    let sessionKey;

    if (event === "issues") {
      const issue = payload.issue;
      const action = payload.action;
      sessionKey = `github:${repo}:issue:${issue.number}`;

      const labels = (issue.labels || []).map((l) => l.name).join(", ") || "none";

      message = `🐙 GitHub Issue ${action}: ${repo}

**Issue #${issue.number}**: ${issue.title}
**Author**: @${issue.user.login}
**URL**: ${issue.html_url}
**Labels**: ${labels}

**Body**:
${issue.body || "(no description)"}

---
Triage this issue per your AGENTS.md instructions.`;
    } else if (event === "issue_comment") {
      const issue = payload.issue;
      const comment = payload.comment;
      sessionKey = `github:${repo}:issue:${issue.number}`;

      message = `💬 GitHub Comment on Issue #${issue.number}: ${issue.title}

**Commenter**: @${comment.user.login}
**URL**: ${comment.html_url}

**Comment**:
${comment.body}

---
Process this comment per your AGENTS.md instructions.`;
    } else if (event === "pull_request") {
      const pr = payload.pull_request;
      const action = payload.action;
      sessionKey = `github:${repo}:pr:${pr.number}`;

      message = `🔀 GitHub PR ${action}: ${repo}

**PR #${pr.number}**: ${pr.title}
**Author**: @${pr.user.login}
**URL**: ${pr.html_url}
**Base**: ${pr.base.ref} ← ${pr.head.ref}

**Body**:
${pr.body || "(no description)"}

---
Process this PR per your AGENTS.md instructions.`;
    }

    // Forward to OpenClaw
    const openclawPayload = {
      message,
      name: "GitHub",
      agentId,
      sessionKey,
      wakeMode: "now",
      deliver: false,
    };

    const openclawUrl = env.OPENCLAW_GATEWAY_URL || "http://127.0.0.1:18789";
    const openclawToken = env.OPENCLAW_HOOK_TOKEN;

    try {
      const response = await fetch(`${openclawUrl}/hooks/agent`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openclawToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(openclawPayload),
      });

      const result = await response.json();

      return new Response(
        JSON.stringify({
          ok: true,
          event,
          repo,
          agentId,
          sessionKey,
          openclaw: result,
        }),
        {
          headers: { "content-type": "application/json" },
        },
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: error.message,
        }),
        {
          status: 500,
          headers: { "content-type": "application/json" },
        },
      );
    }
  },
};
