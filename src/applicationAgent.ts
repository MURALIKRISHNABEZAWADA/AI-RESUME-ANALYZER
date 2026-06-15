import type { ResumeAnalysis } from './resumeAgent';

export type ApplicationStatus = 'ready' | 'review' | 'missing';

export interface JobApplicationInput {
  resume: string;
  jobDescription: string;
  jobUrl: string;
  companyName: string;
  applicantNotes: string;
  analysis: ResumeAnalysis;
}

export interface ApplicationFieldSuggestion {
  label: string;
  suggestedValue: string;
  status: ApplicationStatus;
  source: string;
}

export interface ApplicationStep {
  title: string;
  detail: string;
  status: 'ready' | 'needs_review';
}

export interface ApplicationBlocker {
  title: string;
  detail: string;
  severity: 'high' | 'medium' | 'low';
}

export interface JobApplicationPlan {
  readinessScore: number;
  status: string;
  roleTitle: string;
  companyName: string;
  jobUrl: string;
  summary: string;
  fieldChecklist: ApplicationFieldSuggestion[];
  blockers: ApplicationBlocker[];
  steps: ApplicationStep[];
  coverLetter: string;
  recruiterMessage: string;
  applicationPacket: string;
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

const clamp = (value: number, min = 0, max = 100) => Math.min(Math.max(value, min), max);

const firstMatch = (pattern: RegExp, text: string) => {
  const match = text.match(pattern);
  return match?.[1]?.trim() ?? match?.[0]?.trim() ?? '';
};

const getRoleTitle = (jobDescription: string) => {
  const titleMatch = jobDescription.match(/(?:job\s*title|role|position)\s*:?\s*([^\n.]+)/i);
  if (titleMatch?.[1]) {
    return titleMatch[1].trim().slice(0, 80);
  }

  return (
    jobDescription
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 8 && line.length < 80 && !/[.!?]$/.test(line)) ?? 'Target Role'
  );
};

const getCandidateName = (resume: string) =>
  resume
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6)
    .find(
      (line) =>
        line.length <= 60 &&
        !/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(line) &&
        !/(\+?\d[\d\s().-]{7,}\d)/.test(line) &&
        !/linkedin|github|portfolio|http/i.test(line),
    ) ?? 'Your Name';

const getCompanyFromUrl = (jobUrl: string) => {
  try {
    const host = new URL(jobUrl).hostname.toLowerCase().replace(/^www\./, '');
    const parts = host.split('.').filter((part) => !['jobs', 'careers', 'apply', 'greenhouse', 'lever'].includes(part));
    return parts[0] ? titleCase(parts[0].replace(/-/g, ' ')) : '';
  } catch {
    return '';
  }
};

const getCompanyName = (jobDescription: string, jobUrl: string, suppliedCompany: string) => {
  if (suppliedCompany.trim()) {
    return suppliedCompany.trim();
  }

  const companyLine = jobDescription
    .split('\n')
    .slice(0, 12)
    .map((line) => line.trim().match(/^(?:company|organization|employer)\s*:?\s*(.+)$/i)?.[1])
    .find(Boolean);

  return companyLine?.slice(0, 80) ?? getCompanyFromUrl(jobUrl);
};

const hasPlaceholder = (value: string) =>
  /Degree or Certification|Current or Most Relevant Role|Add a truthful|Add a role-relevant|Your Name|Email \| Phone/i.test(value);

const makeField = (
  label: string,
  suggestedValue: string,
  source: string,
  reviewWhenPresent = false,
): ApplicationFieldSuggestion => {
  if (!suggestedValue) {
    return { label, suggestedValue: 'Needs manual input', status: 'missing', source };
  }

  return {
    label,
    suggestedValue,
    status: reviewWhenPresent ? 'review' : 'ready',
    source,
  };
};

export const buildJobApplicationPlan = ({
  resume,
  jobDescription,
  jobUrl,
  companyName,
  applicantNotes,
  analysis,
}: JobApplicationInput): JobApplicationPlan => {
  const candidateName = getCandidateName(resume);
  const roleTitle = getRoleTitle(jobDescription);
  const resolvedCompany = getCompanyName(jobDescription, jobUrl, companyName);
  const email = firstMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i, resume);
  const phone = firstMatch(/(\+?\d[\d\s().-]{7,}\d)/, resume);
  const linkedin = firstMatch(/((?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s|,]+)/i, resume);
  const portfolio = firstMatch(/((?:https?:\/\/)?(?:www\.)?(?:github\.com|[a-z0-9.-]+\.[a-z]{2,})\/[^\s|,]+)/i, resume);
  const placeholdersPresent = hasPlaceholder(analysis.rewrittenResume);
  const blockerList: ApplicationBlocker[] = [];

  if (analysis.score < 60) {
    blockerList.push({
      title: 'Resume match is below apply-ready threshold',
      detail: 'Improve the tailored resume before applying so the application better reflects the job description.',
      severity: 'high',
    });
  }
  if (!email || !phone) {
    blockerList.push({
      title: 'Contact details need review',
      detail: 'Add a professional email address and phone number before submitting an application.',
      severity: 'high',
    });
  }
  if (placeholdersPresent) {
    blockerList.push({
      title: 'Tailored resume contains placeholders',
      detail: 'Replace generated placeholders with verified experience, education, dates, and accomplishments.',
      severity: 'high',
    });
  }
  if (!jobUrl.trim()) {
    blockerList.push({
      title: 'Job posting URL is missing',
      detail: 'Add the job URL so the agent can track the source and prepare a clean application packet.',
      severity: 'medium',
    });
  }
  if (analysis.missingKeywords.length) {
    blockerList.push({
      title: 'Missing job-description keywords',
      detail: `Add truthful evidence for: ${analysis.missingKeywords.slice(0, 6).map(titleCase).join(', ')}.`,
      severity: 'medium',
    });
  }

  const readinessScore = Math.round(
    clamp(
      analysis.score -
        (email ? 0 : 15) -
        (phone ? 0 : 15) -
        (placeholdersPresent ? 10 : 0) -
        (jobUrl.trim() ? 0 : 8) -
        (resolvedCompany ? 0 : 6) -
        (analysis.missingKeywords.length > 10 ? 8 : 0),
    ),
  );
  const fieldChecklist: ApplicationFieldSuggestion[] = [
    makeField('Full name', candidateName, 'resume'),
    makeField('Email', email, 'resume'),
    makeField('Phone', phone, 'resume'),
    makeField('LinkedIn', linkedin, 'resume', true),
    makeField('Portfolio or GitHub', portfolio, 'resume', true),
    makeField('Target role', roleTitle, 'job description'),
    makeField('Company', resolvedCompany, 'job description or job URL'),
    makeField('Job posting URL', jobUrl.trim(), 'user input'),
    makeField('Tailored resume', 'Optimized resume draft is ready to review', 'resume rewrite agent', placeholdersPresent),
    makeField('Cover letter', 'Generated cover letter draft is ready to review', 'application agent', true),
  ];
  const steps: ApplicationStep[] = [
    {
      title: 'Verify job source',
      detail: 'Confirm the company, role title, and posting URL are correct before using any application materials.',
      status: jobUrl.trim() && resolvedCompany ? 'ready' : 'needs_review',
    },
    {
      title: 'Finalize tailored resume',
      detail: 'Replace placeholders and add truthful accomplishments for missing keywords before uploading.',
      status: placeholdersPresent || analysis.missingKeywords.length ? 'needs_review' : 'ready',
    },
    {
      title: 'Review generated answers',
      detail: 'Check every suggested field for accuracy, especially links, authorization, salary, and availability.',
      status: 'needs_review',
    },
    {
      title: 'Submit manually',
      detail: 'Use the packet to fill the job board, then submit only after a final human review.',
      status: 'needs_review',
    },
  ];
  const companyLine = resolvedCompany || 'your team';
  const companyPossessive = companyLine.endsWith('s') ? `${companyLine}'` : `${companyLine}'s`;
  const topKeywords = analysis.matchedKeywords.slice(0, 4).map(titleCase).join(', ') || "the role's core requirements";
  const noteSentence = applicantNotes.trim() ? ` I would also highlight: ${applicantNotes.trim()}` : '';
  const coverLetter = [
    `Dear ${companyLine} hiring team,`,
    '',
    `I am excited to apply for the ${roleTitle} role. My background aligns with ${topKeywords}, and I bring a practical track record of turning requirements into reliable outcomes.`,
    '',
    `In this application, I would emphasize verified accomplishments from my resume, connect them directly to ${companyPossessive} needs, and keep the materials concise for both recruiters and ATS systems.${noteSentence}`,
    '',
    'Thank you for your time and consideration. I would welcome the opportunity to discuss how my experience can help your team.',
    '',
    `Sincerely,\n${candidateName}`,
  ].join('\n');
  const recruiterMessage = `Hi, I am interested in the ${roleTitle} role${
    resolvedCompany ? ` at ${resolvedCompany}` : ''
  }. My background aligns with ${
    analysis.matchedKeywords.slice(0, 3).map(titleCase).join(', ') || 'the role requirements'
  }, and I would appreciate the chance to share more.`;
  const applicationPacket = [
    `APPLICATION PLAN FOR ${resolvedCompany || 'TARGET COMPANY'} - ${roleTitle}`,
    `Job URL: ${jobUrl.trim() || 'Add job URL before applying'}`,
    `Readiness: ${readinessScore}/100 (${readinessScore >= 75 ? 'ready for final review' : 'needs review'})`,
    '',
    'FIELD CHECKLIST',
    ...fieldChecklist.map((field) => `- ${field.label}: ${field.suggestedValue} [${field.status}]`),
    '',
    'BLOCKERS',
    ...(blockerList.length ? blockerList.map((blocker) => `- ${blocker.title}: ${blocker.detail}`) : ['- No major blockers detected.']),
    '',
    'COVER LETTER DRAFT',
    coverLetter,
    '',
    'RECRUITER MESSAGE',
    recruiterMessage,
    '',
    'TAILORED RESUME DRAFT',
    analysis.rewrittenResume,
  ].join('\n');

  return {
    readinessScore,
    status:
      readinessScore >= 75 && !blockerList.some((blocker) => blocker.severity === 'high')
        ? 'Ready for final review'
        : 'Needs review',
    roleTitle,
    companyName: resolvedCompany,
    jobUrl: jobUrl.trim(),
    summary:
      'The agent prepared a tailored application packet, highlighted blockers, and generated materials for manual review. It does not submit applications automatically.',
    fieldChecklist,
    blockers: blockerList,
    steps,
    coverLetter,
    recruiterMessage,
    applicationPacket,
  };
};
