---
name: remarkable
description: Manage documents on reMarkable tablets via SSH. Upload PDFs/EPUBs, list library, delete documents. Requires Tailscale or direct SSH access to the device.
metadata: {"clawdbot":{"emoji":"📓","requires":{"bins":["ssh","scp"]}}}
---

# reMarkable

Manage documents on reMarkable tablets over SSH.

## Prerequisites

SSH access to reMarkable via Tailscale (recommended) or local network. Add to `~/.ssh/config`:

```
Host rem
  HostName <TAILSCALE_IP>
  User root
  StrictHostKeyChecking no
  UserKnownHostsFile /dev/null
```

Test: `ssh rem echo ok`

## Document Paths

- Library: `/home/root/.local/share/remarkable/xochitl/`
- Documents: `<uuid>.pdf` + `<uuid>.metadata` + `<uuid>.content`
- Restart UI after changes: `systemctl restart xochitl`

## Upload PDF/EPUB

```bash
# Copy file
scp document.pdf rem:/home/root/

# Create document entry
ssh rem 'cd /home/root/.local/share/remarkable/xochitl && \
  UUID=$(cat /proc/sys/kernel/random/uuid) && \
  cat > ${UUID}.metadata << EOF
{
    "createdTime": "'$(date +%s)'000",
    "lastModified": "'$(date +%s)'000",
    "lastOpened": "0",
    "lastOpenedPage": 0,
    "parent": "",
    "pinned": false,
    "type": "DocumentType",
    "visibleName": "My Document Title"
}
EOF
cp /home/root/document.pdf ${UUID}.pdf && \
echo "{}" > ${UUID}.content && \
systemctl restart xochitl'
```

Adjust `visibleName` and source filename as needed.

## List Documents

```bash
ssh rem 'grep -h visibleName /home/root/.local/share/remarkable/xochitl/*.metadata 2>/dev/null | sed "s/.*: \"//" | sed "s/\".*//"'
```

With UUIDs:
```bash
ssh rem 'for f in /home/root/.local/share/remarkable/xochitl/*.metadata; do echo "$(basename $f .metadata): $(grep visibleName $f | sed "s/.*: \"//" | sed "s/\".*//")" ; done 2>/dev/null'
```

## Delete Document

```bash
# Find UUID by name
ssh rem 'grep -l "Document Name" /home/root/.local/share/remarkable/xochitl/*.metadata'

# Delete (replace UUID)
ssh rem 'rm /home/root/.local/share/remarkable/xochitl/<UUID>.* && systemctl restart xochitl'
```

## Notes

- Device sleeps aggressively; wake screen before SSH
- EPUBs work the same way as PDFs
- `parent` field can reference a folder UUID for organization
- Changes require `systemctl restart xochitl` to appear in UI
