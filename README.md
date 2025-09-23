# Calendar MCP Server
![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/unravellingtechnologies/calendar-mcp-server?utm_source=oss&utm_medium=github&utm_campaign=unravellingtechnologies%2Fcalendar-mcp-server&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

A Model Context Protocol (MCP) server that provides calendar integration for Claude Desktop and other MCP-compatible clients. This server enables AI assistants to access, read, and manage calendar data across multiple calendar providers.

## Features

### ✅ **Multi-Provider Calendar Support**
- **Apple Calendar (macOS)** via native EventKit integration. Provides access to **all** accounts synced with the macOS Calendar app (iCloud, Google, Exchange, etc.).
- **iCloud Calendar** via CalDAV (cross-platform).
- **Generic CalDAV servers** (cross-platform).
- **Google Calendar** (planned).
- **Microsoft Exchange** (planned).

### ✅ **MCP Tools Available**
- `request_calendar_access` - Request permission to access calendar data
- `check_calendar_authorization` - Check current authorization status
- `get_calendars` - List all available calendars
- `get_calendar_events` - Fetch events within date ranges
- `list_calendar_providers` - Show available calendar providers
- `switch_calendar_provider` - Switch between calendar providers
- `health_check` - Server health and status

### ✅ **Architecture & Code Organization**
- **Modular tool system** with factory pattern for easy extension
- **Type-safe interfaces** for all tool inputs and outputs
- **Clean separation** between tool definitions and server logic
- **Comprehensive error handling** and logging throughout

### ✅ **Security & Configuration**
- **Environment variable support** for secure credential management
- **Input validation** for serverType values to prevent injection attacks
- **Optional encryption** for stored credentials using AES-256-GCM
- **Command-line arguments** for development and testing
- **Cross-platform compatibility** (macOS, Windows, Linux)
- **Comprehensive error handling** and logging

## Installation

### Prerequisites
- Node.js 18+ 
- npm or pnpm
- For iCloud: App-specific password (see setup below)

### Install Dependencies
```bash
pnpm install
```

### Build the Project
This command compiles the TypeScript source code.
```bash
pnpm run build
```

### Build the Native Addon (macOS only)
If you are on macOS and want to use the EventKit provider, you need to build the native C++ addon.
```bash
pnpm run build:addon
```

### Test the Calendar Functionality
```bash
# Quick test (shows available tools and setup instructions)
node test-calendar.js

# Run unit tests
pnpm test

# See TESTING.md for detailed testing instructions
```

## Setup

### iCloud Calendar Setup (Recommended)

1. **Enable 2FA** on your Apple ID at [appleid.apple.com](https://appleid.apple.com)

2. **Generate App-Specific Password:**
   - Go to [appleid.apple.com](https://appleid.apple.com) → Security → App-Specific Passwords
   - Click "Generate password" 
   - Name it "Calendar MCP Server"
   - Copy the generated password (format: `xxxx-xxxx-xxxx-xxxx`)

3. **Set Environment Variables:**
   ```bash
   export CALDAV_USERNAME="your-apple-id@icloud.com"
   export CALDAV_PASSWORD="xxxx-xxxx-xxxx-xxxx"
   ```

   Or create a `.env` file:
   ```env
   CALDAV_USERNAME=your-apple-id@icloud.com
   CALDAV_PASSWORD=xxxx-xxxx-xxxx-xxxx
   ```

   **Optional: Enable Credential Encryption**
   ```bash
   export CALDAV_ENCRYPTION_KEY="your-encryption-key-here"
   ```

   Or add to `.env`:
   ```env
   CALDAV_ENCRYPTION_KEY=your-encryption-key-here
   ```

### Apple Calendar / EventKit Setup (macOS only)

The EventKit provider offers direct access to the native macOS Calendar application, allowing you to see events from all accounts you have synced there (iCloud, Google, Exchange, etc.).

**1. Build Prerequisites:**
You must have the Xcode Command Line Tools installed. If you don't have them, run:
```bash
xcode-select --install
```

**2. Build the Addon:**
Compile the native C++ module that communicates with EventKit.
```bash
pnpm run build:addon
```

**3. Enable the Provider:**
You must explicitly enable the EventKit provider when running the server using one of the methods below.

## Usage

### Standalone Server
```bash
# To use the EventKit provider (macOS only)
node dist/index.js --enable-eventkit

# To use the CalDAV provider (cross-platform)
# With environment variables (recommended)
node dist/index.js --caldav-provider=icloud --enable-caldav

# With command-line arguments (development)
node dist/index.js --caldav-username="your@icloud.com" --caldav-password="xxxx-xxxx-xxxx-xxxx" --caldav-provider=icloud --enable-caldav

# Enable debug logging
node dist/index.js --caldav-provider=icloud --enable-caldav --log-level=debug
```

### Claude Desktop Integration

Add to your `~/.claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "calendar": {
      "command": "node",
      "args": ["/path/to/calendar-mcp-server/dist/index.js", "--enable-eventkit"],
      "env": {}
    }
  }
}
```

**For CalDAV:**
```json
{
  "mcpServers": {
    "calendar": {
      "command": "node",
      "args": ["/path/to/calendar-mcp-server/dist/index.js", "--caldav-provider=icloud", "--enable-caldav"],
      "env": {
        "CALDAV_USERNAME": "your-apple-id@icloud.com",
        "CALDAV_PASSWORD": "xxxx-xxxx-xxxx-xxxx"
      }
    }
  }
}
```

## Command-Line Options

### CalDAV Options
- `--caldav-provider <type>` - Provider type: `icloud`, `google`, `exchange`, `generic` (default: `icloud`)
- `--caldav-server <url>` - CalDAV server URL (auto-detected for known providers)
- `--caldav-username <username>` - Username (or use `CALDAV_USERNAME` env var)
- `--caldav-password <password>` - Password (or use `CALDAV_PASSWORD` env var)
- `--caldav-encryption-key <key>` - Encryption key for stored credentials (or use `CALDAV_ENCRYPTION_KEY` env var)

### Server Options
- `--enable-caldav` - Enable CalDAV provider (default: true)
- `--enable-eventkit` - Enable EventKit provider (macOS only, default: false)
- `--log-level <level>` - Logging level: `debug`, `info`, `warn`, `error` (default: `info`)
- `--dev` - Development mode with enhanced error reporting
- `--verbose` - Verbose logging output

## Architecture

### Multi-Provider System
The server uses a provider-based architecture that abstracts calendar operations behind a common interface:

```
┌─────────────────────────────────────────────────────────┐
│                    MCP Server                           │
├─────────────────────────────────────────────────────────┤
│                Provider Manager                         │
├─────────────────────────────────────────────────────────┤
│  CalDAVProvider  │  GoogleProvider  │  ExchangeProvider │
│  (ts-caldav)     │    (planned)     │     (planned)     │
└─────────────────────────────────────────────────────────┘
```

### Technology Stack
- **MCP SDK** - Model Context Protocol implementation
- **TypeScript** - Type-safe development
- **Node Addon API** - For building the native C++ EventKit bridge
- **node-gyp** - For compiling the native addon
- **ts-caldav** - CalDAV client library for cross-platform calendar access
- **Zod** - Runtime type validation
- **Commander.js** - Command-line interface

## Development

### Project Structure
```
src/
├── index.ts                 # Main server entry point
├── server/                  # MCP server core
├── providers/               # Calendar provider implementations
│   ├── CalendarProvider.ts  # Base provider interface
│   ├── CalDAVProvider.ts    # CalDAV implementation
│   └── EventKitProvider.ts  # Native macOS EventKit provider
├── native/                  # Native C++ source for EventKit
│   └── eventkit.mm          # Objective-C++ implementation
├── tools/                   # MCP tool system
├── cli/                     # Command-line interface
├── config/                  # Configuration management
└── utils/                   # Utilities and logging
```

### Build Commands
```bash
# Clean build artifacts
pnpm run clean

# TypeScript compilation
pnpm run build

# Build the native addon (macOS only)
pnpm run build:addon

# Development build with watch
pnpm run dev

# Run tests
pnpm test
```

### Testing
```bash
# Test CalDAV connection
node test-ts-caldav.mjs --username=your@icloud.com --password=xxxx-xxxx-xxxx-xxxx

# Test alternative iCloud servers
node test-alternative-servers.mjs --username=your@icloud.com --password=xxxx-xxxx-xxxx-xxxx

# Test MCP server directly
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "get_calendars", "arguments": {}}}' | CALDAV_USERNAME=your@icloud.com CALDAV_PASSWORD=xxxx-xxxx-xxxx-xxxx node dist/index.js
```

## Troubleshooting

### Common Issues

**❌ "Invalid credentials" Error**
- Verify your Apple ID and app-specific password
- Ensure 2FA is enabled on your Apple ID
- Check that Calendar sync is enabled in iCloud settings
- Try alternative server URLs: `p01-caldav.icloud.com`, `p02-caldav.icloud.com`


**❌ "No calendars found"**
- Verify calendar sync is enabled in iCloud settings
- Check that you have calendars configured in your iCloud account
- Try the `get_calendars` tool to see available calendars

**❌ Server fails to start**
- Check that all dependencies are installed: `pnpm install`
- Verify the build completed successfully: `pnpm run build`
- Enable debug logging: `--log-level=debug`

**❌ "No calendar providers configured" Warning**
- This warning appears when neither CalDAV credentials nor EventKit are configured
- **Solution 1**: Enable EventKit (macOS only): `--enable-eventkit`
- **Solution 2**: Set CalDAV credentials via environment variables (see Setup section)
- **Solution 3**: Use both EventKit and CalDAV for maximum compatibility

**❌ EventKit Permission Issues in Claude Desktop**
- EventKit permissions don't appear in System Preferences for MCP servers
- **SOLUTION**: Run this command in Terminal to trigger the permission dialog:
  ```bash
  node /path/to/calendar-mcp-server/dist/index.js --enable-eventkit --request-permissions
  ```
- Grant permission when the macOS dialog appears
- If permissions were previously denied, reset them first:
  ```bash
  tccutil reset Calendar
  node /path/to/calendar-mcp-server/dist/index.js --enable-eventkit --request-permissions
  ```

### Debug Mode
```bash
# Enable comprehensive debugging with EventKit
node dist/index.js --enable-eventkit --log-level=debug --dev --verbose

# Enable debugging with CalDAV credentials
ICLOUD_CALDAV_USERNAME=your@icloud.com ICLOUD_CALDAV_PASSWORD=your-password node dist/index.js --log-level=debug --dev --verbose
```

## API Reference

### MCP Tools

#### `get_calendar_events`
Fetch calendar events within a date range.

**Parameters:**
- `startDate` (string, required) - ISO 8601 date (e.g., "2024-01-01T00:00:00.000Z")
- `endDate` (string, required) - ISO 8601 date (e.g., "2024-01-31T23:59:59.999Z") 
- `calendarIds` (string[], optional) - Filter by specific calendar IDs

**Example:**
```json
{
  "name": "get_calendar_events",
  "arguments": {
    "startDate": "2024-12-01T00:00:00.000Z",
    "endDate": "2024-12-31T23:59:59.999Z"
  }
}
```

#### `get_calendars`
List all available calendars.

**Parameters:** None

**Returns:** Array of calendar objects with `id`, `title`, `color`, `isReadOnly`, `source`

#### `list_calendar_providers`
Show available calendar providers and their capabilities.

**Parameters:** None

**Returns:** Provider information including capabilities and status

## Security

### Credential Management
- **Environment Variables** (recommended) - Credentials stored in environment, not visible in process lists
- **Command-line Arguments** (development only) - Visible in process lists, use only for testing
- **Optional Encryption** - Stored credentials can be encrypted using AES-256-GCM when `CALDAV_ENCRYPTION_KEY` is provided
- **Multiple Storage Backends** - Memory, environment variables, or macOS Keychain (when available)

### Privacy
- **Read-only access** - Server only reads calendar data, no modifications without explicit permission
- **Local processing** - All calendar data stays on your machine
- **No data transmission** - Server doesn't send calendar data to external services

### Encryption Details
When `CALDAV_ENCRYPTION_KEY` is provided, the server uses:
- **Algorithm**: AES-256-GCM (Galois/Counter Mode) for authenticated encryption
- **Key Derivation**: scrypt with random salt for secure key generation
- **Scope**: Only the password field is encrypted; other metadata remains in plain text
- **Security**: Each encryption uses a unique random IV and authentication tag
- **Compatibility**: Encrypted credentials are automatically decrypted when retrieved

## Roadmap

### Planned Features
- [ ] **Event Creation/Modification** - Create, update, and delete calendar events
- [ ] **Google Calendar Integration** - OAuth-based Google Calendar support
- [ ] **Microsoft Exchange Support** - Enterprise calendar integration
- [ ] **Recurring Event Support** - Advanced recurrence pattern handling
- [ ] **Calendar Subscriptions** - Support for calendar subscription URLs
- [ ] **Event Attachments** - Handle file attachments in calendar events
- [ ] **Meeting Integration** - Zoom/Teams meeting link handling

### Known Limitations
- **Event modification** not yet implemented (read-only currently)
- **Recurring events** may not display all occurrences correctly
- **Time zone handling** uses system time zone only
- **Large calendars** may have performance limitations

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes with tests
4. Run the build: `pnpm run build`
5. Submit a pull request

### Development Guidelines
- Follow TypeScript best practices
- Add tests for new functionality
- Update documentation for new features
- Use conventional commit messages

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Review existing GitHub issues
3. Create a new issue with:
   - Operating system and version
   - Node.js version
   - Complete error messages
   - Steps to reproduce

---

**Built with ❤️ for the Claude Desktop and MCP ecosystem**
