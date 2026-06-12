import type { ResumeAnalysis } from './resumeAgent';

export type ApplicationReadiness = 'Ready to apply' | 'Prep before applying' | 'Needs tailoring' | 'Hold and improve';

export interface ApplicationTask {
  stage: string;
  title: string;
  detail: string;
  doneWhen: string;
}

export interface TrackerField {
  label: string;
  value: string;
}

export interface FollowUpStep {
  timing: string;
  action: string;
}

export interface ApplicationAutomationPlan {
  roleTitle: string;
  companyName: string;
  candidateName: string;
  readiness: ApplicationReadiness;
  applyReadinessScore: number;
  summary: string;
  priorityTasks: ApplicationTask[];
  checklist: string[];
  trackerFields: TrackerField[];
  followUpSchedule: FollowUpStep[];
  coverLetter: string;
  recruiterMessage: string;
  applicationPacket: string;
}

const CONTACT_FALLBACK = 'Email | Phone | LinkedIn | Portfolio';

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

const unique = <T,>(items: T[]) => Array.from(new Set(items));

const extractRoleTitle = (jobDescription: string) => {
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

const extractCompanyName = (jobDescription: string) => {
  const labeledCompany = jobDescription.match(/(?:company|organization|employer)\s*:?\s*([^\n.]+)/i);
  if (labeledCompany?.[1]) {
    return labeledCompany[1].trim().slice(0, 80);
  }

  const atCompany = jobDescription.match(/\b(?:at|with)\s+([A-Z][A-Za-z0-9&.,' -]{2,60})(?:\s+is|\s+are|[,.]|\n|$)/);
  if (atCompany?.[1]) {
    return atCompany[1].trim();
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

  return lines.length ? lines.join(' | ') : CONTACT_FALLBACK;
};

const extractRelevantBullets = (resume: string) =>
  resume
    .split('\n')
    .map((line) => line.trim().replace(/^[*\-]+\s*/, ''))
    .filter((line) => line.length > 35 && line.length < 220)
    .filter((line) => /\d|built|created|delivered|designed|developed|improved|launched|led|managed|optimized|shipped/i.test(line))
    .slice(0, 4);

const getReadiness = (score: number): ApplicationReadiness => {
  if (score >= 85) return 'Ready to apply';
  if (score >= 70) return 'Prep before applying';
  if (score >= 55) return 'Needs tailoring';
  return 'Hold and improve';
};

const getSummary = (readiness: ApplicationReadiness, roleTitle: string, companyName: string) => {
  if (readiness === 'Ready to apply') {
    return `Your packet is ready for a focused ${roleTitle} application at ${companyName}. Review the generated drafts, confirm every claim is accurate, then submit and track follow-up.`;
  }

  if (readiness === 'Prep before applying') {
    return `You have enough alignment to apply after a targeted pass. Complete the priority queue before submitting the ${roleTitle} application to ${companyName}.`;
  }

  if (readiness === 'Needs tailoring') {
    return `This application needs resume tailoring before submission. Add truthful evidence for the highest-priority gaps, then regenerate the packet.`;
  }

  return `Pause before applying. Strengthen the resume structure, contact details, keywords, and measurable outcomes so the application is competitive.`;
};

const buildPriorityTasks = (analysis: ResumeAnalysis): ApplicationTask[] => {
  const tasks: ApplicationTask[] = [];
  const missingKeywordText = analysis.missingKeywords.slice(0, 6).map(titleCase).join(', ');

  if (analysis.missingKeywords.length) {
    tasks.push({
      stage: 'Tailor resume',
      title: 'Add missing role evidence',
      detail: `Work in truthful examples for ${missingKeywordText}. Do not keyword-stuff; attach each term to an accomplishment, project, or skill you can defend.`,
      doneWhen: 'Resume includes the top missing terms in context.',
    });
  }

  if (analysis.atsIssues.length) {
    tasks.push({
      stage: 'ATS cleanup',
      title: 'Resolve parser blockers',
      detail: analysis.atsIssues
        .slice(0, 2)
        .map((issue) => issue.detail)
        .join(' '),
      doneWhen: 'No high-priority ATS findings remain.',
    });
  }

  tasks.push(
    {
      stage: 'Generate packet',
      title: 'Personalize the drafts',
      detail: 'Review the cover letter and outreach note, replace placeholders, and add one company-specific reason for applying.',
      doneWhen: 'Cover letter and message are accurate and ready to paste.',
    },
    {
      stage: 'Submit',
      title: 'Apply and save proof',
      detail: 'Submit the tailored resume, log the job link, save the confirmation email or screenshot, and record the exact resume version used.',
      doneWhen: 'Tracker row is complete with source, status, and next follow-up date.',
    },
    {
      stage: 'Follow up',
      title: 'Run the follow-up sequence',
      detail: 'Send the recruiter note or connection request after applying, then follow the scheduled nudges if there is no response.',
      doneWhen: 'Every follow-up touch is dated and logged.',
    },
  );

  return tasks.slice(0, 5);
};

const buildChecklist = (analysis: ResumeAnalysis) =>
  unique([
    'Tailored resume saved as PDF and plain text',
    'Cover letter reviewed for accuracy',
    'Job link and source captured',
    'Company-specific motivation added',
    'Recruiter or hiring manager identified',
    'Follow-up reminders scheduled',
    analysis.atsIssues.length ? 'ATS findings resolved or intentionally accepted' : 'ATS-safe formatting confirmed',
  ]);

const buildTrackerFields = (roleTitle: string, companyName: string, analysis: ResumeAnalysis): TrackerField[] => [
  { label: 'Company', value: companyName },
  { label: 'Role', value: roleTitle },
  { label: 'Status', value: analysis.score >= 70 ? 'Ready for review' : 'Tailoring required' },
  { label: 'Resume match', value: `${analysis.score}/100` },
  { label: 'Keyword coverage', value: `${analysis.keywordCoverage}%` },
  { label: 'Next action', value: analysis.score >= 70 ? 'Submit application' : 'Finish priority queue' },
  { label: 'Follow-up', value: '3 business days after applying' },
];

const buildFollowUpSchedule = (): FollowUpStep[] => [
  { timing: 'Day 0', action: 'Submit application, save confirmation, and log the resume version used.' },
  { timing: 'Day 1', action: 'Send a concise recruiter or hiring-manager note with the job link.' },
  { timing: 'Day 4', action: 'If there is no response, send one value-focused follow-up.' },
  { timing: 'Day 10', action: 'Send a final polite nudge or mark the application as waiting.' },
];

const buildCoverLetter = (
  roleTitle: string,
  companyName: string,
  candidateName: string,
  contactLine: string,
  analysis: ResumeAnalysis,
  resume: string,
) => {
  const topKeywords = unique([...analysis.matchedKeywords, ...analysis.missingKeywords]).slice(0, 5).map(titleCase);
  const relevantBullets = extractRelevantBullets(resume);
  const proofPoints = relevantBullets.length
    ? relevantBullets.map((bullet) => `- ${bullet}`).join('\n')
    : '- Add one verified accomplishment that directly supports this role.\n- Add one measurable result from your most relevant project or position.';

  return `${candidateName}\n${contactLine}\n\nDear Hiring Team,\n\nI am excited to apply for the ${roleTitle} role at ${companyName}. My background aligns with the role through ${topKeywords.join(', ') || 'the core responsibilities described in the posting'}, and I am interested in contributing practical, measurable work to your team.\n\nRelevant highlights:\n${proofPoints}\n\nI would welcome the opportunity to discuss how my experience maps to your needs for this position. Thank you for your time and consideration.\n\nSincerely,\n${candidateName}`;
};

const buildRecruiterMessage = (
  roleTitle: string,
  companyName: string,
  candidateName: string,
  analysis: ResumeAnalysis,
) => {
  const strengths = analysis.matchedKeywords.slice(0, 4).map(titleCase).join(', ');

  return `Hi, I just applied for the ${roleTitle} role at ${companyName}. My experience lines up with ${strengths || 'the role requirements'}, and I would appreciate being considered for the team. If helpful, I can share a tailored resume version or answer any questions about my background.\n\nThank you,\n${candidateName}`;
};

const buildApplicationPacket = (
  planDetails: Pick<
    ApplicationAutomationPlan,
    'roleTitle' | 'companyName' | 'readiness' | 'applyReadinessScore' | 'summary' | 'coverLetter' | 'recruiterMessage'
  >,
  tasks: ApplicationTask[],
  checklist: string[],
  trackerFields: TrackerField[],
  followUpSchedule: FollowUpStep[],
) =>
  `APPLICATION AUTOMATION PACKET\n\nRole: ${planDetails.roleTitle}\nCompany: ${planDetails.companyName}\nReadiness: ${planDetails.readiness} (${planDetails.applyReadinessScore}/100)\n${planDetails.summary}\n\nPRIORITY QUEUE\n${tasks
    .map((task, index) => `${index + 1}. [${task.stage}] ${task.title}\n   ${task.detail}\n   Done when: ${task.doneWhen}`)
    .join('\n')}\n\nTRACKER ROW\n${trackerFields
    .map((field) => `${field.label}: ${field.value}`)
    .join('\n')}\n\nCHECKLIST\n${checklist.map((item) => `- ${item}`).join('\n')}\n\nFOLLOW-UP SCHEDULE\n${followUpSchedule
    .map((step) => `${step.timing}: ${step.action}`)
    .join('\n')}\n\nCOVER LETTER DRAFT\n${planDetails.coverLetter}\n\nRECRUITER OUTREACH\n${planDetails.recruiterMessage}`;

export const buildApplicationAutomationPlan = (
  resume: string,
  jobDescription: string,
  analysis: ResumeAnalysis,
): ApplicationAutomationPlan => {
  const roleTitle = extractRoleTitle(jobDescription);
  const companyName = extractCompanyName(jobDescription);
  const candidateName = getCandidateName(resume);
  const contactLine = getContactLine(resume);
  const applyReadinessScore = Math.round(
    Math.min(100, Math.max(0, analysis.score * 0.55 + analysis.keywordCoverage * 0.25 + analysis.atsReadiness * 0.2)),
  );
  const readiness = getReadiness(applyReadinessScore);
  const summary = getSummary(readiness, roleTitle, companyName);
  const priorityTasks = buildPriorityTasks(analysis);
  const checklist = buildChecklist(analysis);
  const trackerFields = buildTrackerFields(roleTitle, companyName, analysis);
  const followUpSchedule = buildFollowUpSchedule();
  const coverLetter = buildCoverLetter(roleTitle, companyName, candidateName, contactLine, analysis, resume);
  const recruiterMessage = buildRecruiterMessage(roleTitle, companyName, candidateName, analysis);
  const packetDetails = {
    roleTitle,
    companyName,
    readiness,
    applyReadinessScore,
    summary,
    coverLetter,
    recruiterMessage,
  };

  return {
    ...packetDetails,
    candidateName,
    priorityTasks,
    checklist,
    trackerFields,
    followUpSchedule,
    applicationPacket: buildApplicationPacket(packetDetails, priorityTasks, checklist, trackerFields, followUpSchedule),
  };
};
