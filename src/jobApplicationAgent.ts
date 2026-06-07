import type { ResumeAnalysis } from './resumeAgent';

export interface ApplicationAnswer {
  question: string;
  answer: string;
}

export interface ApplicationFollowUp {
  timing: string;
  action: string;
}

export interface ApplicationTrackerField {
  label: string;
  value: string;
}

export interface JobApplicationPlan {
  readinessScore: number;
  readinessLabel: string;
  roleTitle: string;
  companyName: string;
  applicationSummary: string;
  priorityActions: string[];
  applicationChecklist: string[];
  riskFlags: string[];
  coverLetter: string;
  recruiterMessage: string;
  answerBank: ApplicationAnswer[];
  followUpSchedule: ApplicationFollowUp[];
  trackerFields: ApplicationTrackerField[];
  packetText: string;
}

const EMPTY_APPLICATION_PLAN: JobApplicationPlan = {
  readinessScore: 0,
  readinessLabel: 'N/A',
  roleTitle: 'Target Role',
  companyName: 'Target Company',
  applicationSummary: 'Add a resume and job description to generate an application plan.',
  priorityActions: [],
  applicationChecklist: [],
  riskFlags: [],
  coverLetter: '',
  recruiterMessage: '',
  answerBank: [],
  followUpSchedule: [],
  trackerFields: [],
  packetText: '',
};

const clamp = (value: number, min = 0, max = 100) => Math.min(Math.max(value, min), max);

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

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

const getRoleTitle = (jobDescription: string) => {
  const titleMatch = jobDescription.match(/(?:job\s*title|role|position)\s*:?\s*([^\n.]+)/i);
  if (titleMatch?.[1]) {
    return normalizeWhitespace(titleMatch[1]).slice(0, 80);
  }

  const firstReadableLine = jobDescription
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 8 && line.length < 80 && !/[.!?]$/.test(line));

  return firstReadableLine ?? 'Target Role';
};

const getCompanyName = (jobDescription: string) => {
  const companyMatch = jobDescription.match(/(?:company|organization|employer)\s*:?\s*([^\n.]+)/i);
  if (companyMatch?.[1]) {
    return normalizeWhitespace(companyMatch[1]).slice(0, 80);
  }

  const atCompanyMatch = jobDescription.match(/\bat\s+([A-Z][A-Za-z0-9&.,' -]{2,60})/);
  if (atCompanyMatch?.[1]) {
    return normalizeWhitespace(atCompanyMatch[1].replace(/\s+(is|are|seeks|needs|looking)\b.*$/i, '')).slice(0, 80);
  }

  return 'Target Company';
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

const pickEvidenceBullets = (resume: string, limit = 3) =>
  resume
    .split('\n')
    .map((line) => line.trim().replace(/^[*\-]+\s*/, ''))
    .filter((line) => line.length >= 45 && line.length <= 220)
    .filter((line) => /\d|built|improved|led|managed|created|delivered|developed|launched|optimized/i.test(line))
    .slice(0, limit);

const getReadinessLabel = (score: number) => {
  if (score >= 85) return 'Apply-ready';
  if (score >= 70) return 'Strong draft';
  if (score >= 55) return 'Needs targeting';
  return 'Prep required';
};

const getPriorityActions = (analysis: ResumeAnalysis) => {
  const actions: string[] = [];

  if (analysis.missingKeywords.length) {
    actions.push(`Add truthful proof for these missing job keywords: ${analysis.missingKeywords.slice(0, 5).map(titleCase).join(', ')}.`);
  }

  if (analysis.atsIssues.length) {
    actions.push(`Fix the top ATS issue before applying: ${analysis.atsIssues[0].detail}`);
  }

  if (analysis.score < 75) {
    actions.push('Tailor the professional summary and first three bullets to mirror the role title and highest-priority responsibilities.');
  }

  if (!analysis.sections.projects) {
    actions.push('Add one role-relevant project or selected achievement so the application has a strong proof point for screening calls.');
  }

  actions.push('Review every generated line for accuracy before submitting to any employer.');

  return [...new Set(actions)].slice(0, 5);
};

const getRiskFlags = (analysis: ResumeAnalysis) => {
  const flags: string[] = [];

  if (analysis.score < 60) {
    flags.push('Resume-to-job match is below the recommended apply threshold.');
  }

  if (analysis.keywordCoverage < 50) {
    flags.push('Keyword coverage is light; the application may rank poorly in ATS filters.');
  }

  if (analysis.atsReadiness < 75) {
    flags.push('ATS readiness is low enough to risk parsing or screening issues.');
  }

  if (analysis.atsIssues.some((issue) => issue.severity === 'major')) {
    flags.push('High-priority ATS issues should be fixed before submission.');
  }

  return flags.length ? flags : ['No major automation blockers detected; verify accuracy and submit through the employer portal.'];
};

const buildChecklist = (roleTitle: string, companyName: string, analysis: ResumeAnalysis) => [
  `Save the tailored resume as "${roleTitle} - ${companyName} - Resume".`,
  'Copy the strongest matched keywords into the resume summary and skills sections where truthful.',
  'Paste the cover letter into the application portal only after replacing placeholders and confirming details.',
  'Send the recruiter message to a relevant recruiter or hiring manager after applying.',
  'Log the application source, date, job URL, and next follow-up date in your tracker.',
  analysis.missingKeywords.length
    ? `Prepare a screening-call story for ${titleCase(analysis.missingKeywords[0])}.`
    : 'Prepare one quantified story that proves your strongest role fit.',
];

const buildCoverLetter = (
  candidateName: string,
  roleTitle: string,
  companyName: string,
  analysis: ResumeAnalysis,
  evidenceBullets: string[],
) => {
  const strengths = analysis.matchedKeywords.slice(0, 5).map(titleCase).join(', ') || 'the core requirements in the job description';
  const evidence = evidenceBullets.length
    ? evidenceBullets.map((bullet) => `- ${bullet}`).join('\n')
    : '- Add one verified accomplishment that directly matches this role.\n- Add one quantified outcome from your recent work.';

  return `Dear ${companyName} Hiring Team,

I am excited to apply for the ${roleTitle} role. My background aligns with ${strengths}, and I am particularly interested in contributing practical, measurable results for ${companyName}.

Relevant evidence from my experience:
${evidence}

I would welcome the opportunity to discuss how my experience maps to the responsibilities in this role. Thank you for your time and consideration.

Sincerely,
${candidateName}`;
};

const buildRecruiterMessage = (candidateName: string, roleTitle: string, companyName: string, analysis: ResumeAnalysis) => {
  const keywords = analysis.matchedKeywords.slice(0, 4).map(titleCase).join(', ') || 'the listed role requirements';

  return `Hi [Recruiter Name],

I applied for the ${roleTitle} role at ${companyName} and wanted to briefly introduce myself. My experience aligns with ${keywords}, and I have included a tailored resume highlighting relevant impact.

If helpful, I would appreciate the chance to share how my background maps to the team needs.

Best,
${candidateName}`;
};

const buildAnswerBank = (roleTitle: string, companyName: string, analysis: ResumeAnalysis, evidenceBullets: string[]): ApplicationAnswer[] => {
  const topStrength = analysis.strengths[0] ?? 'I bring relevant experience and a willingness to learn quickly.';
  const topImprovement = analysis.improvements[0] ?? 'I am continuing to tailor my examples to the job description.';
  const evidence = evidenceBullets[0] ?? 'Replace this with a verified project, accomplishment, or measurable result from your resume.';

  return [
    {
      question: `Why are you interested in the ${roleTitle} role at ${companyName}?`,
      answer: `I am interested because the role matches my experience with ${analysis.matchedKeywords.slice(0, 4).map(titleCase).join(', ') || 'the responsibilities described in the posting'} and gives me an opportunity to contribute measurable outcomes to ${companyName}.`,
    },
    {
      question: 'What makes you a strong fit?',
      answer: `${topStrength} A specific example I would highlight is: ${evidence}`,
    },
    {
      question: 'What should you improve before submitting?',
      answer: topImprovement,
    },
  ];
};

const buildFollowUpSchedule = (): ApplicationFollowUp[] => [
  {
    timing: 'Same day',
    action: 'Submit the tailored resume, save the confirmation, and log the job URL/source.',
  },
  {
    timing: '24 hours later',
    action: 'Send the recruiter or hiring-manager message with one concise role-fit proof point.',
  },
  {
    timing: '5 business days later',
    action: 'Follow up politely if there has been no response and add any new recruiter notes to the tracker.',
  },
  {
    timing: 'After response',
    action: 'Update status, prep answers from the answer bank, and map interview stories to the missing keywords.',
  },
];

const buildPacketText = (plan: Omit<JobApplicationPlan, 'packetText'>) =>
  [
    `JOB APPLICATION AUTOMATION PACKET`,
    `Role: ${plan.roleTitle}`,
    `Company: ${plan.companyName}`,
    `Readiness: ${plan.readinessScore}/100 (${plan.readinessLabel})`,
    '',
    'SUMMARY',
    plan.applicationSummary,
    '',
    'PRIORITY ACTIONS',
    ...plan.priorityActions.map((action, index) => `${index + 1}. ${action}`),
    '',
    'APPLICATION CHECKLIST',
    ...plan.applicationChecklist.map((item) => `- ${item}`),
    '',
    'RISK FLAGS',
    ...plan.riskFlags.map((flag) => `- ${flag}`),
    '',
    'COVER LETTER',
    plan.coverLetter,
    '',
    'RECRUITER MESSAGE',
    plan.recruiterMessage,
    '',
    'ANSWER BANK',
    ...plan.answerBank.flatMap((answer) => [`Q: ${answer.question}`, `A: ${answer.answer}`, '']),
    'FOLLOW-UP SCHEDULE',
    ...plan.followUpSchedule.map((item) => `- ${item.timing}: ${item.action}`),
    '',
    'TRACKER FIELDS',
    ...plan.trackerFields.map((field) => `- ${field.label}: ${field.value}`),
  ].join('\n');

export const buildJobApplicationPlan = (
  resume: string,
  jobDescription: string,
  analysis: ResumeAnalysis,
): JobApplicationPlan => {
  const cleanResume = resume.trim();
  const cleanJobDescription = jobDescription.trim();

  if (!cleanResume || !cleanJobDescription) {
    return EMPTY_APPLICATION_PLAN;
  }

  const roleTitle = getRoleTitle(cleanJobDescription);
  const companyName = getCompanyName(cleanJobDescription);
  const candidateName = getCandidateName(cleanResume);
  const evidenceBullets = pickEvidenceBullets(cleanResume);
  const readinessScore = Math.round(clamp(analysis.score * 0.55 + analysis.keywordCoverage * 0.25 + analysis.atsReadiness * 0.2));
  const readinessLabel = getReadinessLabel(readinessScore);
  const priorityActions = getPriorityActions(analysis);
  const applicationChecklist = buildChecklist(roleTitle, companyName, analysis);
  const riskFlags = getRiskFlags(analysis);
  const coverLetter = buildCoverLetter(candidateName, roleTitle, companyName, analysis, evidenceBullets);
  const recruiterMessage = buildRecruiterMessage(candidateName, roleTitle, companyName, analysis);
  const answerBank = buildAnswerBank(roleTitle, companyName, analysis, evidenceBullets);
  const followUpSchedule = buildFollowUpSchedule();
  const trackerFields = [
    { label: 'Candidate', value: candidateName },
    { label: 'Contact', value: getContactLine(cleanResume) },
    { label: 'Role', value: roleTitle },
    { label: 'Company', value: companyName },
    { label: 'Resume match', value: `${analysis.score}/100 (${analysis.grade})` },
    { label: 'Application status', value: 'Ready to tailor and submit' },
    { label: 'Next follow-up', value: followUpSchedule[1].timing },
  ];
  const applicationSummary = `${readinessLabel}: this application is ${readinessScore}/100 ready based on resume match, keyword coverage, and ATS readiness. Complete the priority actions, verify every generated statement, then submit and follow the outreach schedule.`;

  const planWithoutPacket = {
    readinessScore,
    readinessLabel,
    roleTitle,
    companyName,
    applicationSummary,
    priorityActions,
    applicationChecklist,
    riskFlags,
    coverLetter,
    recruiterMessage,
    answerBank,
    followUpSchedule,
    trackerFields,
  };

  return {
    ...planWithoutPacket,
    packetText: buildPacketText(planWithoutPacket),
  };
};
