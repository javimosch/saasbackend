#!/bin/bash

# Stripe Webhook Management Helper Script
# Usage: ./scripts/webhook-admin.sh [command]

BASE_URL="${BASE_URL:-http://localhost:3000/backend}"
ADMIN_AUTH="${ADMIN_AUTH:-admin:admin}"

case "$1" in
  "stats")
    echo "📊 Fetching webhook statistics..."
    RESPONSE=$(curl -s -w "\n%{http_code}" -u "$ADMIN_AUTH" "$BASE_URL/api/admin/stripe-webhooks-stats")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" != "200" ]; then
      echo "❌ Error: HTTP $HTTP_CODE"
      echo "$BODY"
      exit 1
    fi

    if [ -z "$BODY" ] || [ "$BODY" = "null" ]; then
      echo "⚠️  No webhook events found in database"
      exit 0
    fi

    echo "$BODY" | jq
    ;;

  "list")
    STATUS="${2:-}"
    echo "📋 Listing webhooks..."

    if [ -n "$STATUS" ]; then
      URL="$BASE_URL/api/admin/stripe-webhooks?status=$STATUS&limit=20"
    else
      URL="$BASE_URL/api/admin/stripe-webhooks?limit=20"
    fi

    RESPONSE=$(curl -s -w "\n%{http_code}" -u "$ADMIN_AUTH" "$URL")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" != "200" ]; then
      echo "❌ Error: HTTP $HTTP_CODE"
      echo "$BODY"
      exit 1
    fi

    echo "$BODY" | jq
    ;;

  "failed")
    echo "❌ Listing failed webhooks..."
    curl -s -u "$ADMIN_AUTH" "$BASE_URL/api/admin/stripe-webhooks?status=failed&limit=50" | jq
    ;;

  "retry-all")
    LIMIT="${2:-10}"
    echo "🔄 Retrying up to $LIMIT failed webhooks..."
    curl -s -X POST -u "$ADMIN_AUTH" \
      -H "Content-Type: application/json" \
      -d "{\"limit\": $LIMIT, \"maxRetries\": 3}" \
      "$BASE_URL/api/admin/stripe-webhooks/retry" | jq
    ;;

  "retry")
    if [ -z "$2" ]; then
      echo "❌ Error: Event ID required"
      echo "Usage: $0 retry <event_id>"
      exit 1
    fi
    EVENT_ID="$2"
    echo "🔄 Retrying webhook event: $EVENT_ID"
    curl -s -X POST -u "$ADMIN_AUTH" \
      "$BASE_URL/api/admin/stripe-webhooks/$EVENT_ID/retry" | jq
    ;;

  "get")
    if [ -z "$2" ]; then
      echo "❌ Error: Event ID required"
      echo "Usage: $0 get <event_id>"
      exit 1
    fi
    EVENT_ID="$2"
    echo "🔍 Fetching webhook event: $EVENT_ID"
    curl -s -u "$ADMIN_AUTH" "$BASE_URL/api/admin/stripe-webhooks/$EVENT_ID" | jq
    ;;

  "monitor")
    echo "👁️  Monitoring webhook stats (refreshing every 10s)..."
    echo "Press Ctrl+C to stop"
    while true; do
      clear
      echo "=== Webhook Statistics ==="
      date
      echo ""
      curl -s -u "$ADMIN_AUTH" "$BASE_URL/api/admin/stripe-webhooks-stats" | jq
      sleep 10
    done
    ;;

  "health")
    echo "🏥 Checking server health..."

    # Check if server is reachable
    if ! curl -s -f -o /dev/null "$BASE_URL/health" 2>/dev/null; then
      echo "❌ Server is not reachable at $BASE_URL"
      echo "   Make sure the server is running"
      exit 1
    fi

    # Check admin auth
    RESPONSE=$(curl -s -w "\n%{http_code}" -u "$ADMIN_AUTH" "$BASE_URL/api/admin/users?limit=1")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

    if [ "$HTTP_CODE" = "401" ]; then
      echo "❌ Authentication failed"
      echo "   Check ADMIN_AUTH credentials"
      exit 1
    elif [ "$HTTP_CODE" != "200" ]; then
      echo "⚠️  Server returned HTTP $HTTP_CODE"
      exit 1
    fi

    echo "✅ Server is healthy and accessible"
    echo "   URL: $BASE_URL"
    echo "   Auth: $(echo $ADMIN_AUTH | cut -d: -f1):***"
    ;;

  *)
    cat << EOF
Stripe Webhook Management Helper

Usage: $0 <command> [options]

Commands:
  health             Check server connectivity and auth
  stats              Show webhook statistics
  list [status]      List webhooks (optionally filter by status)
  failed             List all failed webhooks
  retry-all [limit]  Retry failed webhooks (default: 10)
  retry <event_id>   Retry a specific webhook event
  get <event_id>     Get details of a specific webhook event
  monitor            Monitor webhook stats in real-time

Environment Variables:
  BASE_URL           API base URL (default: http://localhost:5000)
  ADMIN_AUTH         Admin credentials (default: admin:password)

Examples:
  $0 health
  $0 stats
  $0 list failed
  $0 retry-all 20
  $0 retry evt_1SOiIi2FbGv9GUK55em0jilT
  $0 get evt_1SOiIi2FbGv9GUK55em0jilT
  $0 monitor

EOF
    exit 1
    ;;
esac
