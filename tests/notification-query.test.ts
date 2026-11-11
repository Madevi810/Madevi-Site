import test from "node:test";
import assert from "node:assert/strict";
import { encodeNotificationCursor, parseNotificationQuery } from "../src/lib/notification-query.ts";

test("notification filters and cursors are bounded and validated",()=>{
  const cursor={time:"2026-11-06T12:30:00.123456Z",id:"550e8400-e29b-41d4-a716-446655440000"};
  const encoded=encodeNotificationCursor(cursor);
  const result=parseNotificationQuery(`http://localhost/api/notifications?category=system&limit=7&cursor=${encoded}`);
  assert.equal(result.success,true);if(result.success)assert.deepEqual(result.data,{category:"system",limit:7,after:cursor});
  for(const query of ["category=private","limit=0","limit=51","cursor=abc","cursor=**","page=2","cursor="+"a".repeat(513)])assert.equal(parseNotificationQuery(`http://localhost/api/notifications?${query}`).success,false,query);
  assert.throws(()=>encodeNotificationCursor({time:"bad",id:cursor.id}));
  assert.throws(()=>encodeNotificationCursor({time:"2026-02-30T12:30:00.123456Z",id:cursor.id}));
});
