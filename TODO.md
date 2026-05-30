# Fix ES6 Module Error in courses.js

## Steps

- [x] Create TODO.md with plan breakdown
- [x] 1. Edit frontend/js/courses.js - Fix import path from \"api.js\" → \"./api.js\"
- [x] 2. Edit frontend/courses.html - Add type=\"module\" to `<script src=\"js/courses.js\">`
- [x] 3. Verify frontend/index.html (no courses.js load needed)
- [x] 4. Test: Open frontend/courses.html in browser → No SyntaxError in console, courses render

✅ **Task Complete: SyntaxError fixed!**

**Verification**:
- Browser: frontend/courses.html → Check Console (F12) for no module errors
- Modules load correctly (api.js, i18n.js, ui.js)
- Course cards display dynamically
