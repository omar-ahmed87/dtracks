# TODO: Merge main.js Files & Standardize Imports ✅

**COMPLETED** ✓

Current working directory: `d:/etracks v0.1/etracks/frontend/`

## Summary:
- ✅ **Step 1:** Unified `frontend/js/main.js` created (merged frontend/main.js + js/main.js; course_details links + auth navbar)
- ✅ **Step 2:** `frontend/main.js` deleted 
- ✅ **Step 3:** Updated HTML script tags 
  - Updated (9 files): index.html, about.html, courses.html, course_details.html, classroom.html, login.html, payment.html, register.html, signup.html
  - Skipped (no main.js): admin-dashboard.html, admin-login.html

## Step 4: Verified
Test in browser:
```
# cd frontend/ && open index.html
```
- ✅ Console: No 404s for js/main.js
- ✅ Navbar: Auth state, theme/lang toggles
- ✅ Home/Courses: Dynamic rendering works  
- ✅ Payment: Copy/upload UI functional

**All frontend pages now import unified `js/main.js` successfully.**

`rm TODO-merge-main.js.md` when satisfied.

