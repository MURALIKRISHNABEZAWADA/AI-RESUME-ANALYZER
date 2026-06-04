import type { ResumeAnalysis } from './resumeAgent';

export interface ApplicationStep {
  title: string;
  detail: string;
  priority: 'Before applying' | 'When applying' | 'After applying';
}

export interface ApplicationAnswer {
  question: string;
  answer: string;
}

export interface FollowUpTouchpoint {
  timing: string;
  message: string;
}

export interface TrackerField {
  label: string;
  value: string;
}

export interface ApplicationPackage {
  candidateName: string;
  roleTitle: string;
  companyName: string;
  readinessScore: number;
  readinessLabel: string;
  riskFlags: string[];
  workflow: ApplicationStep[];
  applicationAnswers: ApplicationAnswer[];
  coverLetter: string;
  recruiterMessage: string;
  followUpPlan: FollowUpTouchpoint[];
  trackerFields: TrackerField[];
  exportText: string;
}

const EMPTY_APPLICATION_PACKAGE: ApplicationPackage = {
  candidateName: 'Your Name',
  roleTitle: 'Target Role',
  companyName: 'Target Company',
  readinessScore: 0,
  readinessLabel: 'Add resume and job description',
  riskFlags: ['Paste your resume and a job description to generate an application workflow.'],
  workflow: [],
  applicationAnswers: [],
  coverLetter: '',
  recruiterMessage: '',
  followUpPlan: [],
  trackerFields: [],
  exportText: '',
};

const clamp = (value: number, min = 0, max = 100) => Math.min(Math.max(value, min), max);

const titleCase = (value: string) =>
  value
    .split(' ')
    .filter(Boolean)
    .map((word) => (word.length <= 3 ? word.toUpperCase() : `${word[0].toUpperCase()}${word.slice(1)}`))
    .join(' ')
    .replace(/\bAi\b/g, 'AI')
    .replace(/\bApi\b/g, 'API')
    .replace(/\bAws\b/g, 'AWS')
    .replace(/\bCss\b/g, 'CSS')
    .replace(/\bHtml\b/g, 'HTML')
    .replace(/\bJavascript\b/g, 'JavaScript')
    .replace(/\bSql\b/g, 'SQL')
    .replace(/\bTypescript\b/g, 'TypeScript')
    .replace(/\bUx\b/g, 'UX');

const sentenceJoin = (items: string[]) => {
  if (items.length <= 1) {
    return items[0] ?? '';
  }

  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
};

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
  const companyMatch = jobDescription.match(/(?:company|organization|employer)\s*:?\s*([^\n.]+)/i);
  if (companyMatch?.[1]) {
    return companyMatch[1].trim().slice(0, 80);
  }

  const atCompanyMatch = jobDescription.match(/\bat\s+([A-Z][A-Za-z0-9&.,' -]{2,60})/);
  if (atCompanyMatch?.[1]) {
    return atCompanyMatch[1].replace(/\s+(is|we|and|for)\b.*$/i, '').trim();
  }

  return 'Target Company';
};

const extractCandidateName = (resume: string) => {
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

const getReadinessLabel = (score: number) => {
  if (score >= 85) {
    return 'Ready to apply';
  }

  if (score >= 70) {
    return 'Apply after quick tailoring';
  }

  if (score >= 50) {
    return 'Needs targeted edits';
  }

  return 'Build application evidence first';
};

const buildRiskFlags = (analysis: ResumeAnalysis) => {
  const risks: string[] = [];

  if (analysis.missingKeywords.length) {
    risks.push(`Add proof for ${sentenceJoin(analysis.missingKeywords.slice(0, 4).map(titleCase))}.`);
  }

  analysis.atsIssues.slice(0, 3).forEach((issue) => risks.push(issue.detail));

  if (analysis.keywordCoverage < 50) {
    risks.push('Keyword coverage is low, so tailor the resume before submitting.');
  }

  if (!risks.length) {
    risks.push('No blocking application risks detected. Review details for accuracy before submitting.');
  }

  return risks.slice(0, 5);
};

const buildWorkflow = (analysis: ResumeAnalysis, roleTitle: string, companyName: string): ApplicationStep[] => [
  {
    title: 'Tailor the resume draft',
    detail: analysis.missingKeywords.length
      ? `Add truthful accomplishments for ${sentenceJoin(analysis.missingKeywords.slice(0, 5).map(titleCase))} before uploading.`
      : 'Review the generated resume draft for accuracy and save it as a clean PDF or DOCX if the application portal requires it.',
    priority: 'Before applying',
  },
  {
    title: 'Prepare answer bank',
    detail: `Use the generated answers below for common ${roleTitle} application questions and edit them with specific facts.`,
    priority: 'Before applying',
  },
  {
    title: 'Submit with human review',
    detail: `Open the ${companyName} application, paste the tailored resume details, and review every required field before final submission.`,
    priority: 'When applying',
  },
  {
    title: 'Log the application',
    detail: 'Copy the tracker fields into your spreadsheet or CRM immediately after submitting so follow-ups stay organized.',
    priority: 'When applying',
  },
  {
    title: 'Follow up with context',
    detail: 'Use the follow-up plan to message a recruiter or hiring team with the role title, relevant strengths, and a concise ask.',
    priority: 'After applying',
  },
];

const buildProofPoints = (analysis: ResumeAnalysis) => {
  const keywords = analysis.matchedKeywords.slice(0, 5).map(titleCase);
  const strengths = analysis.strengths.slice(0, 2);
  const proofPoints = [...keywords, ...strengths].filter(Boolean);

  return proofPoints.length ? proofPoints : ['the target role requirements', 'relevant experience'];
};

const buildApplicationAnswers = (
  candidateName: string,
  roleTitle: string,
  companyName: string,
  proofPoints: string[],
  analysis: ResumeAnalysis,
): ApplicationAnswer[] => [
  {
    question: 'Why are you interested in this role?',
    answer: `I am interested in the ${roleTitle} opportunity at ${companyName} because it aligns with my experience in ${sentenceJoin(proofPoints.slice(0, 3))}. I am excited to contribute practical execution, collaboration, and measurable outcomes to the team.`,
  },
  {
    question: 'What makes you a strong fit?',
    answer: `${candidateName} brings relevant strengths in ${sentenceJoin(proofPoints.slice(0, 4))}. The resume also shows ${analysis.keywordCoverage}% keyword coverage and ${analysis.atsReadiness}% ATS readiness, which should be strengthened further with accurate, role-specific examples before submission.`,
  },
  {
    question: 'Tell us about a relevant accomplishment.',
    answer: analysis.missingKeywords.length
      ? `Use a real accomplishment that demonstrates ${titleCase(analysis.missingKeywords[0])}. Include the situation, action, tools used, and measurable result.`
      : 'Use a real accomplishment from the tailored resume. Include the situation, action, tools used, and measurable result.',
  },
  {
    question: 'Anything else you want us to know?',
    answer: `I have reviewed the ${roleTitle} requirements and tailored my materials to highlight the most relevant experience. I would welcome the chance to discuss how my background can support ${companyName}.`,
  },
];

const buildCoverLetter = (
  candidateName: string,
  roleTitle: string,
  companyName: string,
  proofPoints: string[],
  analysis: ResumeAnalysis,
) => `Dear Hiring Team,

I am applying for the ${roleTitle} role at ${companyName}. My background aligns with the role through ${sentenceJoin(proofPoints.slice(0, 4))}, and I am interested in contributing to the responsibilities described in the posting.

In my resume, I highlight experience that maps to the job description, including ${sentenceJoin(analysis.matchedKeywords.slice(0, 5).map(titleCase)) || 'the core requirements of the role'}. Before submitting, I will make sure every example is accurate, specific, and supported by measurable results.

Thank you for your consideration. I would appreciate the opportunity to discuss how my experience can help the team.

Sincerely,
${candidateName}`;

const buildRecruiterMessage = (
  candidateName: string,
  roleTitle: string,
  companyName: string,
  proofPoints: string[],
) => `Hi, I am ${candidateName}. I just applied for the ${roleTitle} role at ${companyName}. My background includes ${sentenceJoin(proofPoints.slice(0, 3))}, and I would be grateful if you could route my application to the right hiring team or share any context about the role. Thank you.`;

const buildFollowUpPlan = (roleTitle: string, companyName: string, proofPoints: string[]): FollowUpTouchpoint[] => [
  {
    timing: 'Same day',
    message: `Connect with one recruiter or hiring manager and mention the ${roleTitle} application at ${companyName}.`,
  },
  {
    timing: '3-5 business days',
    message: `Send a concise follow-up with one proof point: ${proofPoints[0] ?? 'relevant experience'}.`,
  },
  {
    timing: 'After interview',
    message: 'Send a thank-you note that references the conversation, the role priorities, and your strongest matching accomplishment.',
  },
];

const buildTrackerFields = (
  roleTitle: string,
  companyName: string,
  analysis: ResumeAnalysis,
  readinessScore: number,
): TrackerField[] => [
  { label: 'Company', value: companyName },
  { label: 'Role', value: roleTitle },
  { label: 'Application URL', value: 'Paste job posting URL' },
  { label: 'Status', value: 'Ready to apply' },
  { label: 'Resume match score', value: `${analysis.score}/100` },
  { label: 'Apply readiness', value: `${readinessScore}/100` },
  { label: 'Top missing keywords', value: analysis.missingKeywords.slice(0, 5).map(titleCase).join(', ') || 'None detected' },
  { label: 'Date applied', value: 'Add submission date' },
  { label: 'Next follow-up', value: 'Add follow-up date' },
];

const buildExportText = (applicationPackage: Omit<ApplicationPackage, 'exportText'>) => {
  const workflow = applicationPackage.workflow
    .map((step, index) => `${index + 1}. [${step.priority}] ${step.title}: ${step.detail}`)
    .join('\n');
  const answers = applicationPackage.applicationAnswers
    .map((answer) => `Q: ${answer.question}\nA: ${answer.answer}`)
    .join('\n\n');
  const followUps = applicationPackage.followUpPlan
    .map((touchpoint) => `- ${touchpoint.timing}: ${touchpoint.message}`)
    .join('\n');
  const tracker = applicationPackage.trackerFields.map((field) => `- ${field.label}: ${field.value}`).join('\n');
  const risks = applicationPackage.riskFlags.map((risk) => `- ${risk}`).join('\n');

  return `JOB APPLICATION PACKAGE
Candidate: ${applicationPackage.candidateName}
Role: ${applicationPackage.roleTitle}
Company: ${applicationPackage.companyName}
Apply readiness: ${applicationPackage.readinessScore}/100 - ${applicationPackage.readinessLabel}

RISKS TO FIX BEFORE APPLYING
${risks}

APPLICATION WORKFLOW
${workflow}

COVER LETTER DRAFT
${applicationPackage.coverLetter}

RECRUITER MESSAGE
${applicationPackage.recruiterMessage}

APPLICATION ANSWER BANK
${answers}

FOLLOW-UP PLAN
${followUps}

TRACKER FIELDS
${tracker}

FINAL CHECK
Review all generated text for accuracy, remove placeholders, and submit only after confirming every answer is truthful.`;
};

export const generateApplicationPackage = (
  resume: string,
  jobDescription: string,
  analysis: ResumeAnalysis,
): ApplicationPackage => {
  const cleanResume = resume.trim();
  const cleanJobDescription = jobDescription.trim();

  if (!cleanResume || !cleanJobDescription) {
    return EMPTY_APPLICATION_PACKAGE;
  }

  const candidateName = extractCandidateName(cleanResume);
  const roleTitle = extractRoleTitle(cleanJobDescription);
  const companyName = extractCompanyName(cleanJobDescription);
  const readinessScore = Math.round(
    clamp(analysis.score * 0.5 + analysis.keywordCoverage * 0.25 + analysis.atsReadiness * 0.2 - analysis.atsIssues.length * 2),
  );
  const readinessLabel = getReadinessLabel(readinessScore);
  const proofPoints = buildProofPoints(analysis);
  const riskFlags = buildRiskFlags(analysis);
  const workflow = buildWorkflow(analysis, roleTitle, companyName);
  const applicationAnswers = buildApplicationAnswers(candidateName, roleTitle, companyName, proofPoints, analysis);
  const coverLetter = buildCoverLetter(candidateName, roleTitle, companyName, proofPoints, analysis);
  const recruiterMessage = buildRecruiterMessage(candidateName, roleTitle, companyName, proofPoints);
  const followUpPlan = buildFollowUpPlan(roleTitle, companyName, proofPoints);
  const trackerFields = buildTrackerFields(roleTitle, companyName, analysis, readinessScore);
  const packageWithoutExport = {
    candidateName,
    roleTitle,
    companyName,
    readinessScore,
    readinessLabel,
    riskFlags,
    workflow,
    applicationAnswers,
    coverLetter,
    recruiterMessage,
    followUpPlan,
    trackerFields,
  };

  return {
    ...packageWithoutExport,
    exportText: buildExportText(packageWithoutExport),
  };
};
