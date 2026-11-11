import test from "node:test";
import assert from "node:assert/strict";
import {parseAdminUsersQuery} from "../src/lib/admin-users-query.ts";

test("admin user search validates and bounds pagination", () => {
  assert.deepEqual(parseAdminUsersQuery("http://localhost/api/admin/users").data,{page:1,limit:50,q:""});
  assert.deepEqual(parseAdminUsersQuery("http://localhost/api/admin/users?page=2&limit=10&q=%20Ade%20").data,{page:2,limit:10,q:"Ade"});
  for(const query of ["page=0","page=10001","page=1.2","limit=0","limit=101","unexpected=yes",`q=${"x".repeat(101)}`])
    assert.equal(parseAdminUsersQuery(`http://localhost/api/admin/users?${query}`).success,false,query);
});
