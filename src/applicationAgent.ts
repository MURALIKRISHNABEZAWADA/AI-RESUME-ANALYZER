import { ResumeAnalysis, analyzeResume } from './resumeAgent';

export type ApplicationStatus = 'draft' | 'ready' | 'applied' | 'follow_up';

export interface ContactProfile {
  name: string;
  email: string;
  phone: string;
  linkedin: string;
  portfolio: string;
}

export interface ApplicationPacket {
  id: string;
  createdAt: string;
  jobTitle: string;
  company: string;
  applicationUrl: string;
  status: ApplicationStatus;
  fitSummary: string;
  analysis: ResumeAnalysis;
  contactProfile: ContactProfile;
  tailoredResume: string;
  coverLetter: string;
  outreachMessage: string;
  checklist: string[];
  automationPlan: string[];
}

export interface BuildApplicationPacketInput {
  resume: string;
  jobDescription: string;
  jobTitle?: string;
  company?: string;
  applicationUrl?: string;
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

const firstMatch = (value: string, pattern: RegExp) => value.match(pattern)?.[1]?.trim() ?? '';

const inferJobTitle = (jobDescription: string) => {
  const explicitTitle = firstMatch(jobDescription, /(?:job\s*title|role|position)\s*:?\s*([^\n.]+)/i);
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

const inferCompany = (jobDescription: string) => {
  const explicitCompany = firstMatch(jobDescription, /(?:company|employer|organization)\s*:?\s*([^\n.]+)/i);
  return explicitCompany ? explicitCompany.slice(0, 80) : 'Target Company';
};

const getContactProfile = (resume: string): ContactProfile => {
  const lines = resume
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const name =
    lines
      .slice(0, 6)
      .find(
        (line) =>
          line.length <= 60 &&
          !/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(line) &&
          !/(\+?\d[\d\s().-]{7,}\d)/.test(line) &&
          !/linkedin|github|portfolio|http/i.test(line),
      ) ?? 'Your Name';

  return {
    name,
    email: resume.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? 'Add email before applying',
    phone: resume.match(/(\+?\d[\d\s().-]{7,}\d)/)?.[0] ?? 'Add phone before applying',
    linkedin: resume.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s|]+/i)?.[0] ?? 'Add LinkedIn URL if available',
    portfolio:
      resume.match(/(?:https?:\/\/)?(?:www\.)?(?:github\.com|[\w.-]+\.(?:dev|com|io|me))\/?[^\s|]*/i)?.[0] ??
      'Add portfolio or GitHub URL if available',
  };
};

const getRecommendedStatus = (analysis: ResumeAnalysis): ApplicationStatus => {
  const hasMajorIssue = analysis.atsIssues.some((issue) => issue.severity === 'major');
  return analysis.score >= 70 && !hasMajorIssue ? 'ready' : 'draft';
};

const buildFitSummary = (analysis: ResumeAnalysis, jobTitle: string, company: string) => {
  const missingKeywords = analysis.missingKeywords.slice(0, 4).map(titleCase);
  const keywordNote = missingKeywords.length
    ? `Add truthful evidence for ${missingKeywords.join(', ')} before submitting.`
    : 'Keyword coverage looks strong for this posting.';

  return `${jobTitle} at ${company}: ${analysis.score}/100 (${analysis.grade}) match. ${keywordNote}`;
};

const buildCoverLetter = (
  contactProfile: ContactProfile,
  jobTitle: string,
  company: string,
  analysis: ResumeAnalysis,
) => {
  const strengths = analysis.strengths.slice(0, 2);
  const keywordLine = [...analysis.matchedKeywords, ...analysis.missingKeywords].slice(0, 6).map(titleCase).join(', ');

  return [
    contactProfile.name,
    contactProfile.email,
    contactProfile.phone,
    '',
    `Dear ${company} Hiring Team,`,
    '',
    `I am excited to apply for the ${jobTitle} role at ${company}. My background aligns with the role's emphasis on ${keywordLine || 'the responsibilities in the job description'}, and I would bring a practical, outcome-focused approach to the team.`,
    '',
    strengths.length
      ? strengths.map((strength) => `- ${strength}`).join('\n')
      : '- I can connect my experience to the job requirements with relevant accomplishments and measurable outcomes.',
    '',
    'I have attached a tailored, ATS-friendly resume draft for review. Before submitting, I will verify every detail, replace placeholders with accurate information, and ensure the application answers each required question.',
    '',
    'Thank you for your consideration.',
    '',
    contactProfile.name,
  ].join('\n');
};

const buildOutreachMessage = (contactProfile: ContactProfile, jobTitle: string, company: string, analysis: ResumeAnalysis) =>
  `Hi, I am ${contactProfile.name}. I am applying for the ${jobTitle} role at ${company} and noticed the team is looking for ${[...analysis.matchedKeywords, ...analysis.missingKeywords]
    .slice(0, 4)
    .map(titleCase)
    .join(', ') || 'skills that match my background'}. I would appreciate the chance to connect or learn more about the team.`;

const buildChecklist = (analysis: ResumeAnalysis) => [
  'Review the tailored resume and remove every placeholder before applying.',
  ...analysis.improvements.slice(0, 3),
  'Confirm contact details, work authorization, location, salary, and start-date answers.',
  'Upload the tailored resume and paste the cover letter only after human review.',
  'Do a final manual review of the application page before pressing submit.',
];

const buildAutomationPlan = (applicationUrl: string, status: ApplicationStatus) => [
  applicationUrl ? `Open application page: ${applicationUrl}` : 'Add the application URL to make the packet actionable.',
  'Use the contact profile fields to speed up form filling.',
  'Paste the generated resume and cover letter into the employer portal.',
  status === 'ready'
    ? 'Status is ready: complete the final human review and submit manually.'
    : 'Status is draft: improve the resume/JD fit before applying.',
  'After submitting, mark the job as applied and schedule a follow-up reminder.',
];

export const buildApplicationPacket = ({
  resume,
  jobDescription,
  jobTitle,
  company,
  applicationUrl = '',
}: BuildApplicationPacketInput): ApplicationPacket => {
  const analysis = analyzeResume(resume, jobDescription);
  const resolvedJobTitle = jobTitle?.trim() || inferJobTitle(jobDescription);
  const resolvedCompany = company?.trim() || inferCompany(jobDescription);
  const status = getRecommendedStatus(analysis);
  const contactProfile = getContactProfile(resume);

  return {
    id: `application-${Date.now()}`,
    createdAt: new Date().toISOString(),
    jobTitle: resolvedJobTitle,
    company: resolvedCompany,
    applicationUrl: applicationUrl.trim(),
    status,
    fitSummary: buildFitSummary(analysis, resolvedJobTitle, resolvedCompany),
    analysis,
    contactProfile,
    tailoredResume: analysis.rewrittenResume,
    coverLetter: buildCoverLetter(contactProfile, resolvedJobTitle, resolvedCompany, analysis),
    outreachMessage: buildOutreachMessage(contactProfile, resolvedJobTitle, resolvedCompany, analysis),
    checklist: buildChecklist(analysis),
    automationPlan: buildAutomationPlan(applicationUrl.trim(), status),
  };
};
