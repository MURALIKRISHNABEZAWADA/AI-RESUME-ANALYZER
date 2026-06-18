import type { ResumeAnalysis } from './resumeAgent';

export type ApplicationReadiness = 'Apply now' | 'Customize first' | 'Hold';

export interface ApplicationStep {
  title: string;
  detail: string;
  automationTip: string;
}

export interface ProfileField {
  label: string;
  value: string;
  confidence: 'ready' | 'review' | 'missing';
}

export interface ApplicationDrafts {
  coverLetter: string;
  recruiterMessage: string;
  followUpMessage: string;
}

export interface ApplicationTracker {
  roleTitle: string;
  companyName: string;
  source: string;
  status: string;
  nextAction: string;
  notes: string;
  csv: string;
}

export interface JobApplicationPlan {
  readiness: ApplicationReadiness;
  priorityScore: number;
  roleTitle: string;
  companyName: string;
  candidateName: string;
  summary: string;
  steps: ApplicationStep[];
  profileFields: ProfileField[];
  documents: string[];
  drafts: ApplicationDrafts;
  tracker: ApplicationTracker;
  applicationKit: string;
}

const titleCase = (value: string) =>
  value
    .split(' ')
    .filter(Boolean)
    .map((word) => (word.length <= 3 ? word.toUpperCase() : `${word[0].toUpperCase()}${word.slice(1)}`))
    .join(' ')
    .replace(/\bAi\b/g, 'AI')
    .replace(/\bApi\b/g, 'API')
    .replace(/\bCss\b/g, 'CSS')
    .replace(/\bHtml\b/g, 'HTML')
    .replace(/\bSql\b/g, 'SQL')
    .replace(/\bUx\b/g, 'UX');

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const quoteCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;

const firstMatch = (value: string, patterns: RegExp[]) => {
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]) {
      return normalizeWhitespace(match[1]).replace(/[|.]+$/, '').trim();
    }
  }

  return '';
};

const getRoleTitle = (jobDescription: string) => {
  const explicitTitle = firstMatch(jobDescription, [
    /(?:job\s*title|role|position)\s*:?\s*([^\n.]+)/i,
    /hiring\s+(?:a|an|for)\s+([^\n.]+)/i,
  ]);

  if (explicitTitle) {
    return explicitTitle.slice(0, 80);
  }

  const readableLine = jobDescription
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 8 && line.length < 80 && !/[.!?]$/.test(line));

  return readableLine ?? 'Target Role';
};

const getCompanyName = (jobDescription: string) => {
  const explicitCompany = firstMatch(jobDescription, [
    /(?:company|employer|organization)\s*:?\s*([^\n.]+)/i,
    /(?:join|at)\s+([A-Z][A-Za-z0-9&.,' -]{2,70})(?:\s+(?:as|to|where|and|for)\b|[.\n])/,
  ]);

  return explicitCompany ? explicitCompany.slice(0, 70) : 'Target Company';
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

const getProfileFields = (resume: string, candidateName: string): ProfileField[] => {
  const email = resume.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? '';
  const phone = resume.match(/(\+?\d[\d\s().-]{7,}\d)/)?.[0] ?? '';
  const linkedin = resume.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s|)]+/i)?.[0] ?? '';
  const portfolio =
    resume.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[^\s|)]+/i)?.[0] ??
    resume.match(/(?:portfolio|personal\s+site)\s*:?\s*(https?:\/\/[^\s|)]+)/i)?.[1] ??
    '';
  const location =
    resume
      .split('\n')
      .map((line) => line.trim())
      .find((line) => /^[A-Za-z .'-]+,\s*[A-Z]{2}(?:\s+\d{5})?$/.test(line)) ?? '';

  return [
    { label: 'Name', value: candidateName, confidence: candidateName === 'Your Name' ? 'missing' : 'ready' },
    { label: 'Email', value: email || 'Add professional email', confidence: email ? 'ready' : 'missing' },
    { label: 'Phone', value: phone || 'Add phone number', confidence: phone ? 'ready' : 'missing' },
    { label: 'LinkedIn', value: linkedin || 'Add LinkedIn URL', confidence: linkedin ? 'ready' : 'review' },
    { label: 'Portfolio/GitHub', value: portfolio || 'Add portfolio or GitHub URL', confidence: portfolio ? 'ready' : 'review' },
    { label: 'Location', value: location || 'Add city, state if required', confidence: location ? 'ready' : 'review' },
  ];
};

const getPriorityScore = (analysis: ResumeAnalysis, profileFields: ProfileField[]) => {
  const profileScore = profileFields.filter((field) => field.confidence === 'ready').length * 4;
  const missingKeywordPenalty = Math.min(analysis.missingKeywords.length * 1.5, 18);
  const issuePenalty = Math.min(analysis.atsIssues.length * 2, 12);

  return Math.round(
    Math.min(
      Math.max(analysis.score * 0.52 + analysis.keywordCoverage * 0.18 + analysis.atsReadiness * 0.18 + profileScore - missingKeywordPenalty - issuePenalty, 0),
      100,
    ),
  );
};

const getReadiness = (priorityScore: number, analysis: ResumeAnalysis): ApplicationReadiness => {
  if (priorityScore >= 74 && analysis.atsIssues.filter((issue) => issue.severity === 'major').length <= 1) {
    return 'Apply now';
  }

  if (priorityScore >= 50) {
    return 'Customize first';
  }

  return 'Hold';
};

const getSummary = (readiness: ApplicationReadiness, roleTitle: string, companyName: string, analysis: ResumeAnalysis) => {
  const missing = analysis.missingKeywords.slice(0, 3).map(titleCase).join(', ');

  if (readiness === 'Apply now') {
    return `Application is ready for ${roleTitle} at ${companyName}. Submit with the tailored resume, then log the tracker row and schedule follow-up.`;
  }

  if (readiness === 'Customize first') {
    return `Customize before applying to ${roleTitle} at ${companyName}. Add evidence for ${missing || 'the highest-value missing JD keywords'} and resolve the top ATS findings.`;
  }

  return `Hold this application until the resume is materially closer to ${roleTitle}. Build proof for ${missing || 'the core job requirements'} before spending time on submission.`;
};

const getSteps = (readiness: ApplicationReadiness, analysis: ResumeAnalysis): ApplicationStep[] => {
  const missingKeywords = analysis.missingKeywords.slice(0, 5).map(titleCase).join(', ') || 'No major missing keywords';
  const firstIssue = analysis.atsIssues[0]?.detail ?? 'Keep the resume in a simple single-column format.';
  const submitDetail =
    readiness === 'Hold'
      ? 'Do not submit yet. Create or improve one relevant project, accomplishment, or credential, then rerun the analyzer.'
      : 'Submit only after the resume and application answers truthfully reflect the target job description.';

  return [
    {
      title: readiness === 'Apply now' ? 'Package the tailored resume' : 'Close resume gaps',
      detail: readiness === 'Apply now' ? 'Use the ATS-friendly draft and confirm all placeholders are replaced.' : `Add truthful proof for: ${missingKeywords}.`,
      automationTip: 'Use the generated resume draft as the source document for the application form.',
    },
    {
      title: 'Fix parser blockers',
      detail: firstIssue,
      automationTip: 'Copy the ATS findings into your editing checklist before exporting a PDF.',
    },
    {
      title: 'Prepare application answers',
      detail: 'Use the profile fields below for common autofill prompts and verify every extracted value.',
      automationTip: 'Keep these fields in a browser profile, password manager note, or spreadsheet for repeat applications.',
    },
    {
      title: 'Send tailored outreach',
      detail: 'Use the recruiter message before or shortly after applying when a recruiter or hiring manager is visible.',
      automationTip: 'Personalize the first sentence with one company-specific reason before sending.',
    },
    {
      title: 'Submit and track',
      detail: submitDetail,
      automationTip: 'Download the tracker CSV row and paste it into your job-search spreadsheet.',
    },
    {
      title: 'Follow up',
      detail: 'If there is no response after several business days, send the follow-up message and update the tracker status.',
      automationTip: 'Create a calendar reminder immediately after logging the application.',
    },
  ];
};

const buildDocuments = (analysis: ResumeAnalysis) => [
  'Tailored ATS resume draft',
  'Plain text resume for application forms',
  analysis.missingKeywords.length ? 'Keyword gap checklist' : 'Final proofreading checklist',
  'Cover letter draft',
  'Recruiter outreach and follow-up messages',
  'Application tracker CSV row',
];

const buildDrafts = (
  candidateName: string,
  roleTitle: string,
  companyName: string,
  analysis: ResumeAnalysis,
): ApplicationDrafts => {
  const strengths = analysis.strengths.slice(0, 2).join(' ');
  const matched = analysis.matchedKeywords.slice(0, 6).map(titleCase).join(', ') || 'the role requirements';
  const missing = analysis.missingKeywords.slice(0, 3).map(titleCase).join(', ');
  const improvementLine = missing
    ? `Before submitting, I will make sure my resume truthfully addresses ${missing}.`
    : 'My resume is already closely aligned to the job description.';

  return {
    coverLetter: `Dear Hiring Team,\n\nI am excited to apply for the ${roleTitle} role at ${companyName}. My background aligns with ${matched}, and the resume analysis highlights this fit: ${strengths}\n\nI would bring a practical, outcomes-focused approach to the responsibilities in your job description. ${improvementLine}\n\nThank you for your consideration. I would welcome the chance to discuss how my experience can support ${companyName}.\n\nSincerely,\n${candidateName}`,
    recruiterMessage: `Hi, I am interested in the ${roleTitle} role at ${companyName}. My experience aligns with ${matched}. I just applied or am preparing to apply, and I would appreciate the chance to share why my background could be a strong fit.`,
    followUpMessage: `Hi, I wanted to follow up on my application for the ${roleTitle} role at ${companyName}. I remain very interested and would be glad to provide any additional context about my experience with ${matched}. Thank you for your time.`,
  };
};

const buildTracker = (
  roleTitle: string,
  companyName: string,
  readiness: ApplicationReadiness,
  priorityScore: number,
  analysis: ResumeAnalysis,
): ApplicationTracker => {
  const source = 'Paste job URL';
  const status = readiness === 'Hold' ? 'Researching' : 'Ready to apply';
  const nextAction = readiness === 'Apply now' ? 'Submit application and send outreach' : 'Customize resume before applying';
  const notes = `${priorityScore}/100 priority. Missing keywords: ${analysis.missingKeywords.slice(0, 5).map(titleCase).join(', ') || 'None'}.`;
  const headers = ['Company', 'Role', 'Source', 'Status', 'Priority', 'Next Action', 'Notes'];
  const values = [companyName, roleTitle, source, status, String(priorityScore), nextAction, notes];

  return {
    roleTitle,
    companyName,
    source,
    status,
    nextAction,
    notes,
    csv: `${headers.map(quoteCsv).join(',')}\n${values.map(quoteCsv).join(',')}`,
  };
};

const buildApplicationKit = (plan: Omit<JobApplicationPlan, 'applicationKit'>) =>
  [
    `JOB APPLICATION AUTOMATION KIT`,
    `Candidate: ${plan.candidateName}`,
    `Company: ${plan.companyName}`,
    `Role: ${plan.roleTitle}`,
    `Readiness: ${plan.readiness} (${plan.priorityScore}/100)`,
    '',
    'SUMMARY',
    plan.summary,
    '',
    'AUTOFILL PROFILE',
    ...plan.profileFields.map((field) => `- ${field.label}: ${field.value}`),
    '',
    'APPLICATION STEPS',
    ...plan.steps.map((step, index) => `${index + 1}. ${step.title}: ${step.detail} Automation tip: ${step.automationTip}`),
    '',
    'DOCUMENTS TO PREPARE',
    ...plan.documents.map((document) => `- ${document}`),
    '',
    'COVER LETTER DRAFT',
    plan.drafts.coverLetter,
    '',
    'RECRUITER MESSAGE',
    plan.drafts.recruiterMessage,
    '',
    'FOLLOW-UP MESSAGE',
    plan.drafts.followUpMessage,
    '',
    'TRACKER CSV',
    plan.tracker.csv,
  ].join('\n');

export const createJobApplicationPlan = (
  resume: string,
  jobDescription: string,
  analysis: ResumeAnalysis,
): JobApplicationPlan => {
  const roleTitle = getRoleTitle(jobDescription);
  const companyName = getCompanyName(jobDescription);
  const candidateName = getCandidateName(resume);
  const profileFields = getProfileFields(resume, candidateName);
  const priorityScore = getPriorityScore(analysis, profileFields);
  const readiness = getReadiness(priorityScore, analysis);
  const summary = getSummary(readiness, roleTitle, companyName, analysis);
  const steps = getSteps(readiness, analysis);
  const documents = buildDocuments(analysis);
  const drafts = buildDrafts(candidateName, roleTitle, companyName, analysis);
  const tracker = buildTracker(roleTitle, companyName, readiness, priorityScore, analysis);
  const plan = {
    readiness,
    priorityScore,
    roleTitle,
    companyName,
    candidateName,
    summary,
    steps,
    profileFields,
    documents,
    drafts,
    tracker,
  };

  return {
    ...plan,
    applicationKit: buildApplicationKit(plan),
  };
};
