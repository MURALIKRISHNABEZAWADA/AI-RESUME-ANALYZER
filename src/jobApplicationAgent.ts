import { analyzeResume, ResumeAnalysis } from './resumeAgent';

export type ApplicationPriority = 'required' | 'recommended' | 'optional';
export type ApplicationRiskLevel = 'low' | 'medium' | 'high';
export type ApplicationStatus = 'draft' | 'ready' | 'submitted' | 'follow-up';

export interface JobApplicationInput {
  resume: string;
  jobDescription: string;
  companyName?: string;
  roleTitle?: string;
  jobUrl?: string;
  recruiterName?: string;
}

export interface ApplicationTask {
  title: string;
  detail: string;
  priority: ApplicationPriority;
}

export interface ApplicationField {
  label: string;
  value: string;
  source: string;
  confidence: 'high' | 'medium' | 'needs-review';
}

export interface ApplicationRisk {
  title: string;
  detail: string;
  level: ApplicationRiskLevel;
}

export interface ApplicationPlan {
  roleTitle: string;
  companyName: string;
  portalType: string;
  jobUrl: string;
  readinessScore: number;
  readinessLevel: string;
  nextStep: string;
  status: ApplicationStatus;
  analysis: ResumeAnalysis;
  checklist: ApplicationTask[];
  fieldMap: ApplicationField[];
  coverLetter: string;
  outreachMessage: string;
  followUpMessage: string;
  applicationPacket: string;
  risks: ApplicationRisk[];
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

const extractFirstMatch = (text: string, pattern: RegExp) => text.match(pattern)?.[1]?.trim() ?? '';

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

const getContactValue = (resume: string, pattern: RegExp, fallback: string) => extractFirstMatch(resume, pattern) || fallback;

const inferRoleTitle = (jobDescription: string, fallback?: string) => {
  if (fallback?.trim()) {
    return fallback.trim();
  }

  const explicitTitle = extractFirstMatch(jobDescription, /(?:job\s*title|role|position)\s*:?\s*([^\n.]+)/i);
  if (explicitTitle) {
    return explicitTitle.slice(0, 80);
  }

  return (
    jobDescription
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 8 && line.length < 80 && !/[.!?]$/.test(line)) ?? 'Target Role'
  );
};

const inferCompanyName = (jobDescription: string, fallback?: string) => {
  if (fallback?.trim()) {
    return fallback.trim();
  }

  return (
    extractFirstMatch(jobDescription, /(?:company|employer|organization)\s*:?\s*([^\n.]+)/i).slice(0, 80) ||
    'Target Company'
  );
};

const inferPortalType = (jobUrl: string) => {
  const normalizedUrl = jobUrl.toLowerCase();
  if (!normalizedUrl) return 'Manual or unknown portal';
  if (normalizedUrl.includes('greenhouse.io')) return 'Greenhouse';
  if (normalizedUrl.includes('lever.co')) return 'Lever';
  if (normalizedUrl.includes('workday')) return 'Workday';
  if (normalizedUrl.includes('linkedin.com')) return 'LinkedIn';
  if (normalizedUrl.includes('indeed.com')) return 'Indeed';
  return 'Company careers site';
};

const getReadinessLevel = (score: number) => {
  if (score >= 85) return 'Ready to review and submit';
  if (score >= 70) return 'Nearly ready';
  if (score >= 55) return 'Needs targeted edits';
  return 'Not ready yet';
};

const buildChecklist = (analysis: ResumeAnalysis, hasJobUrl: boolean, hasCompany: boolean): ApplicationTask[] => {
  const tasks: ApplicationTask[] = [
    {
      title: 'Review tailored resume draft',
      detail: 'Replace placeholders with verified accomplishments and keep the single-column ATS format.',
      priority: 'required',
    },
    {
      title: 'Confirm application profile fields',
      detail: 'Check contact details, links, location preferences, work authorization, and any required questions before submitting.',
      priority: 'required',
    },
  ];

  if (analysis.missingKeywords.length) {
    tasks.push({
      title: 'Close keyword gaps truthfully',
      detail: `Add evidence for ${analysis.missingKeywords.slice(0, 5).map(titleCase).join(', ')} if those skills are accurate.`,
      priority: 'recommended',
    });
  }

  if (analysis.atsIssues.length) {
    tasks.push({
      title: 'Resolve ATS issues',
      detail: analysis.atsIssues[0].detail,
      priority: analysis.atsIssues.some((issue) => issue.severity === 'major') ? 'required' : 'recommended',
    });
  }

  if (!hasCompany) {
    tasks.push({
      title: 'Add company context',
      detail: 'Enter the company name so the cover letter and outreach drafts are specific.',
      priority: 'recommended',
    });
  }

  if (!hasJobUrl) {
    tasks.push({
      title: 'Attach the job posting URL',
      detail: 'Save the canonical job URL so you can return to the same application and track status.',
      priority: 'optional',
    });
  }

  tasks.push({
    title: 'Manual submit checkpoint',
    detail: 'Open the portal, paste verified fields, upload final documents, and submit only after reviewing the preview page.',
    priority: 'required',
  });

  return tasks;
};

const buildFieldMap = (resume: string, roleTitle: string, companyName: string): ApplicationField[] => {
  const email = getContactValue(resume, /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i, 'Add email');
  const phone = getContactValue(resume, /(\+?\d[\d\s().-]{7,}\d)/, 'Add phone');
  const linkedin = getContactValue(resume, /(linkedin\.com\/[^\s|]+)/i, 'Add LinkedIn URL');
  const portfolio = getContactValue(resume, /((?:https?:\/\/)?(?:github\.com|[\w.-]+portfolio[\w.-]*)\/?[^\s|]*)/i, 'Add portfolio URL');

  return [
    { label: 'Full name', value: getCandidateName(resume), source: 'Resume header', confidence: 'medium' },
    { label: 'Email', value: email, source: 'Resume contact details', confidence: email === 'Add email' ? 'needs-review' : 'high' },
    { label: 'Phone', value: phone, source: 'Resume contact details', confidence: phone === 'Add phone' ? 'needs-review' : 'high' },
    {
      label: 'LinkedIn',
      value: linkedin,
      source: 'Resume contact details',
      confidence: linkedin === 'Add LinkedIn URL' ? 'needs-review' : 'high',
    },
    {
      label: 'Portfolio',
      value: portfolio,
      source: 'Resume contact details',
      confidence: portfolio === 'Add portfolio URL' ? 'needs-review' : 'medium',
    },
    { label: 'Target role', value: roleTitle, source: 'Job description', confidence: 'medium' },
    { label: 'Company', value: companyName, source: 'Application details', confidence: companyName === 'Target Company' ? 'needs-review' : 'medium' },
    { label: 'Work authorization', value: 'Review and answer manually', source: 'Candidate-only answer', confidence: 'needs-review' },
    { label: 'Salary expectations', value: 'Review and answer manually', source: 'Candidate-only answer', confidence: 'needs-review' },
  ];
};

const sentenceFromKeywords = (keywords: string[]) => {
  if (!keywords.length) {
    return 'the responsibilities described in the posting';
  }

  return keywords.slice(0, 4).map(titleCase).join(', ');
};

const buildCoverLetter = (input: {
  candidateName: string;
  companyName: string;
  roleTitle: string;
  recruiterName?: string;
  analysis: ResumeAnalysis;
}) => {
  const greeting = input.recruiterName?.trim() ? `Dear ${input.recruiterName.trim()},` : 'Hello,';
  const strengths = input.analysis.strengths.slice(0, 2).join(' ');
  const keywordSentence = sentenceFromKeywords([...input.analysis.matchedKeywords, ...input.analysis.missingKeywords]);

  return `${greeting}

I am excited to apply for the ${input.roleTitle} role at ${input.companyName}. My background aligns with ${keywordSentence}, and I am especially interested in contributing practical, measurable outcomes for this team.

${strengths} I would bring that same focus to the priorities in your posting while continuing to learn the domain, collaborate clearly, and deliver reliable work.

I have attached a tailored resume for your review. Thank you for considering my application.

Sincerely,
${input.candidateName}`;
};

const buildOutreachMessage = (input: {
  candidateName: string;
  companyName: string;
  roleTitle: string;
  analysis: ResumeAnalysis;
}) =>
  `Hi, I am applying for the ${input.roleTitle} role at ${input.companyName}. My experience lines up with ${sentenceFromKeywords(
    input.analysis.matchedKeywords,
  )}, and I would appreciate any guidance on the team or hiring process. Thank you - ${input.candidateName}`;

const buildFollowUpMessage = (candidateName: string, companyName: string, roleTitle: string) =>
  `Hello, I wanted to follow up on my application for the ${roleTitle} role at ${companyName}. I remain interested in the opportunity and would be glad to share any additional information. Thank you - ${candidateName}`;

const buildRisks = (analysis: ResumeAnalysis): ApplicationRisk[] => {
  const risks: ApplicationRisk[] = [];

  if (analysis.score < 65) {
    risks.push({
      title: 'Low role match',
      detail: 'The resume may need stronger evidence before this application is worth submitting.',
      level: 'high',
    });
  }

  if (analysis.missingKeywords.length > 8) {
    risks.push({
      title: 'Many missing job keywords',
      detail: 'Avoid keyword stuffing; add only accurate examples that reflect real experience.',
      level: 'medium',
    });
  }

  if (analysis.atsIssues.some((issue) => issue.severity === 'major')) {
    risks.push({
      title: 'Major ATS issue',
      detail: 'Fix major parser or contact-detail issues before uploading documents.',
      level: 'high',
    });
  }

  risks.push({
    title: 'Human review required',
    detail: 'This agent prepares drafts and field suggestions but does not submit applications or bypass portal review screens.',
    level: 'low',
  });

  return risks;
};

const buildApplicationPacket = (plan: Omit<ApplicationPlan, 'applicationPacket'>) =>
  [
    `APPLICATION PACKET: ${plan.roleTitle} at ${plan.companyName}`,
    `Status: ${plan.status}`,
    `Portal: ${plan.portalType}`,
    `URL: ${plan.jobUrl || 'Add job URL'}`,
    `Readiness: ${plan.readinessScore}/100 - ${plan.readinessLevel}`,
    '',
    'NEXT STEP',
    plan.nextStep,
    '',
    'CHECKLIST',
    ...plan.checklist.map((task) => `- [${task.priority}] ${task.title}: ${task.detail}`),
    '',
    'FIELD MAP',
    ...plan.fieldMap.map((field) => `- ${field.label}: ${field.value} (${field.confidence}, ${field.source})`),
    '',
    'COVER LETTER DRAFT',
    plan.coverLetter,
    '',
    'OUTREACH MESSAGE',
    plan.outreachMessage,
    '',
    'FOLLOW-UP MESSAGE',
    plan.followUpMessage,
    '',
    'TAILORED RESUME DRAFT',
    plan.analysis.rewrittenResume,
  ].join('\n');

export const createApplicationPlan = (input: JobApplicationInput): ApplicationPlan => {
  const resume = input.resume.trim();
  const jobDescription = input.jobDescription.trim();
  const analysis = analyzeResume(resume, jobDescription);
  const roleTitle = inferRoleTitle(jobDescription, input.roleTitle);
  const companyName = inferCompanyName(jobDescription, input.companyName);
  const jobUrl = input.jobUrl?.trim() ?? '';
  const candidateName = getCandidateName(resume);
  const checklist = buildChecklist(analysis, Boolean(jobUrl), companyName !== 'Target Company');
  const unresolvedRequiredTasks = checklist.filter((task) => task.priority === 'required').length;
  const readinessScore = Math.round(
    clamp(analysis.score * 0.7 + analysis.atsReadiness * 0.15 + (100 - unresolvedRequiredTasks * 8) * 0.15),
  );
  const readinessLevel = getReadinessLevel(readinessScore);
  const status: ApplicationStatus = readinessScore >= 85 ? 'ready' : 'draft';
  const coverLetter = buildCoverLetter({
    candidateName,
    companyName,
    roleTitle,
    recruiterName: input.recruiterName,
    analysis,
  });

  const planWithoutPacket: Omit<ApplicationPlan, 'applicationPacket'> = {
    roleTitle,
    companyName,
    portalType: inferPortalType(jobUrl),
    jobUrl,
    readinessScore,
    readinessLevel,
    nextStep:
      readinessScore >= 85
        ? 'Review the generated packet, open the portal, and manually submit the verified materials.'
        : 'Complete the required checklist items before submitting this application.',
    status,
    analysis,
    checklist,
    fieldMap: buildFieldMap(resume, roleTitle, companyName),
    coverLetter,
    outreachMessage: buildOutreachMessage({ candidateName, companyName, roleTitle, analysis }),
    followUpMessage: buildFollowUpMessage(candidateName, companyName, roleTitle),
    risks: buildRisks(analysis),
  };

  return {
    ...planWithoutPacket,
    applicationPacket: buildApplicationPacket(planWithoutPacket),
  };
};

