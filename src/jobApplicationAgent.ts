import type { ResumeAnalysis } from './resumeAgent';

export interface ApplicationAgentInput {
  resume: string;
  jobDescription: string;
  companyName: string;
  jobUrl: string;
  contactName: string;
  analysis: ResumeAnalysis;
}

export interface ApplicationChecklistItem {
  title: string;
  detail: string;
  status: 'ready' | 'review' | 'needed';
}

export interface FollowUpStep {
  timing: string;
  action: string;
}

export interface ApplicationFormAnswer {
  question: string;
  answer: string;
}

export interface ApplicationTracker {
  company: string;
  role: string;
  status: string;
  applicationUrl: string;
  contact: string;
  matchScore: number;
  missingKeywords: string;
  nextStep: string;
  followUpDate: string;
  notes: string;
}

export interface JobApplicationKit {
  companyName: string;
  targetRole: string;
  readinessScore: number;
  readinessLabel: string;
  applicationSummary: string;
  checklist: ApplicationChecklistItem[];
  priorityActions: string[];
  coverLetter: string;
  outreachMessage: string;
  followUpPlan: FollowUpStep[];
  formAnswers: ApplicationFormAnswer[];
  tracker: ApplicationTracker;
  trackerCsv: string;
  kitText: string;
}

const clamp = (value: number, min = 0, max = 100) => Math.min(Math.max(value, min), max);

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9+#.\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

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

const containsTerm = (text: string, term: string) => {
  const haystack = ` ${normalize(text)} `;
  const needle = normalize(term);
  return Boolean(needle && (haystack.includes(` ${needle} `) || haystack.includes(` ${needle.replace(/s$/, '')} `)));
};

const formatList = (items: string[], fallback: string) => {
  const values = items.filter(Boolean);
  if (!values.length) {
    return fallback;
  }

  if (values.length === 1) {
    return titleCase(values[0]);
  }

  return `${values.slice(0, -1).map(titleCase).join(', ')} and ${titleCase(values[values.length - 1])}`;
};

const csvEscape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

const addBusinessDays = (days: number) => {
  const date = new Date();
  let remaining = days;

  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) {
      remaining -= 1;
    }
  }

  return date.toISOString().slice(0, 10);
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

const extractRelevantBullets = (resume: string, matchedKeywords: string[]) =>
  resume
    .split('\n')
    .map((line) => line.trim().replace(/^[*\-]+\s*/, ''))
    .filter((line) => line.length > 35 && line.length < 220)
    .filter((line) => /\d/.test(line) || matchedKeywords.some((keyword) => containsTerm(line, keyword)))
    .slice(0, 3);

const buildChecklist = (analysis: ResumeAnalysis, jobUrl: string): ApplicationChecklistItem[] => [
  {
    title: 'Resume tailored to the role',
    detail:
      analysis.missingKeywords.length > 0
        ? `Add truthful examples for ${formatList(analysis.missingKeywords.slice(0, 4), 'the top missing keywords')}.`
        : 'Keyword coverage looks strong. Do a final proofread before uploading.',
    status: analysis.missingKeywords.length > 3 ? 'needed' : 'ready',
  },
  {
    title: 'ATS-safe resume file ready',
    detail:
      analysis.atsReadiness >= 80
        ? 'Use the ATS-friendly draft as the source for your final PDF or text upload.'
        : 'Resolve the highest-priority ATS findings before submitting.',
    status: analysis.atsReadiness >= 80 ? 'ready' : 'review',
  },
  {
    title: 'Application link captured',
    detail: jobUrl.trim() ? 'The tracker export includes the application URL.' : 'Paste the job posting URL to keep the tracker actionable.',
    status: jobUrl.trim() ? 'ready' : 'review',
  },
  {
    title: 'Outreach and follow-up prepared',
    detail: 'Use the generated recruiter message and follow-up schedule after applying.',
    status: 'ready',
  },
];

const buildPriorityActions = (analysis: ResumeAnalysis, companyName: string) => {
  const actions = [
    analysis.missingKeywords.length
      ? `Add verified resume evidence for ${formatList(analysis.missingKeywords.slice(0, 5), 'the most important missing keywords')}.`
      : 'Keep the resume wording consistent with the job description and avoid adding unsupported claims.',
    analysis.atsIssues[0]?.detail ?? 'Save the final resume with a clear filename that includes your name and the target role.',
    `Submit through ${companyName}'s official application flow, then log the status and follow-up date in the tracker.`,
    'Send the outreach message only after the application is submitted so the note can reference the completed application.',
  ];

  return actions.slice(0, 4);
};

const buildCoverLetter = (
  candidateName: string,
  companyName: string,
  targetRole: string,
  analysis: ResumeAnalysis,
  resume: string,
) => {
  const matched = analysis.matchedKeywords.slice(0, 5);
  const missing = analysis.missingKeywords.slice(0, 3);
  const bullets = extractRelevantBullets(resume, analysis.matchedKeywords);
  const proof = bullets.length
    ? bullets.map((bullet) => `- ${bullet}`).join('\n')
    : '- Add one verified accomplishment that best matches this role before sending.';

  return `Dear ${companyName} Hiring Team,

I am excited to apply for the ${targetRole} role at ${companyName}. My background aligns with the posting's emphasis on ${formatList(matched, 'the core requirements in the job description')}, and I am interested in contributing to work where those strengths can create measurable outcomes.

Relevant proof points from my background:
${proof}

Before submitting, I will make sure my final resume truthfully addresses ${formatList(missing, 'any remaining gaps')} and stays in an ATS-friendly format. I would welcome the opportunity to discuss how my experience can support ${companyName}'s team.

Sincerely,
${candidateName}`;
};

const buildOutreachMessage = (
  candidateName: string,
  contactName: string,
  companyName: string,
  targetRole: string,
  analysis: ResumeAnalysis,
) => {
  const greeting = contactName.trim() ? `Hi ${contactName.trim()},` : 'Hi,';
  return `${greeting}

I just applied for the ${targetRole} role at ${companyName}. The role stood out because it emphasizes ${formatList(
    analysis.matchedKeywords.slice(0, 4),
    'the same strengths highlighted in my background',
  )}. I would appreciate your consideration and would be glad to share more context on how my experience maps to the team's needs.

Thank you,
${candidateName}`;
};

const buildFormAnswers = (analysis: ResumeAnalysis, targetRole: string, companyName: string): ApplicationFormAnswer[] => [
  {
    question: 'Why are you interested in this role?',
    answer: `I am interested in the ${targetRole} role because it matches my experience with ${formatList(
      analysis.matchedKeywords.slice(0, 4),
      'the responsibilities described in the posting',
    )} and offers an opportunity to contribute those strengths at ${companyName}.`,
  },
  {
    question: 'Why are you a strong fit?',
    answer: `My resume currently matches ${analysis.keywordCoverage}% of the tracked job keywords and includes relevant experience in ${formatList(
      analysis.matchedKeywords.slice(0, 5),
      'the target role requirements',
    )}. I will keep the final answer specific to verified accomplishments from my background.`,
  },
  {
    question: 'Is there anything else you would like us to know?',
    answer:
      analysis.missingKeywords.length > 0
        ? `I am actively tailoring my application materials to clarify experience related to ${formatList(
            analysis.missingKeywords.slice(0, 3),
            'the remaining role requirements',
          )}, without adding unsupported claims.`
        : 'My application materials are tailored to the role, ATS-friendly, and ready for recruiter review.',
  },
];

const buildTracker = (
  companyName: string,
  targetRole: string,
  jobUrl: string,
  contactName: string,
  analysis: ResumeAnalysis,
  priorityActions: string[],
): ApplicationTracker => ({
  company: companyName,
  role: targetRole,
  status: 'Ready to apply',
  applicationUrl: jobUrl.trim() || 'Add URL',
  contact: contactName.trim() || 'Add recruiter or hiring manager',
  matchScore: analysis.score,
  missingKeywords: analysis.missingKeywords.slice(0, 8).map(titleCase).join('; ') || 'None flagged',
  nextStep: priorityActions[0],
  followUpDate: addBusinessDays(3),
  notes: 'Generated by the job application automation agent. Verify every claim before submitting.',
});

const buildTrackerCsv = (tracker: ApplicationTracker) => {
  const headers = Object.keys(tracker) as Array<keyof ApplicationTracker>;
  return `${headers.map(csvEscape).join(',')}\n${headers.map((header) => csvEscape(tracker[header])).join(',')}`;
};

const buildKitText = (
  checklist: ApplicationChecklistItem[],
  priorityActions: string[],
  coverLetter: string,
  outreachMessage: string,
  followUpPlan: FollowUpStep[],
  formAnswers: ApplicationFormAnswer[],
  tracker: ApplicationTracker,
) => `JOB APPLICATION AUTOMATION KIT

APPLICATION CHECKLIST
${checklist.map((item) => `- [${item.status.toUpperCase()}] ${item.title}: ${item.detail}`).join('\n')}

PRIORITY ACTIONS
${priorityActions.map((action, index) => `${index + 1}. ${action}`).join('\n')}

COVER LETTER DRAFT
${coverLetter}

RECRUITER OUTREACH MESSAGE
${outreachMessage}

FOLLOW-UP PLAN
${followUpPlan.map((step) => `- ${step.timing}: ${step.action}`).join('\n')}

COMMON APPLICATION ANSWERS
${formAnswers.map((item) => `Q: ${item.question}\nA: ${item.answer}`).join('\n\n')}

TRACKER SNAPSHOT
${Object.entries(tracker)
  .map(([key, value]) => `${key}: ${value}`)
  .join('\n')}
`;

export const generateJobApplicationKit = ({
  resume,
  jobDescription,
  companyName,
  jobUrl,
  contactName,
  analysis,
}: ApplicationAgentInput): JobApplicationKit => {
  const targetRole = getRoleTitle(jobDescription);
  const resolvedCompany = companyName.trim() || 'Target Company';
  const candidateName = getCandidateName(resume);
  const readinessScore = Math.round(
    clamp(analysis.score * 0.45 + analysis.keywordCoverage * 0.25 + analysis.atsReadiness * 0.2 + Math.min(analysis.matchedKeywords.length * 2, 10)),
  );
  const readinessLabel = readinessScore >= 80 ? 'Ready to apply' : readinessScore >= 65 ? 'Needs final tailoring' : 'Needs focused prep';
  const checklist = buildChecklist(analysis, jobUrl);
  const priorityActions = buildPriorityActions(analysis, resolvedCompany);
  const coverLetter = buildCoverLetter(candidateName, resolvedCompany, targetRole, analysis, resume);
  const outreachMessage = buildOutreachMessage(candidateName, contactName, resolvedCompany, targetRole, analysis);
  const followUpPlan: FollowUpStep[] = [
    { timing: 'Application day', action: 'Submit through the official posting and save the confirmation details.' },
    { timing: '1 business day later', action: 'Send the concise recruiter outreach message if a relevant contact is known.' },
    { timing: '3 business days later', action: 'Follow up with a short note referencing the role and your submitted application.' },
    { timing: '7 business days later', action: 'Move the tracker status to follow-up complete or search for a warmer referral path.' },
  ];
  const formAnswers = buildFormAnswers(analysis, targetRole, resolvedCompany);
  const tracker = buildTracker(resolvedCompany, targetRole, jobUrl, contactName, analysis, priorityActions);
  const trackerCsv = buildTrackerCsv(tracker);
  const kitText = buildKitText(checklist, priorityActions, coverLetter, outreachMessage, followUpPlan, formAnswers, tracker);

  return {
    companyName: resolvedCompany,
    targetRole,
    readinessScore,
    readinessLabel,
    applicationSummary: `${readinessLabel}: ${analysis.score}/100 resume match, ${analysis.keywordCoverage}% keyword coverage, and ${analysis.atsReadiness}% ATS readiness for ${targetRole} at ${resolvedCompany}.`,
    checklist,
    priorityActions,
    coverLetter,
    outreachMessage,
    followUpPlan,
    formAnswers,
    tracker,
    trackerCsv,
    kitText,
  };
};
