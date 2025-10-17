#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║         Git Secrets Cleanup Script                       ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "This script will remove secrets from git history:"
echo "  • OCRDemo/credentials/token.json"
echo "  • OCRDemo/credentials/credentials.json"
echo "  • OCRDemo/.env"
echo ""
echo "⚠️  WARNING: This will rewrite git history!"
echo ""
echo "Prerequisites:"
echo "  ✓ Backup your work first"
echo "  ✓ Rotate your credentials in Google Cloud Console"
echo "  ✓ Update local .env with new credentials"
echo "  ✓ Notify collaborators (they'll need to rebase)"
echo ""
read -p "Have you completed all prerequisites? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Aborted. Please complete prerequisites first."
    echo ""
    echo "Read FIX_GIT_SECRETS.md for detailed instructions."
    exit 1
fi

echo ""
echo "📋 Step 1: Creating backup branch..."
git branch backup-before-secret-cleanup 2>/dev/null || echo "   (backup branch already exists)"

echo ""
echo "📋 Step 2: Checking current git status..."
git status --short

echo ""
read -p "Continue with cleanup? (yes/no): " confirm2
if [ "$confirm2" != "yes" ]; then
    echo "❌ Aborted."
    exit 1
fi

echo ""
echo "🧹 Step 3: Removing secrets from git history..."
echo "   This may take a few minutes..."

# Remove the files from all commits
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch OCRDemo/credentials/token.json OCRDemo/credentials/credentials.json OCRDemo/.env' \
  --prune-empty --tag-name-filter cat -- --all 2>&1 | grep -v "^Rewrite" | grep -v "^rm " || true

echo ""
echo "🧹 Step 4: Cleaning up git references..."
rm -rf .git/refs/original/
git reflog expire --expire=now --all
git gc --prune=now --aggressive 2>&1 | grep -v "^Counting" | grep -v "^Compressing" | grep -v "^Writing" || true

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "📊 Verification:"
echo "   Checking if secrets still exist in history..."

# Check if files still exist in history
TOKEN_CHECK=$(git log --all --full-history -- OCRDemo/credentials/token.json | wc -l)
ENV_CHECK=$(git log --all --full-history -- OCRDemo/.env | wc -l)
CREDS_CHECK=$(git log --all --full-history -- OCRDemo/credentials/credentials.json | wc -l)

if [ "$TOKEN_CHECK" -eq 0 ] && [ "$ENV_CHECK" -eq 0 ] && [ "$CREDS_CHECK" -eq 0 ]; then
    echo "   ✅ All secrets successfully removed from history!"
else
    echo "   ⚠️  Warning: Some files may still be in history"
    echo "      token.json: $TOKEN_CHECK occurrences"
    echo "      .env: $ENV_CHECK occurrences"
    echo "      credentials.json: $CREDS_CHECK occurrences"
fi

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                    NEXT STEPS                             ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "1. Review the changes:"
echo "   git log --oneline -20"
echo ""
echo "2. If everything looks good, force push:"
echo "   git push origin master --force"
echo ""
echo "3. If something went wrong, restore backup:"
echo "   git reset --hard backup-before-secret-cleanup"
echo ""
echo "4. After successful push, commit .gitignore changes:"
echo "   git add .gitignore"
echo "   git commit -m 'Update .gitignore to prevent credential commits'"
echo "   git push origin master"
echo ""
echo "5. Notify collaborators to run:"
echo "   git fetch origin"
echo "   git reset --hard origin/master"
echo ""
echo "⚠️  IMPORTANT: Make sure you've rotated your credentials!"
echo ""
