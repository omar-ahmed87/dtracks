/**
 * API & Data Module
 * Handles course data, hydration, and interactions with storage/API.
 */

const DEFAULT_COURSES = {
  "computer-basics": {
    titleStr: "course_comp_basics_title",
    descStr: "course_comp_basics_desc",
    tagStr: "tag_comp",
    img: "https://picsum.photos/id/0/800/600",
    weeks: "4",
    price: "$99",
    instructor: {
      nameStr: "founder_1_name",
      roleStr: "founder_1_role",
      img: "https://i.pravatar.cc/150?img=60",
    },
    m1: {
      en: "Module 1: Getting Started",
      ar: "الوحدة 1: البداية",
      l: "3",
      time: "45 Min",
    },
    m2: {
      en: "Module 2: The Internet",
      ar: "الوحدة 2: الإنترنت",
      l: "4",
      time: "1 Hr",
    },
    m3: {
      en: "Module 3: Security & Privacy",
      ar: "الوحدة 3: الأمان والخصوصية",
      l: "2",
      time: "30 Min",
    },
    videoId: "Mtk7X8mN474",
    icon: "computer",
    color: "#4f46e5",
    rating: "4.8",
  },
  icdl: {
    titleStr: "course_icdl_title",
    descStr: "cat_icdl_desc",
    tagStr: "tag_cert",
    img: "https://picsum.photos/id/48/800/600",
    weeks: "8",
    price: "$149",
    instructor: {
      nameStr: "founder_2_name",
      roleStr: "founder_2_role",
      img: "https://i.pravatar.cc/150?img=33",
    },
    m1: {
      en: "Module 1: Word Processing",
      ar: "الوحدة 1: معالجة النصوص",
      l: "8",
      time: "2 Hrs",
    },
    m2: {
      en: "Module 2: Spreadsheets (Excel)",
      ar: "الوحدة 2: الجداول الحسابية",
      l: "12",
      time: "3 Hrs",
    },
    m3: {
      en: "Module 3: Presentations",
      ar: "الوحدة 3: العروض التقديمية",
      l: "5",
      time: "1.5 Hrs",
    },
    videoId: "_u7Yn6L3Zpk",
    icon: "workspace_premium",
    color: "#10b981",
    rating: "4.8",
  },
  "graphic-design": {
    titleStr: "course_graphic_design_title",
    descStr: "cat_design_desc",
    tagStr: "tag_design",
    img: "https://picsum.photos/id/250/800/600",
    weeks: "12",
    price: "$199",
    instructor: {
      nameStr: "founder_1_name",
      roleStr: "founder_1_role",
      img: "https://i.pravatar.cc/150?img=60",
    },
    m1: {
      en: "Module 1: Photoshop Fundamentals",
      ar: "الوحدة 1: أساسيات الفوتوشوب",
      l: "10",
      time: "4 Hrs",
    },
    m2: {
      en: "Module 2: Illustrator Vectors",
      ar: "الوحدة 2: المتجهات في الإليستريتور",
      l: "14",
      time: "5 Hrs",
    },
    m3: {
      en: "Module 3: Brand Identity",
      ar: "الوحدة 3: الهوية البصرية",
      l: "6",
      time: "2 Hrs",
    },
    videoId: "9E4MqeFndS4",
    icon: "palette",
    color: "#ec4899",
    rating: "4.8",
  },
  german: {
    titleStr: "course_german_title",
    descStr: "cat_lang_desc",
    tagStr: "tag_lang",
    img: "https://picsum.photos/id/1015/800/600",
    weeks: "6",
    price: "$79",
    instructor: {
      nameStr: "founder_2_name",
      roleStr: "founder_2_role",
      img: "https://i.pravatar.cc/150?img=33",
    },
    m1: {
      en: "Module 1: Grammar Essentials",
      ar: "الوحدة 1: أساسيات القواعد",
      l: "15",
      time: "3 Hrs",
    },
    m2: {
      en: "Module 2: Practical Conversation",
      ar: "الوحدة 2: المحادثة العملية",
      l: "20",
      time: "6 Hrs",
    },
    m3: {
      en: "Module 3: Advanced Writing",
      ar: "الوحدة 3: الكتابة المتقدمة",
      l: "8",
      time: "4 Hrs",
    },
    icon: "language",
    color: "#f59e0b",
    rating: "4.8",
  },
};

const CACHE_KEY = 'etracks_courses_api_v3.3';
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

async function fetchCourses() {
  try {
    const response = await fetch('/api/courses/all');
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const { courses } = await response.json();

    if (courses.length === 0) {
      return DEFAULT_COURSES;
    }

    // Predefined high-quality images for dynamic courses
    const defaultImgs = [
      "https://picsum.photos/id/1/800/600",
      "https://picsum.photos/id/2/800/600",
      "https://picsum.photos/id/3/800/600",
      "https://picsum.photos/id/4/800/600"
    ];

    // Map DB courses to frontend format
    const mapped = {};
    courses.forEach((course, index) => {
      const stringId = String(course.id);
      
      // Map names to find default translation keys (trimmed and case-insensitive)
      const rawName = course.name || course.title || `Course ${stringId}`;
      const cleanName = String(rawName).trim();
      const nameMap = {
        'اساسيات كمبيوتر': 'computer-basics',
        'أساسيات كمبيوتر': 'computer-basics',
        'ICDL': 'icdl',
        'icdl': 'icdl',
        'جرافي ديزاين': 'graphic-design',
        'جرافيك ديزاين': 'graphic-design',
        'لغة المانية': 'german',
        'لغة ألمانية': 'german'
      };
      
      const internalId = nameMap[cleanName] || nameMap[cleanName.toLowerCase()];
      const isDefault = internalId && DEFAULT_COURSES[internalId];
      
      // Use DB ID as the primary key for logic and links
      mapped[stringId] = {
        titleStr: isDefault ? DEFAULT_COURSES[internalId].titleStr : `course_dynamic_${stringId}`,
        descStr: isDefault ? DEFAULT_COURSES[internalId].descStr : `desc_dynamic_${stringId}`,
        tagStr: course.tagStr || (isDefault ? DEFAULT_COURSES[internalId].tagStr : 'tag_course'),
        img: course.img || (isDefault ? DEFAULT_COURSES[internalId].img : defaultImgs[index % defaultImgs.length]),
        weeks: course.weeks || (isDefault ? DEFAULT_COURSES[internalId].weeks : '12'),
        rating: course.rating || (isDefault ? DEFAULT_COURSES[internalId].rating : '4.8'),
        title: course.name || rawName, // The raw name from DB
        description: course.description,
        link: course.link,
        id: stringId // REAL DB ID for URLs
      };
    });

    // Cache with timestamp
    const cacheData = {
      data: mapped,
      timestamp: Date.now()
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    return mapped;
  } catch (error) {
    console.error('Fetch courses failed:', error);
    // Fallback to static
    return DEFAULT_COURSES;
  }
}

export const getCourses = async () => {
  // Always fetch fresh data from the API (no localStorage caching)
  return await fetchCourses();
};

export { DEFAULT_COURSES };

export const hydrateCoursePage = async (courseId) => {
  const courses = await getCourses();
  const course = courses[courseId];
  if (!course) return;

  const lang = localStorage.getItem("lang") || "en";

  // Update common elements
  const elTitle = document.getElementById("cd-title");
  const elDesc = document.getElementById("cd-desc");
  const elTag = document.getElementById("cd-tag");
  const elImg = document.getElementById("cd-img");
  const elWeeks = document.getElementById("cd-weeks");
  const elPrice = document.getElementById("cd-price");

  if (elTitle) elTitle.setAttribute("data-i18n", course.titleStr);
  if (elDesc) elDesc.setAttribute("data-i18n", course.descStr);
  if (elTag) elTag.setAttribute("data-i18n", course.tagStr);
  if (elImg) elImg.src = course.img;
  if (elWeeks)
    elWeeks.textContent = course.weeks + (lang === "ar" ? " أسابيع" : " Weeks");
  if (elPrice) elPrice.textContent = course.price;

  // Update Modules
  const modules = document.querySelectorAll(
    ".course-overview .feature-item h4",
  );
  const moduleCounts = document.querySelectorAll(
    ".course-overview .feature-item span",
  );

  if (modules.length >= 3 && course.m1) {
    modules[0].textContent = course.m1[lang];
    modules[1].textContent = course.m2[lang];
    modules[2].textContent = course.m3[lang];

    const lessonStr = lang === "ar" ? "دروس" : "Lessons";
    moduleCounts[0].textContent = `${course.m1.l} ${lessonStr}`;
    moduleCounts[1].textContent = `${course.m2.l} ${lessonStr}`;
    moduleCounts[2].textContent = `${course.m3.l} ${lessonStr}`;
  }
};

