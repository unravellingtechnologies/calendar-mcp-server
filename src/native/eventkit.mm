#include <napi.h>
#include <EventKit/EventKit.h>
#include <Foundation/Foundation.h>
#include <AppKit/AppKit.h>

// Helper to convert EKCalendar to JS object
Napi::Object CalendarToJS(Napi::Env env, EKCalendar* cal) {
  Napi::Object obj = Napi::Object::New(env);
  obj.Set("id", Napi::String::New(env, [cal.calendarIdentifier UTF8String]));
  obj.Set("title", Napi::String::New(env, [cal.title UTF8String]));

  // Fixed color conversion
  NSColor *color = cal.color;
  CGFloat r, g, b, a;
  [color getRed:&r green:&g blue:&b alpha:&a];
  unsigned int hex = ((int)(r * 255) << 16) | ((int)(g * 255) << 8) | (int)(b * 255);
  NSString *hexStr = [NSString stringWithFormat:@"#%06X", hex];
  obj.Set("color", Napi::String::New(env, [hexStr UTF8String]));

  obj.Set("isReadOnly", Napi::Boolean::New(env, !cal.allowsContentModifications));
  obj.Set("source", Napi::String::New(env, [cal.source.title UTF8String]));
  return obj;
}

// Helper to convert EKEvent to JS object
Napi::Object EventToJS(Napi::Env env, EKEvent* event) {
  Napi::Object obj = Napi::Object::New(env);

  // Helper lambda for safe string conversion
  auto SafeSetString = [&](const char* key, NSString* nsString) {
    if (nsString != nil) {
      obj.Set(key, Napi::String::New(env, [nsString UTF8String]));
    } else {
      obj.Set(key, env.Null());
    }
  };

  // Helper lambda for safe URL conversion
  auto SafeSetURL = [&](const char* key, NSURL* nsURL) {
    if (nsURL != nil) {
      obj.Set(key, Napi::String::New(env, [[nsURL absoluteString] UTF8String]));
    } else {
      obj.Set(key, env.Null());
    }
  };

  SafeSetString("id", event.eventIdentifier);
  SafeSetString("title", event.title);
  
  if (event.startDate) {
    obj.Set("startDate", Napi::Number::New(env, [event.startDate timeIntervalSince1970] * 1000));
  }
  if (event.endDate) {
    obj.Set("endDate", Napi::Number::New(env, [event.endDate timeIntervalSince1970] * 1000));
  }
  
  obj.Set("isAllDay", Napi::Boolean::New(env, event.allDay));
  
  if (event.calendar && event.calendar.calendarIdentifier) {
      SafeSetString("calendarId", event.calendar.calendarIdentifier);
  }

  SafeSetString("location", event.location);
  SafeSetString("notes", event.notes);
  SafeSetURL("url", event.URL);

  return obj;
}

// Request access to events
Napi::Value RequestAccess(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  EKEventStore* store = [[EKEventStore alloc] init];
  Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);

  [store requestAccessToEntityType:EKEntityTypeEvent completion:^(BOOL granted, NSError* error) {
    if (error) {
      deferred.Reject(Napi::Error::New(env, [[error localizedDescription] UTF8String]).Value());
    } else {
      deferred.Resolve(Napi::Boolean::New(env, granted));
    }
  }];
  return deferred.Promise();
}

// Check if access is granted
Napi::Value HasAccess(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  EKAuthorizationStatus status = [EKEventStore authorizationStatusForEntityType:EKEntityTypeEvent];
  return Napi::Boolean::New(env, status == EKAuthorizationStatusAuthorized);
}

// Get detailed authorization status
Napi::Value GetAuthorizationStatus(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  EKAuthorizationStatus status = [EKEventStore authorizationStatusForEntityType:EKEntityTypeEvent];
  
  Napi::Object result = Napi::Object::New(env);
  result.Set("status", Napi::Number::New(env, status));
  
  // Convert status to human-readable string
  NSString* statusString;
  switch (status) {
    case EKAuthorizationStatusNotDetermined:
      statusString = @"notDetermined";
      break;
    case EKAuthorizationStatusRestricted:
      statusString = @"restricted";
      break;
    case EKAuthorizationStatusDenied:
      statusString = @"denied";
      break;
    case EKAuthorizationStatusAuthorized:
      statusString = @"authorized";
      break;
    default:
      statusString = @"unknown";
      break;
  }
  
  result.Set("statusString", Napi::String::New(env, [statusString UTF8String]));
  result.Set("hasAccess", Napi::Boolean::New(env, status == EKAuthorizationStatusAuthorized));
  
  return result;
}

// Get all calendars
Napi::Value GetCalendars(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  EKEventStore* store = [[EKEventStore alloc] init];
  NSArray<EKCalendar*>* calendars = [store calendarsForEntityType:EKEntityTypeEvent];
  
  Napi::Array result = Napi::Array::New(env, calendars.count);
  for (NSUInteger i = 0; i < calendars.count; i++) {
    result[i] = CalendarToJS(env, calendars[i]);
  }
  return result;
}

// Get events in date range
Napi::Value GetEvents(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 2) {
    Napi::TypeError::New(env, "Expected startDate and endDate").ThrowAsJavaScriptException();
    return env.Null();
  }
  
  double startMs = info[0].As<Napi::Number>().DoubleValue();
  double endMs = info[1].As<Napi::Number>().DoubleValue();
  NSDate* startDate = [NSDate dateWithTimeIntervalSince1970:startMs / 1000];
  NSDate* endDate = [NSDate dateWithTimeIntervalSince1970:endMs / 1000];
  
  EKEventStore* store = [[EKEventStore alloc] init];
  NSPredicate* predicate = [store predicateForEventsWithStartDate:startDate endDate:endDate calendars:nil];
  NSArray<EKEvent*>* events = [store eventsMatchingPredicate:predicate];
  
  Napi::Array result = Napi::Array::New(env, events.count);
  for (NSUInteger i = 0; i < events.count; i++) {
    result[i] = EventToJS(env, events[i]);
  }
  return result;
}

// Helper to create EKEvent from JS object
EKEvent* JSToEvent(Napi::Env env, Napi::Object obj, EKEventStore* store) {
  EKEvent* ev = [EKEvent eventWithEventStore:store];
  ev.title = [NSString stringWithUTF8String:obj.Get("title").As<Napi::String>().Utf8Value().c_str()];
  ev.startDate = [NSDate dateWithTimeIntervalSince1970:obj.Get("startDate").As<Napi::Number>().DoubleValue() / 1000];
  ev.endDate = [NSDate dateWithTimeIntervalSince1970:obj.Get("endDate").As<Napi::Number>().DoubleValue() / 1000];
  ev.location = [NSString stringWithUTF8String:obj.Get("location").As<Napi::String>().Utf8Value().c_str()];
  ev.notes = [NSString stringWithUTF8String:obj.Get("notes").As<Napi::String>().Utf8Value().c_str()];
  NSString* calId = [NSString stringWithUTF8String:obj.Get("calendarId").As<Napi::String>().Utf8Value().c_str()];
  ev.calendar = [store calendarWithIdentifier:calId];
  // Add more fields as needed
  return ev;
}

Napi::Value CreateEvent(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);

    if (info.Length() < 2 || !info[0].IsString() || !info[1].IsObject()) {
        deferred.Reject(Napi::Error::New(env, "Invalid arguments: calendarId (string) and event (object) required").Value());
        return deferred.Promise();
    }

    std::string calendarId = info[0].As<Napi::String>().Utf8Value();
    Napi::Object eventObject = info[1].As<Napi::Object>();

    dispatch_async(dispatch_get_main_queue(), ^{
      @try {
        NSLog(@"[MCP-EventKit] Starting event creation on main thread.");
        EKEventStore* store = [[EKEventStore alloc] init];
        EKEvent* event = [EKEvent eventWithEventStore:store];
        
        EKCalendar* calendar = [store calendarWithIdentifier:[NSString stringWithUTF8String:calendarId.c_str()]];
        if (!calendar) {
            NSLog(@"[MCP-EventKit] Error: Calendar with ID %s not found.", calendarId.c_str());
            deferred.Reject(Napi::Error::New(env, "Calendar not found").Value());
            return;
        }
        event.calendar = calendar;
        NSLog(@"[MCP-EventKit] Found calendar: %@", calendar.title);

        if (eventObject.Has("title")) {
            event.title = [NSString stringWithUTF8String:eventObject.Get("title").As<Napi::String>().Utf8Value().c_str()];
        }
        if (eventObject.Has("startDate")) {
            double startTime = eventObject.Get("startDate").As<Napi::Number>().DoubleValue();
            event.startDate = [NSDate dateWithTimeIntervalSince1970:startTime / 1000];
        }
        if (eventObject.Has("endDate")) {
            double endTime = eventObject.Get("endDate").As<Napi::Number>().DoubleValue();
            event.endDate = [NSDate dateWithTimeIntervalSince1970:endTime / 1000];
        }
        if (eventObject.Has("location")) {
            event.location = [NSString stringWithUTF8String:eventObject.Get("location").As<Napi::String>().Utf8Value().c_str()];
        }
        if (eventObject.Has("notes")) {
            event.notes = [NSString stringWithUTF8String:eventObject.Get("notes").As<Napi::String>().Utf8Value().c_str()];
        }
        if (eventObject.Has("isAllDay")) {
            event.allDay = eventObject.Get("isAllDay").As<Napi::Boolean>().Value();
        }
        NSLog(@"[MCP-EventKit] Event object prepared. Title: %@", event.title);

        NSError* error = nil;
        NSLog(@"[MCP-EventKit] Calling saveEvent...");
        BOOL success = [store saveEvent:event span:EKSpanThisEvent commit:YES error:&error];
        NSLog(@"[MCP-EventKit] saveEvent returned: %s", success ? "YES" : "NO");

        if (success) {
            Napi::Object result = EventToJS(env, event);
            deferred.Resolve(result);
            NSLog(@"[MCP-EventKit] Promise resolved successfully.");
        } else {
            NSString* errorDesc = error.localizedDescription;
            NSLog(@"[MCP-EventKit] Error saving event: %@", errorDesc);
            deferred.Reject(Napi::Error::New(env, [errorDesc UTF8String]).Value());
        }
      } @catch (NSException *exception) {
          NSLog(@"[MCP-EventKit] *** CRITICAL NATIVE EXCEPTION: %@, reason: %@", exception.name, exception.reason);
          deferred.Reject(Napi::Error::New(env, [[exception reason] UTF8String]).Value());
      }
    });

    return deferred.Promise();
}


// UpdateEvent function
Napi::Value UpdateEvent(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 2) {
    Napi::TypeError::New(env, "Expected eventId and event updates").ThrowAsJavaScriptException();
    return env.Null();
  }
  
  std::string eventId = info[0].As<Napi::String>().Utf8Value();
  Napi::Object updates = info[1].As<Napi::Object>();
  
  EKEventStore* store = [[EKEventStore alloc] init];
  EKEvent* ev = [store eventWithIdentifier:[NSString stringWithUTF8String:eventId.c_str()]];
  
  if (!ev) {
    Napi::Error::New(env, "Event not found").ThrowAsJavaScriptException();
    return env.Null();
  }
  
  // Apply updates
  if (updates.Has("title")) ev.title = [NSString stringWithUTF8String:updates.Get("title").As<Napi::String>().Utf8Value().c_str()];
  if (updates.Has("startDate")) ev.startDate = [NSDate dateWithTimeIntervalSince1970:updates.Get("startDate").As<Napi::Number>().DoubleValue() / 1000];
  if (updates.Has("endDate")) ev.endDate = [NSDate dateWithTimeIntervalSince1970:updates.Get("endDate").As<Napi::Number>().DoubleValue() / 1000];
  // Add more fields as needed
  
  NSError* error = nil;
  BOOL success = [store saveEvent:ev span:EKSpanThisEvent error:&error];
  if (!success) {
    Napi::Error::New(env, [[error localizedDescription] UTF8String]).ThrowAsJavaScriptException();
    return env.Null();
  }
  return EventToJS(env, ev);
}

// Delete event
Napi::Value DeleteEvent(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1) {
    Napi::TypeError::New(env, "Expected eventId").ThrowAsJavaScriptException();
    return env.Null();
  }
  
  std::string eventId = info[0].As<Napi::String>().Utf8Value();
  EKEventStore* store = [[EKEventStore alloc] init];
  EKEvent* ev = [store eventWithIdentifier:[NSString stringWithUTF8String:eventId.c_str()]];
  
  if (!ev) {
    return Napi::Boolean::New(env, false);
  }
  
  NSError* error = nil;
  BOOL success = [store removeEvent:ev span:EKSpanThisEvent error:&error];
  if (!success) {
    Napi::Error::New(env, [[error localizedDescription] UTF8String]).ThrowAsJavaScriptException();
  }
  return Napi::Boolean::New(env, success);
}

// Get single event
Napi::Value GetEvent(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1) {
    Napi::TypeError::New(env, "Expected eventId").ThrowAsJavaScriptException();
    return env.Null();
  }
  
  std::string eventId = info[0].As<Napi::String>().Utf8Value();
  EKEventStore* store = [[EKEventStore alloc] init];
  EKEvent* ev = [store eventWithIdentifier:[NSString stringWithUTF8String:eventId.c_str()]];
  
  if (!ev) {
    return env.Null();
  }
  return EventToJS(env, ev);
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("requestAccess", Napi::Function::New(env, RequestAccess));
  exports.Set("hasAccess", Napi::Function::New(env, HasAccess));
  exports.Set("getAuthorizationStatus", Napi::Function::New(env, GetAuthorizationStatus));
  exports.Set("getCalendars", Napi::Function::New(env, GetCalendars));
  exports.Set("getEvents", Napi::Function::New(env, GetEvents));
  exports.Set("createEvent", Napi::Function::New(env, CreateEvent));
  exports.Set("updateEvent", Napi::Function::New(env, UpdateEvent));
  exports.Set("deleteEvent", Napi::Function::New(env, DeleteEvent));
  exports.Set("getEvent", Napi::Function::New(env, GetEvent));
  return exports;
}

NODE_API_MODULE(eventkit, Init)
