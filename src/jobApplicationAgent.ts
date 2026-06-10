import type { ResumeAnalysis } from './resumeAgent';

export type ApplicationPriority = 'high' | 'medium' | 'low';

export interface AutomationTask {
  stage: string;
  title: string;
  detail: string;
  automationPrompt: string;
  doneWhen: string;
  priority: ApplicationPriority;
}

export interface ApplicationTrackerRow {
  field: string;
  value: string;
}

export interface JobApplicationPlan {
  readinessScore: number;
  fitLabel: string;
  summary: string;
  targetRole: string;
  targetCompany: string;
  applicationMaterials: string[];
  workflow: AutomationTask[];
  coverLetter: string;
  recruiterMessage: string;
  followUpEmail: string;
  screeningAnswers: string[];
  trackerRows: ApplicationTrackerRow[];
  applicationKit: string;
  trackerCsv: string;
}

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

const cleanLine = (value: string) => value.replace(/\s+/g, ' ').trim();

const getRoleTitle = (jobDescription: string) => {
  const titleMatch = jobDescription.match(/(?:job\s*title|role|position)\s*:?\s*([^\n.]+)/i);
  if (titleMatch?.[1]) {
    return cleanLine(titleMatch[1]).slice(0, 80);
  }

  const firstReadableLine = jobDescription
    .split('\n')
    .map(cleanLine)
    .find((line) => line.length > 8 && line.length < 80 && !/[.!?]$/.test(line));

  return firstReadableLine ?? 'Target Role';
};

const getCompanyName = (jobDescription: string) => {
  const companyMatch = jobDescription.match(/(?:company|organization|employer)\s*:?\s*([^\n.]+)/i);
  if (companyMatch?.[1]) {
    return cleanLine(companyMatch[1]).slice(0, 80);
  }

  const atCompanyMatch = jobDescription.match(/\bat\s+([A-Z][A-Za-z0-9&.,' -]{2,60})/);
  return atCompanyMatch?.[1] ? cleanLine(atCompanyMatch[1]).replace(/[.,]$/, '') : 'Target Company';
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

const getBestProofPoints = (resume: string) =>
  resume
    .split('\n')
    .map((line) => line.trim().replace(/^[*\-]+\s*/, ''))
    .filter((line) => line.length > 35 && line.length < 220)
    .filter((line) => /\d|built|improved|led|created|delivered|managed|optimized|automated|collaborated/i.test(line))
    .slice(0, 3);

const getFitLabel = (score: number) => {
  if (score >= 82) return 'Strong apply-now fit';
  if (score >= 65) return 'Apply after tailoring';
  return 'Nurture or improve fit first';
};

const getReadinessScore = (analysis: ResumeAnalysis) => {
  const keywordWeight = analysis.keywordCoverage * 0.35;
  const atsWeight = analysis.atsReadiness * 0.25;
  const scoreWeight = analysis.score * 0.3;
  const requiredSections = [analysis.sections.summary, analysis.sections.experience, analysis.sections.skills, analysis.sections.education];
  const sectionWeight = (requiredSections.filter(Boolean).length / requiredSections.length) * 10;

  return Math.round(Math.min(keywordWeight + atsWeight + scoreWeight + sectionWeight, 100));
};

const getPriority = (readinessScore: number): ApplicationPriority => {
  if (readinessScore >= 80) return 'high';
  if (readinessScore >= 60) return 'medium';
  return 'low';
};

const sentenceList = (items: string[]) => {
  if (items.length <= 1) return items[0] ?? 'the target requirements';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
};

const buildWorkflow = (analysis: ResumeAnalysis, targetRole: string, targetCompany: string, readinessScore: number): AutomationTask[] => {
  const missingKeywords = analysis.missingKeywords.slice(0, 5).map(titleCase);
  const matchedKeywords = analysis.matchedKeywords.slice(0, 5).map(titleCase);
  const priority = getPriority(readinessScore);

  return [
    {
      stage: '1. Prioritize',
      title: 'Decide whether to apply',
      detail: `Readiness is ${readinessScore}/100 for ${targetRole}. ${getFitLabel(readinessScore)}.`,
      automationPrompt: 'Use the score, missing keywords, and ATS findings to choose apply now, tailor first, or save for later.',
      doneWhen: 'The role is tagged as Apply, Tailor, or Nurture in your tracker.',
      priority,
    },
    {
      stage: '2. Tailor',
      title: 'Patch the resume before submitting',
      detail: missingKeywords.length
        ? `Add truthful evidence for ${sentenceList(missingKeywords)}.`
        : 'Resume already covers the main job-description keywords. Preserve the ATS-safe structure.',
      automationPrompt: 'Use the resume rewrite draft to create the exact resume version for this application.',
      doneWhen: 'A role-specific resume file is saved with the company and role in the filename.',
      priority: missingKeywords.length ? 'high' : 'medium',
    },
    {
      stage: '3. Package',
      title: 'Generate application materials',
      detail: `Use the cover letter, recruiter message, follow-up email, and screening answer starters for ${targetCompany}.`,
      automationPrompt: 'Copy the kit into your application workspace and replace every placeholder with verified details.',
      doneWhen: 'All application text is reviewed, personalized, and ready to paste.',
      priority,
    },
    {
      stage: '4. Submit',
      title: 'Complete the application form carefully',
      detail: 'Fill in the form, attach the tailored resume, and save confirmation details before leaving the portal.',
      automationPrompt: 'Use the tracker fields below as the minimum metadata to capture after submission.',
      doneWhen: 'Application URL, date submitted, resume version, and next follow-up date are recorded.',
      priority: 'high',
    },
    {
      stage: '5. Follow up',
      title: 'Schedule relationship-based follow-up',
      detail: matchedKeywords.length
        ? `Lead with relevant strengths such as ${sentenceList(matchedKeywords)}.`
        : 'Lead with the strongest verified accomplishment from your resume.',
      automationPrompt: 'Send the recruiter message after applying, then send the follow-up email if there is no response.',
      doneWhen: 'Recruiter outreach and follow-up reminders are scheduled.',
      priority: 'medium',
    },
  ];
};

const buildCoverLetter = (
  candidateName: string,
  targetRole: string,
  targetCompany: string,
  matchedKeywords: string[],
  proofPoints: string[],
) => {
  const strengths = matchedKeywords.slice(0, 5).map(titleCase);
  const evidence = proofPoints.length
    ? proofPoints.map((point) => `- ${point}`).join('\n')
    : '- Add one verified accomplishment that demonstrates the strongest requirement in the job description.';

  return `Dear Hiring Team,

I am excited to apply for the ${targetRole} role at ${targetCompany}. My background aligns with ${sentenceList(
    strengths,
  )}, and I am interested in contributing practical, measurable work to the team.

Relevant proof points:
${evidence}

I would welcome the opportunity to discuss how my experience maps to this role's priorities. Thank you for your consideration.

Sincerely,
${candidateName}`;
};

const buildRecruiterMessage = (candidateName: string, targetRole: string, targetCompany: string, matchedKeywords: string[]) =>
  `Hi [Name], I just applied for the ${targetRole} role at ${targetCompany}. My experience includes ${sentenceList(
    matchedKeywords.slice(0, 4).map(titleCase),
  )}, and I would appreciate the chance to be considered. If helpful, I can share a brief summary of the most relevant projects. Thank you, ${candidateName}`;

const buildFollowUpEmail = (candidateName: string, targetRole: string, targetCompany: string) =>
  `Subject: Following up on ${targetRole} application

Hi [Name],

I wanted to follow up on my application for the ${targetRole} role at ${targetCompany}. I remain interested in the opportunity and would be glad to provide any additional information about my experience.

Thank you for your time,
${candidateName}`;

const buildScreeningAnswers = (analysis: ResumeAnalysis, targetRole: string, targetCompany: string) => [
  `Why this role: I am interested in ${targetRole} at ${targetCompany} because the role emphasizes ${sentenceList(
    analysis.matchedKeywords.slice(0, 4).map(titleCase),
  )}, which aligns with my experience and the work I want to keep doing.`,
  `Tell us about yourself: I am a ${targetRole}-aligned candidate with experience across ${sentenceList(
    analysis.matchedKeywords.slice(0, 5).map(titleCase),
  )}. I focus on clear execution, measurable outcomes, and collaborative delivery.`,
  `What to improve before submitting: Add verified examples for ${sentenceList(
    analysis.missingKeywords.slice(0, 4).map(titleCase),
  )} if they accurately reflect your background.`,
];

const csvEscape = (value: string) => `"${value.replace(/"/g, '""')}"`;

const buildTrackerRows = (plan: Pick<JobApplicationPlan, 'targetRole' | 'targetCompany' | 'readinessScore' | 'fitLabel'>): ApplicationTrackerRow[] => [
  { field: 'Company', value: plan.targetCompany },
  { field: 'Role', value: plan.targetRole },
  { field: 'Application status', value: plan.readinessScore >= 80 ? 'Ready to apply' : 'Tailor before applying' },
  { field: 'Readiness score', value: `${plan.readinessScore}/100` },
  { field: 'Fit label', value: plan.fitLabel },
  { field: 'Application URL', value: 'Paste job posting URL' },
  { field: 'Resume version', value: `${plan.targetCompany} - ${plan.targetRole} resume` },
  { field: 'Date applied', value: 'YYYY-MM-DD' },
  { field: 'Next follow-up', value: 'YYYY-MM-DD' },
  { field: 'Contact name', value: 'Recruiter or hiring manager' },
  { field: 'Notes', value: 'Add interview notes, referrals, and portal confirmation number' },
];

const buildApplicationKit = (plan: Omit<JobApplicationPlan, 'applicationKit' | 'trackerCsv'>) =>
  [
    `# Job Application Automation Kit`,
    '',
    `Role: ${plan.targetRole}`,
    `Company: ${plan.targetCompany}`,
    `Readiness: ${plan.readinessScore}/100 - ${plan.fitLabel}`,
    '',
    '## Automation workflow',
    ...plan.workflow.flatMap((task) => [
      `- ${task.stage} ${task.title} (${task.priority} priority)`,
      `  - ${task.detail}`,
      `  - Done when: ${task.doneWhen}`,
    ]),
    '',
    '## Materials to prepare',
    ...plan.applicationMaterials.map((material) => `- ${material}`),
    '',
    '## Cover letter draft',
    plan.coverLetter,
    '',
    '## Recruiter message',
    plan.recruiterMessage,
    '',
    '## Follow-up email',
    plan.followUpEmail,
    '',
    '## Screening answer starters',
    ...plan.screeningAnswers.map((answer) => `- ${answer}`),
    '',
    '## Tracker fields',
    ...plan.trackerRows.map((row) => `- ${row.field}: ${row.value}`),
  ].join('\n');

export const buildJobApplicationPlan = (
  resume: string,
  jobDescription: string,
  analysis: ResumeAnalysis,
): JobApplicationPlan => {
  const targetRole = getRoleTitle(jobDescription);
  const targetCompany = getCompanyName(jobDescription);
  const candidateName = getCandidateName(resume);
  const readinessScore = getReadinessScore(analysis);
  const fitLabel = getFitLabel(readinessScore);
  const proofPoints = getBestProofPoints(resume);
  const applicationMaterials = [
    'Tailored ATS resume',
    'Targeted cover letter',
    'Recruiter or hiring-manager outreach message',
    'Follow-up email',
    'Application tracker row',
  ];

  const partialPlan = {
    readinessScore,
    fitLabel,
    targetRole,
    targetCompany,
    summary:
      readinessScore >= 80
        ? 'This role is ready for a fast, high-quality application package.'
        : readinessScore >= 60
          ? 'Tailor the resume and application language before submitting.'
          : 'Improve role alignment or gather stronger evidence before prioritizing this application.',
    applicationMaterials,
    workflow: buildWorkflow(analysis, targetRole, targetCompany, readinessScore),
    coverLetter: buildCoverLetter(candidateName, targetRole, targetCompany, analysis.matchedKeywords, proofPoints),
    recruiterMessage: buildRecruiterMessage(candidateName, targetRole, targetCompany, analysis.matchedKeywords),
    followUpEmail: buildFollowUpEmail(candidateName, targetRole, targetCompany),
    screeningAnswers: buildScreeningAnswers(analysis, targetRole, targetCompany),
  };

  const trackerRows = buildTrackerRows(partialPlan);
  const planWithoutExports = {
    ...partialPlan,
    trackerRows,
  };
  const trackerCsv = ['Field,Value', ...trackerRows.map((row) => `${csvEscape(row.field)},${csvEscape(row.value)}`)].join('\n');

  return {
    ...planWithoutExports,
    applicationKit: buildApplicationKit(planWithoutExports),
    trackerCsv,
  };
};
