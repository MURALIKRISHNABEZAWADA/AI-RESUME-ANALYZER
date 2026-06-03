export type AtsSeverity = 'major' | 'moderate' | 'minor';

export interface AtsIssue {
  title: string;
  detail: string;
  severity: AtsSeverity;
}

export interface ResumeSections {
  summary: boolean;
  experience: boolean;
  skills: boolean;
  education: boolean;
  projects: boolean;
  certifications: boolean;
}

export interface ResumeAnalysis {
  score: number;
  grade: string;
  keywordCoverage: number;
  atsReadiness: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  atsIssues: AtsIssue[];
  strengths: string[];
  improvements: string[];
  sections: ResumeSections;
  rewrittenResume: string;
  summary: string;
}

const STOP_WORDS = new Set([
  'about', 'above', 'after', 'again', 'against', 'also', 'and', 'any', 'are', 'because', 'been',
  'being', 'between', 'both', 'but', 'can', 'candidate', 'company', 'could', 'day', 'description',
  'did', 'does', 'doing', 'down', 'during', 'each', 'for', 'from', 'had', 'has', 'have', 'having',
  'her', 'here', 'hers', 'him', 'himself', 'his', 'how', 'into', 'its', 'job', 'more', 'most',
  'must', 'our', 'ours', 'out', 'own', 'per', 'position', 'role', 'same', 'she', 'should', 'some',
  'such', 'than', 'that', 'the', 'their', 'them', 'then', 'there', 'these', 'they', 'this', 'those',
  'through', 'under', 'until', 'very', 'was', 'were', 'what', 'when', 'where', 'which', 'while',
  'who', 'will', 'with', 'within', 'work', 'you', 'your', 'responsibilities', 'requirements',
]);

const PRIORITY_TERMS = [
  'accessibility', 'agile', 'ai', 'analytics', 'api', 'automation', 'aws', 'azure', 'backend',
  'business intelligence', 'ci cd', 'cloud', 'collaboration', 'communication', 'css', 'data analysis',
  'data engineering', 'data visualization', 'database', 'devops', 'docker', 'etl', 'express',
  'figma', 'frontend', 'git', 'graphql', 'html', 'java', 'javascript', 'kubernetes', 'leadership',
  'machine learning', 'microservices', 'mongodb', 'nextjs', 'node', 'nodejs', 'postgresql',
  'problem solving', 'product management', 'python', 'react', 'redux', 'rest', 'salesforce',
  'scrum', 'security', 'sql', 'stakeholder management', 'tailwind', 'testing', 'typescript',
  'user experience', 'ux', 'vite', 'vue',
];

const ACTION_VERBS = [
  'achieved', 'analyzed', 'architected', 'automated', 'built', 'collaborated', 'created', 'delivered',
  'designed', 'developed', 'drove', 'enhanced', 'implemented', 'improved', 'increased', 'launched',
  'led', 'managed', 'migrated', 'optimized', 'owned', 'reduced', 'shipped', 'streamlined', 'tested',
];

const EMPTY_ANALYSIS: ResumeAnalysis = {
  score: 0,
  grade: 'N/A',
  keywordCoverage: 0,
  atsReadiness: 0,
  matchedKeywords: [],
  missingKeywords: [],
  atsIssues: [],
  strengths: [],
  improvements: ['Add your resume and the target job description to generate a score and rewrite.'],
  sections: {
    summary: false,
    experience: false,
    skills: false,
    education: false,
    projects: false,
    certifications: false,
  },
  rewrittenResume: '',
  summary: 'Add both documents to unlock your resume match score.',
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9+#.\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenize = (value: string) =>
  normalize(value)
    .split(' ')
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));

const titleCase = (value: string) =>
  value
    .split(' ')
    .map((word) => (word.length <= 3 ? word.toUpperCase() : `${word[0].toUpperCase()}${word.slice(1)}`))
    .join(' ')
    .replace(/\bAi\b/g, 'AI')
    .replace(/\bApi\b/g, 'API')
    .replace(/\bCss\b/g, 'CSS')
    .replace(/\bHtml\b/g, 'HTML')
    .replace(/\bSql\b/g, 'SQL')
    .replace(/\bUx\b/g, 'UX');

const clamp = (value: number, min = 0, max = 100) => Math.min(Math.max(value, min), max);

const unique = <T,>(items: T[]) => Array.from(new Set(items));

const containsTerm = (text: string, term: string) => {
  const haystack = ` ${normalize(text)} `;
  const needle = normalize(term);
  if (!needle) {
    return false;
  }

  return haystack.includes(` ${needle} `) || haystack.includes(` ${needle.replace(/s$/, '')} `);
};

const wordCount = (text: string) => tokenize(text).length;

const extractYears = (text: string) => {
  const matches = [...text.matchAll(/(\d+)\+?\s*(?:years|yrs)/gi)].map((match) => Number(match[1]));
  return matches.length ? Math.max(...matches) : 0;
};

const extractSections = (resume: string): ResumeSections => ({
  summary: /(^|\n)\s*(professional\s+summary|summary|profile|objective)\s*:?\s*(\n|$)/i.test(resume),
  experience: /(^|\n)\s*(work\s+experience|professional\s+experience|experience|employment)\s*:?\s*(\n|$)/i.test(resume),
  skills: /(^|\n)\s*(technical\s+skills|core\s+skills|skills|competencies)\s*:?\s*(\n|$)/i.test(resume),
  education: /(^|\n)\s*(education|academic\s+background)\s*:?\s*(\n|$)/i.test(resume),
  projects: /(^|\n)\s*(projects|selected\s+projects)\s*:?\s*(\n|$)/i.test(resume),
  certifications: /(^|\n)\s*(certifications|licenses|credentials)\s*:?\s*(\n|$)/i.test(resume),
});

const getContactSignals = (resume: string) => ({
  email: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(resume),
  phone: /(\+?\d[\d\s().-]{7,}\d)/.test(resume),
  linkedin: /linkedin\.com\//i.test(resume),
  portfolio: /(github\.com\/|portfolio|personal\s+site|https?:\/\/)/i.test(resume),
});

const getImportantKeywords = (jobDescription: string, limit = 28) => {
  const normalizedJob = normalize(jobDescription);
  const phraseMatches = PRIORITY_TERMS.filter((term) => containsTerm(normalizedJob, term));
  const frequency = new Map<string, number>();

  tokenize(jobDescription).forEach((word) => {
    const simplified = word.replace(/s$/, '');
    if (simplified.length > 2) {
      frequency.set(simplified, (frequency.get(simplified) ?? 0) + 1);
    }
  });

  const frequentTerms = [...frequency.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([term]) => term)
    .filter((term) => !phraseMatches.some((phrase) => phrase.includes(term)));

  return unique([...phraseMatches, ...frequentTerms]).slice(0, limit);
};

const getAtsIssues = (resume: string, sections: ResumeSections): AtsIssue[] => {
  const issues: AtsIssue[] = [];
  const contacts = getContactSignals(resume);
  const words = wordCount(resume);
  const longLines = resume.split('\n').filter((line) => line.trim().length > 180).length;
  const nonAsciiCount = [...resume].filter((character) => character.charCodeAt(0) > 127).length;

  if (words < 220) {
    issues.push({
      title: 'Resume is too short',
      detail: 'Add more role-specific accomplishments, skills, and measurable impact so the resume has enough context for ATS ranking.',
      severity: 'major',
    });
  }

  if (!contacts.email || !contacts.phone) {
    issues.push({
      title: 'Missing key contact details',
      detail: 'Include a professional email address and phone number near the top of the resume.',
      severity: 'major',
    });
  }

  if (!sections.summary) {
    issues.push({
      title: 'Missing summary section',
      detail: 'Add a short Professional Summary that mirrors the target role and strongest qualifications.',
      severity: 'moderate',
    });
  }

  if (!sections.skills) {
    issues.push({
      title: 'Missing skills section',
      detail: 'Create a Core Skills or Technical Skills section with job-relevant keywords.',
      severity: 'moderate',
    });
  }

  if (!sections.experience) {
    issues.push({
      title: 'Missing experience section',
      detail: 'Use a standard Experience heading so ATS parsers can identify work history.',
      severity: 'major',
    });
  }

  if (!sections.education) {
    issues.push({
      title: 'Missing education section',
      detail: 'Add an Education heading, even if it is concise.',
      severity: 'minor',
    });
  }

  if (/(\|.*\|)|\t/.test(resume)) {
    issues.push({
      title: 'Possible table formatting',
      detail: 'Avoid tables, columns, and tab-separated layouts. ATS systems parse single-column text more reliably.',
      severity: 'moderate',
    });
  }

  if (nonAsciiCount > 8) {
    issues.push({
      title: 'Special characters detected',
      detail: 'Replace decorative bullets, icons, and symbols with plain text characters for safer ATS parsing.',
      severity: 'minor',
    });
  }

  if (longLines > 2) {
    issues.push({
      title: 'Dense paragraphs detected',
      detail: 'Break long paragraphs into concise bullets to improve scanability for recruiters and parsers.',
      severity: 'minor',
    });
  }

  if (/\b(i|me|my|mine)\b/i.test(resume)) {
    issues.push({
      title: 'First-person language detected',
      detail: 'Resume bullets usually read stronger without first-person pronouns.',
      severity: 'minor',
    });
  }

  return issues;
};

const scoreAtsReadiness = (issues: AtsIssue[]) => {
  const penalty = issues.reduce((total, issue) => {
    if (issue.severity === 'major') {
      return total + 16;
    }

    if (issue.severity === 'moderate') {
      return total + 10;
    }

    return total + 5;
  }, 0);

  return clamp(100 - penalty);
};

const scoreImpact = (resume: string) => {
  const metrics = resume.match(/(\d+%|\$\d+|\d+x|\d+\+|\b\d{2,}\b)/gi)?.length ?? 0;
  const verbMatches = ACTION_VERBS.filter((verb) => containsTerm(resume, verb)).length;
  return clamp(metrics * 4 + verbMatches * 3, 0, 10);
};

const getGrade = (score: number) => {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'Needs work';
};

const getRoleTitle = (jobDescription: string) => {
  const titleMatch = jobDescription.match(/(?:job\s*title|role|position)\s*:?\s*([^\n.]+)/i);
  if (titleMatch?.[1]) {
    return titleMatch[1].trim().slice(0, 80);
  }

  const firstReadableLine = jobDescription
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 8 && line.length < 80 && !/[.!?]$/.test(line));

  return firstReadableLine ?? 'Target Role';
};

const getCandidateName = (resume: string) => {
  const firstLines = resume
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6);

  return (
    firstLines.find(
      (line) =>
        line.length <= 60 &&
        !/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(line) &&
        !/(\+?\d[\d\s().-]{7,}\d)/.test(line) &&
        !/linkedin|github|portfolio|http/i.test(line),
    ) ?? 'Your Name'
  );
};

const getContactLine = (resume: string) => {
  const lines = resume
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /@|\+?\d[\d\s().-]{7,}\d|linkedin|github|http/i.test(line))
    .slice(0, 3);

  return lines.length ? lines.join(' | ') : 'Email | Phone | LinkedIn | Portfolio';
};

const extractExistingBullets = (resume: string) =>
  resume
    .split('\n')
    .map((line) => line.trim().replace(/^[*\-]+\s*/, ''))
    .filter((line) => line.length > 35 && line.length < 220)
    .filter((line) => ACTION_VERBS.some((verb) => containsTerm(line, verb)) || /\d/.test(line))
    .slice(0, 8);

const buildSkillLine = (matched: string[], missing: string[]) => {
  const skills = unique([...matched, ...missing.slice(0, 10)]).slice(0, 16);
  return skills.length ? skills.map(titleCase).join(' | ') : 'Add skills from the target job description';
};

const buildResumeRewrite = (
  resume: string,
  jobDescription: string,
  matchedKeywords: string[],
  missingKeywords: string[],
) => {
  const roleTitle = getRoleTitle(jobDescription);
  const name = getCandidateName(resume);
  const contactLine = getContactLine(resume);
  const bullets = extractExistingBullets(resume);
  const topSkills = buildSkillLine(matchedKeywords, missingKeywords);
  const roleKeywords = unique([...matchedKeywords, ...missingKeywords]).slice(0, 8).map(titleCase);
  const missingSuggestions = missingKeywords.slice(0, 6).map(titleCase);

  const experienceBullets = bullets.length
    ? bullets.map((bullet) => `- ${bullet}`)
    : [
        '- Add a bullet that explains the most relevant project, responsibility, or outcome for this role.',
        '- Add a quantified accomplishment using a metric such as percentage, revenue, time saved, users served, or quality improved.',
        '- Add a bullet showing collaboration with stakeholders, teams, customers, or cross-functional partners.',
      ];

  const targetedBullets = missingSuggestions.length
    ? missingSuggestions.map((skill) => `- Add a truthful accomplishment that demonstrates ${skill} in the context of the target role.`)
    : ['- Add one more measurable accomplishment that directly matches the job description.'];

  return `${name}\n${contactLine}\n\nPROFESSIONAL SUMMARY\n${roleTitle}-focused professional with experience aligned to ${roleKeywords.slice(0, 5).join(', ') || 'the target role'}. Brings a track record of delivering practical outcomes, collaborating across teams, and communicating work clearly. Seeking to apply relevant strengths to the responsibilities described in the job posting.\n\nCORE SKILLS\n${topSkills}\n\nPROFESSIONAL EXPERIENCE\nCurrent or Most Relevant Role | Company | Dates\n${experienceBullets.join('\n')}\n${targetedBullets.join('\n')}\n\nPROJECTS OR SELECTED ACHIEVEMENTS\n- Add a role-relevant project that uses ${roleKeywords.slice(0, 3).join(', ') || 'the most important job keywords'}.\n- Add measurable impact and tools used so recruiters can quickly connect your work to the job description.\n\nEDUCATION\nDegree or Certification | Institution | Year\n\nATS FORMATTING NOTES\n- Keep this resume in a single-column layout with standard headings.\n- Use plain text bullets and avoid tables, images, icons, headers, footers, and text boxes.\n- Replace every placeholder with accurate details from your real experience before applying.`;
};

const getStrengths = (
  matchedKeywords: string[],
  sections: ResumeSections,
  atsIssues: AtsIssue[],
  resume: string,
) => {
  const strengths: string[] = [];
  if (matchedKeywords.length >= 8) {
    strengths.push('Strong keyword alignment with the job description.');
  }
  if (sections.experience && sections.skills) {
    strengths.push('Experience and skills are organized under ATS-recognizable headings.');
  }
  if (scoreImpact(resume) >= 7) {
    strengths.push('Resume includes measurable impact and action-oriented language.');
  }
  if (atsIssues.length <= 2) {
    strengths.push('Formatting appears relatively ATS-safe.');
  }

  return strengths.length ? strengths : ['The analyzer found a starting point, but the resume needs more targeted evidence.'];
};

const getImprovements = (missingKeywords: string[], atsIssues: AtsIssue[], resume: string) => {
  const improvements: string[] = [];
  if (missingKeywords.length) {
    improvements.push(`Add truthful examples for missing JD keywords: ${missingKeywords.slice(0, 5).map(titleCase).join(', ')}.`);
  }
  atsIssues.slice(0, 3).forEach((issue) => improvements.push(issue.detail));
  if (scoreImpact(resume) < 7) {
    improvements.push('Rewrite bullets with action verbs and metrics such as percentages, cost savings, revenue, speed, scale, or quality improvements.');
  }

  return unique(improvements).slice(0, 6);
};

export const analyzeResume = (resume: string, jobDescription: string): ResumeAnalysis => {
  const cleanResume = resume.trim();
  const cleanJobDescription = jobDescription.trim();

  if (!cleanResume || !cleanJobDescription) {
    return EMPTY_ANALYSIS;
  }

  const sections = extractSections(cleanResume);
  const jobKeywords = getImportantKeywords(cleanJobDescription);
  const matchedKeywords = jobKeywords.filter((keyword) => containsTerm(cleanResume, keyword));
  const missingKeywords = jobKeywords.filter((keyword) => !containsTerm(cleanResume, keyword));
  const keywordCoverage = jobKeywords.length ? Math.round((matchedKeywords.length / jobKeywords.length) * 100) : 0;
  const atsIssues = getAtsIssues(cleanResume, sections);
  const atsReadiness = scoreAtsReadiness(atsIssues);
  const structureScore =
    [sections.summary, sections.experience, sections.skills, sections.education].filter(Boolean).length * 2.5;
  const impactScore = scoreImpact(cleanResume);
  const requiredYears = extractYears(cleanJobDescription);
  const resumeYears = extractYears(cleanResume);
  const experienceScore = requiredYears ? clamp((resumeYears / requiredYears) * 15, 4, 15) : 12;
  const score = Math.round(
    clamp(keywordCoverage * 0.45 + atsReadiness * 0.2 + structureScore + impactScore + experienceScore),
  );

  return {
    score,
    grade: getGrade(score),
    keywordCoverage,
    atsReadiness,
    matchedKeywords,
    missingKeywords,
    atsIssues,
    strengths: getStrengths(matchedKeywords, sections, atsIssues, cleanResume),
    improvements: getImprovements(missingKeywords, atsIssues, cleanResume),
    sections,
    rewrittenResume: buildResumeRewrite(cleanResume, cleanJobDescription, matchedKeywords, missingKeywords),
    summary:
      score >= 80
        ? 'Your resume is well aligned. Polish the missing keywords and keep the ATS-safe structure.'
        : score >= 60
          ? 'Your resume has a workable foundation, but targeted keywords and stronger accomplishments will improve the match.'
          : 'Your resume needs more role-specific content, standard sections, and ATS-friendly formatting before applying.',
  };
};

export const sampleResume = `Alex Morgan
alex.morgan@email.com | 555-0184 | linkedin.com/in/alexmorgan | github.com/alexmorgan

Professional Summary
Frontend developer with experience building web applications, collaborating with product teams, and improving user workflows.

Skills
JavaScript, React, CSS, HTML, Git, REST APIs, Testing

Professional Experience
Frontend Developer | BrightApps | 2021 - Present
- Built reusable React components for customer-facing dashboards used by 20,000+ monthly users.
- Improved page load performance by 32% by optimizing rendering patterns and asset delivery.
- Collaborated with designers, backend engineers, and product managers to ship accessible features.

Education
B.S. Computer Science | State University | 2020`;

export const sampleJobDescription = `Role: Frontend Engineer
We are looking for a Frontend Engineer with 3+ years of experience building accessible, high-quality web applications. The ideal candidate has strong React, TypeScript, JavaScript, CSS, HTML, REST API, testing, and Git experience. Responsibilities include collaborating with product and design, improving user experience, building reusable components, writing automated tests, and optimizing frontend performance. Experience with Vite, accessibility standards, agile teams, and data visualization is a plus.`;
