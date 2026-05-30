/**
 * Builds syllabus, quizzes, and YouTube embed URLs from course records.
 */

function extractYoutubeId(url) {
  if (!url || typeof url !== "string") return null;
  try {
    if (url.includes("youtu.be/")) {
      return url.split("youtu.be/")[1].split(/[?&#]/)[0];
    }
    if (url.includes("/embed/")) {
      return url.split("/embed/")[1].split(/[?&#]/)[0];
    }
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtube.com")) {
      return parsed.searchParams.get("v");
    }
  } catch {
    return null;
  }
  return null;
}

function youtubeEmbedUrl(url) {
  const id = extractYoutubeId(url);
  if (id) return `https://www.youtube.com/embed/${id}`;
  return url || "";
}

function buildCourseSyllabus(course, defaultMeta = null) {
  const title = course.title || course.name || "Course";
  const mainEmbed = youtubeEmbedUrl(course.link);

  const moduleLabels = defaultMeta
    ? [defaultMeta.m1, defaultMeta.m2, defaultMeta.m3].filter(Boolean)
    : [];

  const modules = [
    {
      id: "m1",
      title: moduleLabels[0]?.en || "Module 1: Getting Started",
      titleAr: moduleLabels[0]?.ar || "الوحدة 1: البداية",
      lessons: [
        {
          id: "l1",
          title: "Introduction & Overview",
          titleAr: "مقدمة ونظرة عامة",
          duration: "12:00",
          type: "video",
          embedUrl: mainEmbed,
          completed: false,
        },
        {
          id: "l2",
          title: "Key Concepts",
          titleAr: "المفاهيم الأساسية",
          duration: defaultMeta?.m1?.time || "18:00",
          type: "video",
          embedUrl: mainEmbed,
          completed: false,
        },
      ],
    },
    {
      id: "m2",
      title: moduleLabels[1]?.en || "Module 2: Practice",
      titleAr: moduleLabels[1]?.ar || "الوحدة 2: التطبيق",
      lessons: [
        {
          id: "l3",
          title: "Guided Exercise",
          titleAr: "تمرين موجّه",
          duration: defaultMeta?.m2?.time || "22:00",
          type: "video",
          embedUrl: mainEmbed,
          completed: false,
        },
      ],
    },
    {
      id: "m3",
      title: moduleLabels[2]?.en || "Module 3: Assessment",
      titleAr: moduleLabels[2]?.ar || "الوحدة 3: التقييم",
      lessons: [
        {
          id: "l4",
          title: "Review & Summary",
          titleAr: "مراجعة وملخص",
          duration: "10:00",
          type: "video",
          embedUrl: mainEmbed,
          completed: false,
        },
      ],
    },
  ];

  const quiz = {
    id: `quiz-${course.id}`,
    title: `${title} — Final Quiz`,
    titleAr: `اختبار ${title}`,
    questionCount: 10,
    timeLimitMinutes: 30,
    maxAttempts: 2,
    passingScore: 70,
    questions: [
      {
        id: "q1",
        text: "What is the main topic of this course?",
        textAr: "ما هو الموضوع الرئيسي لهذا الكورس؟",
        options: [
          { id: "a", text: title, correct: true },
          { id: "b", text: "Unrelated topic", correct: false },
          { id: "c", text: "General knowledge only", correct: false },
        ],
      },
      {
        id: "q2",
        text: "How do you track your progress on E-Tracks?",
        textAr: "كيف تتابع تقدمك على E-Tracks؟",
        options: [
          { id: "a", text: "Through the student dashboard", correct: true },
          { id: "b", text: "By email only", correct: false },
          { id: "c", text: "Progress is not tracked", correct: false },
        ],
      },
      {
        id: "q3",
        text: "Where are course videos hosted?",
        textAr: "أين تُستضاف فيديوهات الكورس؟",
        options: [
          { id: "a", text: "YouTube (embedded)", correct: true },
          { id: "b", text: "Local downloads only", correct: false },
          { id: "c", text: "Not available", correct: false },
        ],
      },
    ],
  };

  return { modules, quiz, mainEmbed };
}

function computeProgress(syllabus, progress = {}) {
  const completed = new Set(progress.completedLessons || []);
  let total = 0;
  let done = 0;

  syllabus.modules.forEach((mod) => {
    mod.lessons.forEach((lesson) => {
      total += 1;
      lesson.completed = completed.has(lesson.id);
      if (lesson.completed) done += 1;
    });
  });

  const quizDone = Boolean(progress.quizCompleted);
  if (quizDone) done += 1;
  total += 1;

  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  return { percent, completedLessons: [...completed], quizDone, total, done };
}

function mergeProgressIntoSyllabus(syllabus, progress) {
  const result = computeProgress(syllabus, progress);
  return { syllabus, ...result };
}

module.exports = {
  youtubeEmbedUrl,
  buildCourseSyllabus,
  computeProgress,
  mergeProgressIntoSyllabus,
};
