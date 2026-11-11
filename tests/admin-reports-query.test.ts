import test from "node:test";
import assert from "node:assert/strict";
import {parseAdminReportsQuery} from "../src/lib/admin-reports-query.ts";

test("admin report list validates page, limit and status", () => {
  assert.deepEqual(parseAdminReportsQuery("http://localhost/api/admin/reports").data,{page:1,limit:50});
  assert.deepEqual(parseAdminReportsQuery("http://localhost/api/admin/reports?page=2&limit=10&status=resolved").data,{page:2,limit:10,status:"resolved"});
  for(const query of ["page=0","page=10001","page=1.2","limit=0","limit=101","status=unknown","unexpected=yes"])
    assert.equal(parseAdminReportsQuery(`http://localhost/api/admin/reports?${query}`).success,false,query);
});
