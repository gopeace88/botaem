#!/bin/bash
# System status helper script

echo "### 📁 Skills"
find .claude/skills -name "SKILL.md" 2>/dev/null | while read f; do
    name=$(dirname "$f" | xargs basename)
    desc=$(grep -m1 'description:' "$f" | sed 's/description: //')
    echo "- $name: $desc"
done

echo ""
echo "### 🤖 Agents"
find .claude/agents -name "*.md" 2>/dev/null | while read f; do
    name=$(basename "$f" .md)
    desc=$(grep -m1 'description:' "$f" | sed 's/description: //' | cut -c1-80)
    echo "- $name: $desc..."
done

echo ""
echo "### ⚡ Commands"
find .claude/commands -name "*.md" 2>/dev/null | while read f; do
    name=$(basename "$f" .md)
    desc=$(grep -m1 'description:' "$f" | sed 's/description: //')
    echo "- /$name: $desc"
done

echo ""
echo "### 🔧 Hooks"
if [ -f .claude/settings.json ]; then
    cat .claude/settings.json | jq -r '.hooks | to_entries[] | "- \(.key): \(.value | length) matcher(s)"' 2>/dev/null
else
    echo "No hooks configured"
fi
