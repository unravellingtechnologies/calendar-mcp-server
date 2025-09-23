#include <napi.h>
#include <EventKit/EventKit.h>
#include <Foundation/Foundation.h>

// Helper to convert EKCalendar to JS object
Napi::Object CalendarToJS(Napi::Env env, EKCalendar* cal) {
  Napi::Object obj = Napi::Object::New(env);
  obj.Set("id", Napi::String::New(env, [cal.calendarIdentifier UTF8String]));
  obj.Set("title", Napi::String::New(env, [cal.title UTF8String]));
  obj.Set("color", Napi::String::New(env, [[NSString stringWithFormat:@"#%06X", (unsigned int)cal.color] UTF8String]));
  obj.Set("isReadOnly", Napi::Boolean::New(env, !cal.allowsContentModifications));
  obj.Set("source", Napi::String::New(env, [cal.source.title UTF8String]));
  return obj;
}

// Helper to convert EKEvent to JS object
Napi::Object EventToJS(Napi::Env env, EKEvent* ev) {
  Napi::Object obj = Napi::Object::New(env);
  obj.Set("id", Napi::String::New(env, [ev.eventIdentifier UTF8String]));
  obj.Set("title", Napi::String::New(env, [ev.title UTF8String]));
  obj.Set("startDate", Napi::Number::New(env, [ev.startDate timeIntervalSince1970] * 1000));
  obj.Set("endDate", Napi::Number::New(env, [ev.endDate timeIntervalSince1970] * 1000));
  obj.Set("location", Napi::String::New(env, [ev.location UTF8String]));
  obj.Set("notes", Napi::String::New(env, [ev.notes UTF8String]));
  obj.Set("calendarId", Napi::String::New(env, [ev.calendar.calendarIdentifier UTF8String]));
  // Add more fields as needed (attendees, recurrence, etc.)
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

// TODO: Implement createEvent, updateEvent, deleteEvent similarly

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("requestAccess", Napi::Function::New(env, RequestAccess));
  exports.Set("hasAccess", Napi::Function::New(env, HasAccess));
  exports.Set("getCalendars", Napi::Function::New(env, GetCalendars));
  exports.Set("getEvents", Napi::Function::New(env, GetEvents));
  // Add more exports for create, update, delete
  return exports;
}

NODE_API_MODULE(eventkit, Init)
