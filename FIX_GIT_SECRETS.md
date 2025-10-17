# How to Fix Git Push with Secrets in History

## Problem
GitHub is blocking your push because commit `9cad8e2` contains secrets:
- `OCRDemo/credentials/token.json` - Google OAuth token
- `OCRDemo/.env` - Client ID and Secret
- `OCRDemo/credentials/credentials.json` - OAuth credentials

Even though these files are now in `.gitignore`, they still exist in git history.

## Solution Options

### Option 1: Quick Fix - Allow the secrets on GitHub (NOT RECOMMENDED)
GitHub provides URLs to allow these secrets, but **this is not secure** and should only be used if:
- These credentials are already rotated/revoked
- This is a temporary measure while you fix properly

URLs to allow (from error message):
- Token: https://github.com/st7ma784/CMACatalyst/security/secret-scanning/unblock-secret/341AVnwT4vR7faesou8o6lVALDo
- Client ID: https://github.com/st7ma784/CMACatalyst/security/secret-scanning/unblock-secret/341AVnBHVkCscslOGh85ufLO9AR
- Client Secret: https://github.com/st7ma784/CMACatalyst/security/secret-scanning/unblock-secret/341AVtQ0S4Rj8sYkL4UDazLrEG6

### Option 2: Remove Secrets from Git History (RECOMMENDED)

This will rewrite git history to remove the secrets entirely.

#### Prerequisites
1. **ROTATE YOUR CREDENTIALS FIRST!** Since they were exposed:
   - Go to Google Cloud Console
   - Delete the exposed OAuth credentials
   - Generate new credentials
   - Update your local `.env` file with new credentials
   - Never commit the new credentials

2. **Backup your work:**
   ```bash
   git branch backup-before-cleanup
   ```

#### Method A: Using git-filter-repo (Fastest, but requires installation)

Install git-filter-repo:
```bash
# Ubuntu/Debian
sudo apt-get install git-filter-repo

# macOS
brew install git-filter-repo

# Or via pip
pip install git-filter-repo
```

Then run:
```bash
# Remove the files from history
git filter-repo --path OCRDemo/credentials/token.json --invert-paths
git filter-repo --path OCRDemo/credentials/credentials.json --invert-paths
git filter-repo --path OCRDemo/.env --invert-paths

# Force push (WARNING: This rewrites history)
git push origin master --force
```

#### Method B: Using git filter-branch (Built-in, slower)

Run the provided script:
```bash
cd /home/user/Documents/catalyst/CascadeProjects/windsurf-project
/tmp/fix_git_secrets.sh
```

Or manually:
```bash
# Remove the files from all commits
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch OCRDemo/credentials/token.json OCRDemo/credentials/credentials.json OCRDemo/.env' \
  --prune-empty --tag-name-filter cat -- --all

# Clean up
rm -rf .git/refs/original/
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push
git push origin master --force
```

#### Method C: Alternative - Remove just the problem commit

If you want to avoid rewriting all history, you can remove just the problematic commits:

```bash
# Interactive rebase to edit the problem commit
git rebase -i 9cad8e2^

# In the editor, change 'pick' to 'edit' for commit 9cad8e2
# Save and close

# Remove the files from this commit
git rm --cached OCRDemo/credentials/token.json
git rm --cached OCRDemo/credentials/credentials.json
git rm --cached OCRDemo/.env

# Amend the commit
git commit --amend --no-edit

# Continue rebase
git rebase --continue

# Force push
git push origin master --force
```

### Option 3: Create Fresh Commits (Easiest but loses history)

If you don't need the commit history:

```bash
# Create a new branch from the remote
git fetch origin
git checkout -b clean-start origin/master

# Cherry-pick only the commits you want (skip 9cad8e2)
git cherry-pick <good-commit-1>
git cherry-pick <good-commit-2>
# etc...

# Force push
git push origin clean-start:master --force
```

## After Fixing

1. **Verify secrets are gone:**
   ```bash
   git log --all --full-history -- OCRDemo/credentials/token.json
   git log --all --full-history -- OCRDemo/.env
   ```

   These should return no results.

2. **Update .gitignore:**
   Already updated with:
   ```
   OCRDemo/.env
   OCRDemo/.env.local
   OCRDemo/credentials/*
   OCRDemo/credentials/token.json
   OCRDemo/credentials/credentials.json
   OCRDemo/data/*.db
   OCRDemo/logs/*.log
   ```

3. **Commit .gitignore changes:**
   ```bash
   git add .gitignore
   git commit -m "Update .gitignore to prevent credential commits"
   ```

4. **Push:**
   ```bash
   git push origin master
   ```

5. **Notify collaborators:**
   They will need to sync:
   ```bash
   git fetch origin
   git reset --hard origin/master
   ```

## Prevention

To prevent this in the future:

1. **Use pre-commit hooks:**
   ```bash
   pip install pre-commit

   # Create .pre-commit-config.yaml
   cat > .pre-commit-config.yaml << 'EOF'
   repos:
   - repo: https://github.com/pre-commit/pre-commit-hooks
     rev: v4.5.0
     hooks:
     - id: detect-private-key
     - id: check-added-large-files

   - repo: https://github.com/Yelp/detect-secrets
     rev: v1.4.0
     hooks:
     - id: detect-secrets
   EOF

   pre-commit install
   ```

2. **Use environment templates:**
   - Keep `.env.example` with dummy values
   - Add `.env` to `.gitignore`
   - Document required variables

3. **Use secret management:**
   - Store secrets in environment variables
   - Use services like AWS Secrets Manager, HashiCorp Vault
   - Use GitHub Secrets for CI/CD

## Recommended Steps (In Order)

1. ✅ **First: ROTATE your exposed credentials immediately**
   - Google Cloud Console → Delete OAuth app
   - Create new OAuth credentials
   - Update local files (but don't commit)

2. ✅ **Second: Run the cleanup script**
   ```bash
   /tmp/fix_git_secrets.sh
   ```

3. ✅ **Third: Verify and push**
   ```bash
   git log --oneline -20  # Verify history looks good
   git push origin master --force
   ```

4. ✅ **Fourth: Update .gitignore and commit**
   ```bash
   git add .gitignore
   git commit -m "Update .gitignore to prevent credential commits"
   git push origin master
   ```

5. ✅ **Fifth: Set up pre-commit hooks** (optional but recommended)

## Need Help?

- Check if cleanup worked: `git log --all --full-history -- OCRDemo/.env`
- Restore backup: `git checkout backup-before-cleanup`
- Check GitHub documentation: https://docs.github.com/en/code-security/secret-scanning/working-with-secret-scanning-and-push-protection

## WARNING

⚠️ **Force pushing rewrites history.** If others have cloned this repo:
1. Warn them before force pushing
2. They'll need to: `git fetch origin && git reset --hard origin/master`
3. Any local uncommitted changes will be lost
4. Any local commits will need to be rebased

## Security Checklist

- [ ] OAuth credentials rotated in Google Cloud Console
- [ ] New credentials updated in local `.env` file
- [ ] Secrets removed from git history
- [ ] `.gitignore` updated
- [ ] Pre-commit hooks installed (optional)
- [ ] Force pushed to GitHub
- [ ] Verified secrets no longer in history
- [ ] Collaborators notified (if any)
