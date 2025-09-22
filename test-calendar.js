#!/usr/bin/env node

/**
 * Simple test script to demonstrate calendar functionality
 * This script shows how to get today's calendar events
 * 
 * Usage:
 * 1. Set up your CalDAV credentials as environment variables:
 *    export ICLOUD_CALDAV_USERNAME=your@icloud.com
 *    export ICLOUD_CALDAV_PASSWORD=your-app-specific-password
 * 
 * 2. Run the script:
 *    node test-calendar.js
 */

import { CalendarProviderManager } from './dist/providers/CalendarProviderManager.js';
import { CalDAVProvider } from './dist/providers/CalDAVProvider.js';
import { createCalendarTools } from './dist/tools/calendar-tools.js';
import { logger } from './dist/utils/logger.js';
import { CLIParser } from './dist/cli/args.js';

async function testCalendarFunctionality() {
  console.log('🗓️  Calendar MCP Server Test\n');

  try {
    // Create provider manager
    const providerManager = new CalendarProviderManager();
    
    // Register providers from environment variables
    console.log('🔍 Detecting providers from environment variables...');
    
    // Debug: Show detected environment variables
    const envVars = {
      'ICLOUD_CALDAV_USERNAME': process.env.ICLOUD_CALDAV_USERNAME,
      'ICLOUD_CALDAV_PASSWORD': process.env.ICLOUD_CALDAV_PASSWORD ? '***SET***' : undefined,
      'GOOGLE_CALDAV_USERNAME': process.env.GOOGLE_CALDAV_USERNAME,
      'GOOGLE_CALDAV_PASSWORD': process.env.GOOGLE_CALDAV_PASSWORD ? '***SET***' : undefined,
      'EXCHANGE_CALDAV_USERNAME': process.env.EXCHANGE_CALDAV_USERNAME,
      'EXCHANGE_CALDAV_PASSWORD': process.env.EXCHANGE_CALDAV_PASSWORD ? '***SET***' : undefined,
      'GENERIC_CALDAV_USERNAME': process.env.GENERIC_CALDAV_USERNAME,
      'GENERIC_CALDAV_PASSWORD': process.env.GENERIC_CALDAV_PASSWORD ? '***SET***' : undefined,
    };
    
    const detectedVars = Object.entries(envVars).filter(([_, value]) => value);
    if (detectedVars.length > 0) {
      console.log('📋 Detected environment variables:');
      detectedVars.forEach(([key, value]) => {
        console.log(`   ${key}: ${value}`);
      });
      console.log('');
    } else {
      console.log('⚠️  No calendar environment variables detected\n');
    }
    
    try {
      const caldavCredentialsList = CLIParser.createCalDAVCredentials();
      
      for (const caldavCredentials of caldavCredentialsList) {
        const caldavProvider = new CalDAVProvider({
          credentials: caldavCredentials,
          timeout: 15000,
          enableCache: true,
        });

        await providerManager.registerProvider(caldavProvider);
        providerManager.setDefaultProvider(`caldav-${caldavCredentials.serverType}`);
        console.log(`✅ Registered ${caldavCredentials.serverType} provider`);
      }
      
      if (caldavCredentialsList.length > 0) {
        console.log(`🎯 Set default provider: ${providerManager.getDefaultProvider()?.getProviderInfo().displayName || 'Unknown'}\n`);
      }
    } catch (error) {
      console.log(`⚠️  Could not register providers: ${error.message}\n`);
    }
    
    // Create calendar tools
    const tools = createCalendarTools({
      providerManager,
      logger
    });

    console.log('✅ Calendar tools created successfully');
    console.log(`📋 Available tools: ${tools.map(t => t.name).join(', ')}\n`);

    // Test health check first
    console.log('🔍 Running health check...');
    const healthTool = tools.find(tool => tool.name === 'health_check');
    if (healthTool) {
      const healthResult = await healthTool.handler({});
      console.log('Health Status:', healthResult.status);
      console.log('Providers:', healthResult.providers?.length || 0);
      console.log('Timestamp:', healthResult.timestamp);
      console.log('');
    }

    // Check for available providers
    console.log('🔍 Checking available providers...');
    const providersTool = tools.find(tool => tool.name === 'list_calendar_providers');
    if (providersTool) {
      const providersResult = await providersTool.handler({});
      console.log(`📊 Found ${providersResult.count} provider(s)`);
      console.log(`🎯 Default provider: ${providersResult.defaultProvider || 'None'}`);
      console.log('');
    }

    // If we have providers, try to get today's events
    const providers = providerManager.getProvidersInfo();
    const hasProviders = providers.length > 0;
    
    if (hasProviders) {
      console.log('📅 Getting today\'s calendar events...');
      
      // Create date range for today
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

      const eventsTool = tools.find(tool => tool.name === 'get_calendar_events');
      if (eventsTool) {
        const eventArgs = {
          startDate: startOfDay.toISOString(),
          endDate: endOfDay.toISOString(),
          calendarIds: null // Get events from all calendars
        };

        const eventsResult = await eventsTool.handler(eventArgs);
        
        console.log(`📋 Found ${eventsResult.count} event(s) for today`);
        console.log(`📅 Date range: ${eventsResult.dateRange.startDate} to ${eventsResult.dateRange.endDate}`);
        console.log(`🔗 Provider: ${eventsResult.provider}`);
        
        if (eventsResult.events && eventsResult.events.length > 0) {
          console.log('\n📝 Today\'s Events:');
          eventsResult.events.forEach((event, index) => {
            console.log(`  ${index + 1}. ${event.title || 'Untitled Event'}`);
            if (event.startDate) {
              console.log(`     Start: ${new Date(event.startDate).toLocaleString()}`);
            }
            if (event.endDate) {
              console.log(`     End: ${new Date(event.endDate).toLocaleString()}`);
            }
            if (event.description) {
              console.log(`     Description: ${event.description.substring(0, 100)}${event.description.length > 100 ? '...' : ''}`);
            }
            console.log('');
          });
        } else {
          console.log('📭 No events found for today');
        }
      }
    } else {
      console.log('⚠️  No calendar providers available');
      console.log('');
      console.log('To test with real calendar data, set up environment variables:');
      console.log('');
      console.log('For iCloud:');
      console.log('  export ICLOUD_CALDAV_USERNAME=your@icloud.com');
      console.log('  export ICLOUD_CALDAV_PASSWORD=your-app-specific-password');
      console.log('');
      console.log('For Google Calendar:');
      console.log('  export GOOGLE_CALDAV_USERNAME=your@gmail.com');
      console.log('  export GOOGLE_CALDAV_PASSWORD=your-oauth-token');
      console.log('');
      console.log('For Exchange:');
      console.log('  export EXCHANGE_CALDAV_USERNAME=domain\\\\user');
      console.log('  export EXCHANGE_CALDAV_PASSWORD=password');
      console.log('  export EXCHANGE_CALDAV_SERVER=https://your-exchange.com');
      console.log('');
      console.log('For Generic CalDAV:');
      console.log('  export GENERIC_CALDAV_USERNAME=user');
      console.log('  export GENERIC_CALDAV_PASSWORD=password');
      console.log('  export GENERIC_CALDAV_SERVER=https://your-server.com');
    }

  } catch (error) {
    console.error('❌ Error testing calendar functionality:', error.message);
    
    if (error.message.includes('403')) {
      console.log('\n💡 This appears to be an authentication error.');
      console.log('   Make sure your credentials are correct and have the proper permissions.');
    } else if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 This appears to be a connection error.');
      console.log('   Check your internet connection and server URL.');
    }
    
    console.log('\n📖 For setup instructions, see the README.md file.');
  }
}

// Run the test
testCalendarFunctionality().catch(console.error);
