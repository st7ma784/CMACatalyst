# Making GitHub Container Registry Packages Public

## Issue

The CPU worker container at `ghcr.io/st7ma784/cmacatalyst/cpu-worker:latest` cannot be pulled without authentication, preventing compute donors from easily running workers.

## Solution

Make the package public in GitHub Container Registry settings.

## Steps

### 1. Navigate to Package Settings

1. Go to: https://github.com/st7ma784/CMACatalyst
2. Click **Packages** in the right sidebar
3. Find and click on `cpu-worker` package
4. Click **Package settings** (⚙️ icon)

### 2. Change Visibility

1. Scroll to **Danger Zone**
2. Find **Change package visibility**
3. Click **Change visibility**
4. Select **Public**
5. Type the repository name to confirm: `st7ma784/CMACatalyst`
6. Click **I understand, change package visibility**

### 3. Repeat for Other Workers

Do the same for:
- `gpu-worker` package
- `chromadb-worker` package (once built)

### 4. Verify Public Access

Test that anyone can pull without authentication:

```bash
# Should work without docker login
docker pull ghcr.io/st7ma784/cmacatalyst/cpu-worker:latest
docker pull ghcr.io/st7ma784/cmacatalyst/gpu-worker:latest
docker pull ghcr.io/st7ma784/cmacatalyst/chromadb-worker:latest
```

## Alternative: Package Permissions via Web UI

If the package doesn't appear in settings:

1. Go to: https://github.com/users/st7ma784/packages/container/cmacatalyst%2Fcpu-worker/settings
2. Follow same steps as above

## Security Note

Making packages public is safe because:
- ✅ These are containerized services (no secrets embedded)
- ✅ Workers register with coordinator (authentication happens at runtime)
- ✅ Enables the distributed compute model
- ✅ Following open-source best practices

## Documentation Update

Once public, update the documentation to reflect that no authentication is needed:

```bash
# Simple one-liner for compute donors
docker run -d --gpus all ghcr.io/st7ma784/cmacatalyst/gpu-worker:latest
```

## Verification

Check package visibility with API:

```bash
curl https://ghcr.io/v2/st7ma784/cmacatalyst/cpu-worker/tags/list
# Should return tag list without authentication
```
