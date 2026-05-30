# Course Details SSR Implementation Plan

**Status**: ✅ Plan Approved - Ready to Execute

**Step-by-Step Breakdown**:

1. **✅ [Done]** Create this TODO
2. **Fix `templates/course-details.html`** - Safe EJS for {name, description, link, status}
3. **Update `routes/views.js`** - Direct supabase query in `/course/:id`
4. **Fix layout/CSS loading** - Ensure `/css/style.css` + navbar renders
5. **Test & Validate** - `http://localhost:3000/course/1` shows data + styling
6. **Complete** - attempt_completion

**Current Data Structure** (Supabase courses):
```
{id, name, description, link, created_by, created_at, status}
```

**Expected Result**:
```
http://localhost:3000/course/1 → Course name/desc/link button + navbar + CSS
```

**Next**: Edit templates/course-details.html (Step 2)
