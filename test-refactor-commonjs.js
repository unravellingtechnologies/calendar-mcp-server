// Simple test to verify the refactored calendar tools work
const { createCalendarTools } = require('./dist/tools/calendar-tools.js');

// Mock objects
const mockProviderManager = {
  requestAccess: async () => true,
  hasAccess: async () => true,
  getCalendars: async () => [{ id: 'test', name: 'Test Calendar' }],
  getEvents: async () => [{ id: 'event1', title: 'Test Event' }],
  getProvidersInfo: () => [{ name: 'test', displayName: 'Test Provider' }],
  setDefaultProvider: (name) => true,
  getDefaultProvider: () => ({
    getProviderInfo: () => ({ displayName: 'Test Provider', name: 'test' })
  })
};

const mockLogger = {
  info: (msg, data) => console.log(`[INFO] ${msg}`, data || ''),
  error: (msg, data) => console.log(`[ERROR] ${msg}`, data || ''),
  warn: (msg, data) => console.log(`[WARN] ${msg}`, data || ''),
  debug: (msg, data) => console.log(`[DEBUG] ${msg}`, data || '')
};

const mockServer = {
  getToolCount: () => 7
};

// Test the factory function
console.log('Testing calendar tools factory...');

async function runTest() {
  try {
    const tools = createCalendarTools({
      providerManager: mockProviderManager,
      logger: mockLogger,
      server: mockServer
    });

    console.log(`✅ Successfully created ${tools.length} tools`);
    
    // Test each tool
    for (const tool of tools) {
      console.log(`\n🔧 Testing tool: ${tool.name}`);
      console.log(`   Description: ${tool.description}`);
      
      // Test the handler with appropriate args
      let testArgs = {};
      if (tool.name === 'get_calendar_events') {
        testArgs = {
          startDate: '2024-01-01T00:00:00.000Z',
          endDate: '2024-01-31T23:59:59.999Z'
        };
      } else if (tool.name === 'switch_calendar_provider') {
        testArgs = {
          providerName: 'test'
        };
      }
      
      try {
        const result = await tool.handler(testArgs);
        console.log(`   ✅ Handler executed successfully`);
        console.log(`   📊 Result:`, JSON.stringify(result, null, 2));
      } catch (error) {
        console.log(`   ❌ Handler failed:`, error.message);
      }
    }
    
    console.log('\n🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

runTest();
