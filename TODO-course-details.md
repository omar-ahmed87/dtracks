# Course Details SSR Fixes

**Current Issues**:
- `/course/1` shows no data/CSS/navbar
- `templates/course-details.html` expects `course.modules`, `course.img` (null crash)
- Supabase `courses` table: {id, name, description, link, status} only
- `routes/views.js` fetches `/api/courses/:id` → works ✓

**Root Causes**:
1. EJS template references non-existent fields (`modules.slice()`, `instructor`, `videoId`)
2. `layout.html` navbar/CSS not loading properly
3. Template styling mismatch

## Plan
1. **Fix `templates/course-details.html`**: Safe template for {name, description, link} only
2. **Update `routes/views.js`**: Direct Supabase query (avoid internal fetch)
3. **Ensure layout/CSS**: Verify `layout.html`, CSS path
4. **Test**: `http://localhost:3000/course/1` → Course data + navbar + styling

**Dependent Files**: 
- templates/course-details.html
- routes/views.js
- templates/layout.html (if needed)

**Followup**: Browser test, restart server (`npm start`)

Approve plan?
