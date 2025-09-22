# Testing the Calendar MCP Server

This document explains how to test the calendar functionality, including getting today's calendar events.

## Quick Test

The easiest way to test the calendar functionality is to run the test script:

```bash
node test-calendar.js
```

This script will:
- ✅ Create all calendar tools successfully
- 🔍 Run a health check
- 📊 List available providers
- 📅 Show today's calendar events (if providers are configured)

## Testing with Real Calendar Data

To test with real calendar data, you need to set up CalDAV credentials as environment variables:

### iCloud Calendar

```bash
export ICLOUD_CALDAV_USERNAME=your@icloud.com
export ICLOUD_CALDAV_PASSWORD=your-app-specific-password
node test-calendar.js
```

**Getting iCloud App-Specific Password:**
1. Go to [appleid.apple.com](https://appleid.apple.com) and sign in
2. Navigate to Security > App-Specific Passwords
3. Generate password for "Calendar MCP Server"
4. Use this password (not your regular Apple ID password)

### Google Calendar

```bash
export GOOGLE_CALDAV_USERNAME=your@gmail.com
export GOOGLE_CALDAV_PASSWORD=your-oauth-token
node test-calendar.js
```

**Getting Google OAuth Token:**
1. Enable Calendar API in Google Cloud Console
2. Create OAuth 2.0 credentials
3. Complete the OAuth flow to get an access token

### Exchange Calendar

```bash
export EXCHANGE_CALDAV_USERNAME=domain\\user
export EXCHANGE_CALDAV_PASSWORD=password
export EXCHANGE_CALDAV_SERVER=https://your-exchange.com
node test-calendar.js
```

### Generic CalDAV Server

```bash
export GENERIC_CALDAV_USERNAME=user
export GENERIC_CALDAV_PASSWORD=password
export GENERIC_CALDAV_SERVER=https://your-server.com
node test-calendar.js
```

## Unit Tests

Run the unit tests to verify functionality without real credentials:

```bash
# Run all tests
pnpm test

# Run specific calendar tests
pnpm test tests/calendar-tools.test.ts

# Run tests with coverage
pnpm test:coverage
```

The unit tests use mocked providers to demonstrate:
- 📋 Calendar tool creation
- 📅 Getting today's events with mock data
- 📊 Calendar listing
- 🔍 Health checks
- 🔐 Access management

## Available Calendar Tools

The server provides these MCP tools:

| Tool Name | Description | Parameters |
|-----------|-------------|------------|
| `get_calendar_events` | Get events for a date range | `startDate`, `endDate`, `calendarIds` |
| `get_calendars` | List all available calendars | None |
| `request_calendar_access` | Request calendar permissions | None |
| `check_calendar_authorization` | Check current permissions | None |
| `list_calendar_providers` | List configured providers | None |
| `switch_calendar_provider` | Switch active provider | `providerId` |
| `health_check` | Check server health | None |

## Example: Getting Today's Events

Here's how to get today's calendar events programmatically:

```javascript
import { CalendarProviderManager } from './dist/providers/CalendarProviderManager.js';
import { createCalendarTools } from './dist/tools/calendar-tools.js';

// Create provider manager and tools
const providerManager = new CalendarProviderManager();
const tools = createCalendarTools({ providerManager, logger });

// Find the events tool
const eventsTool = tools.find(tool => tool.name === 'get_calendar_events');

// Create date range for today
const today = new Date();
const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

// Get today's events
const result = await eventsTool.handler({
  startDate: startOfDay.toISOString(),
  endDate: endOfDay.toISOString(),
  calendarIds: null // Get from all calendars
});

console.log(`Found ${result.count} events for today`);
result.events.forEach(event => {
  console.log(`- ${event.title} (${event.startDate} - ${event.endDate})`);
});
```

## Example Output

When running with real credentials, you should see output like:

```
🗓️  Calendar MCP Server Test

✅ Calendar tools created successfully
📋 Available tools: request_calendar_access, check_calendar_authorization, get_calendars, get_calendar_events, list_calendar_providers, switch_calendar_provider, health_check

🔍 Running health check...
Health Status: ok
Providers: 1
Timestamp: 2024-09-22T10:35:58.824Z

🔍 Checking available providers...
📊 Found 1 provider(s)
🎯 Default provider: caldav-icloud

📅 Getting today's calendar events...
📋 Found 3 event(s) for today
📅 Date range: 2024-09-22T00:00:00.000Z to 2024-09-22T23:59:59.000Z
🔗 Provider: iCloud CalDAV

📝 Today's Events:
  1. Team Meeting
     Start: 9/22/2024, 10:00:00 AM
     End: 9/22/2024, 11:00:00 AM
     Description: Weekly team sync

  2. Lunch Break
     Start: 9/22/2024, 12:00:00 PM
     End: 9/22/2024, 1:00:00 PM
     Location: Cafeteria

  3. Project Review
     Start: 9/22/2024, 2:00:00 PM
     End: 9/22/2024, 3:30:00 PM
     Description: Q3 project review meeting
```

## Troubleshooting

### Common Issues

1. **403 Forbidden Error**: Invalid credentials or insufficient permissions
2. **Connection Refused**: Check server URL and internet connection
3. **No Providers Found**: Set up environment variables for at least one provider
4. **Authentication Failed**: Verify username/password and app-specific passwords

### Debug Mode

Run with debug logging to see detailed information:

```bash
export NODE_ENV=development
node test-calendar.js
```

### Testing Multiple Providers

You can configure multiple providers simultaneously:

```bash
export ICLOUD_CALDAV_USERNAME=your@icloud.com
export ICLOUD_CALDAV_PASSWORD=your-app-password
export GOOGLE_CALDAV_USERNAME=your@gmail.com
export GOOGLE_CALDAV_PASSWORD=your-oauth-token
node test-calendar.js
```

The server will automatically detect and enable all providers with valid credentials.

## Integration with MCP Clients

This server is designed to work with MCP clients like Claude Desktop. The tools are exposed as MCP functions that can be called by AI assistants to interact with your calendar.

For Claude Desktop integration, add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "calendar": {
      "command": "node",
      "args": ["/path/to/calendar-mcp-server/dist/index.js"],
      "env": {
        "ICLOUD_CALDAV_USERNAME": "your@icloud.com",
        "ICLOUD_CALDAV_PASSWORD": "your-app-password"
      }
    }
  }
}
```
