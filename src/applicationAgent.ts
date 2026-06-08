import type { ResumeAnalysis } from './resumeAgent';

export interface ApplicationProfile {
  companyName: string;
  jobUrl: string;
  profileNotes: string;
}

export interface ChecklistItem {
  title: string;
  detail: string;
  done: boolean;
}

export interface AnswerItem {
  question: string;
  answer: string;
}

export interface ApplicationPlan {
  applicationId: string;
  roleTitle: string;
  companyName: string;
  readinessScore: number;
  status: string;
  fitSummary: string;
  checklist: ChecklistItem[];
  coverLetter: string;
  recruiterMessage: string;
  answerBank: AnswerItem[];
  portalSteps: string[];
  riskFlags: string[];
}

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9+#.\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const titleCase = (value: string) =>
  value
    .split(/[\s.-]+/)
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

const inferCompanyName = (companyName: string, jobUrl: string, jobDescription: string) => {
  const explicitCompany = companyName.trim();
  if (explicitCompany) {
    return explicitCompany;
  }

  try {
    const hostname = new URL(jobUrl).hostname.replace(/^www\./, '').split('.')[0];
    if (hostname) {
      return titleCase(hostname);
    }
  } catch {
    // The job URL field is optional, so an invalid or empty URL should not block local planning.
  }

  const companyMatch = jobDescription.match(/(?:company|employer|organization)\s*:?\s*([^\n.]+)/i);
  return companyMatch?.[1]?.trim().slice(0, 80) || 'Target Company';
};

const getApplicationId = (companyName: string, roleTitle: string) => {
  const seed = normalize(`${companyName}-${roleTitle}`);
  let hash = 0;
  for (const character of seed) {
    hash = (hash * 31 + character.charCodeAt(0)) % 1000000;
  }
  return `APP-${String(hash).padStart(6, '0')}`;
};

const profileHasAny = (profileNotes: string, terms: string[]) => {
  const normalizedProfile = normalize(profileNotes);
  return terms.some((term) => normalizedProfile.includes(normalize(term)));
};

const buildChecklist = (analysis: ResumeAnalysis, profile: ApplicationProfile): ChecklistItem[] => [
  {
    title: 'Tailor resume',
    detail: `Review the generated resume and add truthful evidence for ${analysis.missingKeywords.slice(0, 4).map(titleCase).join(', ') || 'the highest-value JD terms'}.`,
    done: analysis.score >= 75 && analysis.missingKeywords.length <= 8,
  },
  {
    title: 'Confirm application details',
    detail: 'Verify work authorization, location preference, compensation expectations, availability, and sponsorship answers before submitting.',
    done: profile.profileNotes.trim().length > 40,
  },
  {
    title: 'Prepare portal assets',
    detail: 'Save the tailored resume as PDF/plain text, keep the cover letter ready, and use the answer bank for repeated form questions.',
    done: Boolean(analysis.rewrittenResume),
  },
  {
    title: 'Human review before submit',
    detail: 'Open the target portal, paste only accurate answers, review every field, and submit manually when everything is correct.',
    done: false,
  },
];

const buildCoverLetter = (
  candidateName: string,
  companyName: string,
  roleTitle: string,
  analysis: ResumeAnalysis,
  profile: ApplicationProfile,
) => {
  const matched = analysis.matchedKeywords.slice(0, 5).map(titleCase);
  const gaps = analysis.missingKeywords.slice(0, 3).map(titleCase);

  return [
    `Dear ${companyName} Hiring Team,`,
    '',
    `I am excited to apply for the ${roleTitle} role at ${companyName}. My background aligns with ${matched.join(', ') || 'the responsibilities in the posting'}, and I can bring a practical, outcome-focused approach to the team.`,
    '',
    analysis.strengths.slice(0, 2).join(' ') ||
      'I have relevant experience building solutions, collaborating across teams, and communicating clearly with stakeholders.',
    gaps.length
      ? `Before submitting, I will make sure my application includes accurate examples for ${gaps.join(', ')} where they reflect my real experience.`
      : 'The resume is already well aligned to the job description, so I will focus on concise examples and measurable outcomes.',
    '',
    profile.profileNotes.trim()
      ? `Additional application context: ${profile.profileNotes.trim()}`
      : 'I am happy to provide additional details about availability, work authorization, location preference, and compensation expectations during the process.',
    '',
    `Sincerely,\n${candidateName}`,
  ].join('\n');
};

const buildRecruiterMessage = (candidateName: string, companyName: string, roleTitle: string, analysis: ResumeAnalysis) => {
  const highlights = analysis.matchedKeywords.slice(0, 4).map(titleCase).join(', ') || 'the role requirements';
  return `Hi ${companyName} team, I am applying for the ${roleTitle} role and wanted to share my interest. My resume is strongest around ${highlights}, and I would welcome the chance to discuss how my experience maps to your needs. Thank you, ${candidateName}.`;
};

const buildAnswerBank = (
  analysis: ResumeAnalysis,
  profile: ApplicationProfile,
  roleTitle: string,
  companyName: string,
): AnswerItem[] => [
  {
    question: 'Why are you interested in this role?',
    answer: `I am interested in the ${roleTitle} role at ${companyName} because it matches my experience with ${analysis.matchedKeywords.slice(0, 4).map(titleCase).join(', ') || 'the core responsibilities in the posting'} and gives me a chance to contribute measurable outcomes.`,
  },
  {
    question: 'Why are you a strong fit?',
    answer: `${analysis.summary} I would emphasize accurate examples from my resume that show ${analysis.strengths.slice(0, 2).join(' ').toLowerCase()}`,
  },
  {
    question: 'Work authorization / sponsorship',
    answer: profileHasAny(profile.profileNotes, ['authorized', 'sponsorship', 'visa', 'citizen', 'permanent resident'])
      ? profile.profileNotes
      : 'Add your accurate work authorization and sponsorship answer here before submitting.',
  },
  {
    question: 'Availability / location / compensation',
    answer: profileHasAny(profile.profileNotes, ['available', 'remote', 'hybrid', 'onsite', 'salary', 'compensation'])
      ? profile.profileNotes
      : 'Add accurate availability, location preference, work mode, and compensation expectations before submitting.',
  },
];

const buildRiskFlags = (analysis: ResumeAnalysis, profile: ApplicationProfile) => {
  const flags: string[] = [];
  if (analysis.score < 65) {
    flags.push('Resume match is below the recommended application threshold; tailor more evidence before applying.');
  }
  if (analysis.missingKeywords.length > 10) {
    flags.push('Many JD keywords are missing; add only truthful examples that reflect your real experience.');
  }
  if (!profile.profileNotes.trim()) {
    flags.push('Profile details are empty; common portal questions still need accurate personal answers.');
  }
  if (!profile.jobUrl.trim()) {
    flags.push('No job URL is saved; add the portal link so the application record is easy to revisit.');
  }

  return flags.length ? flags : ['No major blockers found. Review all generated content for accuracy before submitting.'];
};

export const buildApplicationPlan = (
  resume: string,
  jobDescription: string,
  analysis: ResumeAnalysis,
  profile: ApplicationProfile,
): ApplicationPlan => {
  const roleTitle = getRoleTitle(jobDescription);
  const companyName = inferCompanyName(profile.companyName, profile.jobUrl, jobDescription);
  const candidateName = getCandidateName(resume);
  const profileCompleteness = [profile.companyName, profile.jobUrl, profile.profileNotes].filter((value) => value.trim()).length / 3;
  const readinessScore = Math.round(clamp(analysis.score * 0.72 + analysis.atsReadiness * 0.18 + profileCompleteness * 10));
  const status =
    readinessScore >= 80
      ? 'Ready for human-reviewed submission'
      : readinessScore >= 65
        ? 'Needs quick tailoring'
        : 'Needs more application prep';

  return {
    applicationId: getApplicationId(companyName, roleTitle),
    roleTitle,
    companyName,
    readinessScore,
    status,
    fitSummary: `${companyName} - ${roleTitle}: ${analysis.summary}`,
    checklist: buildChecklist(analysis, profile),
    coverLetter: buildCoverLetter(candidateName, companyName, roleTitle, analysis, profile),
    recruiterMessage: buildRecruiterMessage(candidateName, companyName, roleTitle, analysis),
    answerBank: buildAnswerBank(analysis, profile, roleTitle, companyName),
    portalSteps: [
      profile.jobUrl.trim() ? `Open ${profile.jobUrl.trim()} and confirm it is the official application portal.` : 'Add the official job URL before starting the portal workflow.',
      'Upload the tailored resume, then paste the cover letter only if the form requests one.',
      'Use the answer bank for repeated questions, editing every answer so it remains accurate and specific.',
      'Review consent, demographic, legal, salary, and sponsorship fields manually before submitting.',
      'After submission, save the confirmation number or email in your tracker.',
    ],
    riskFlags: buildRiskFlags(analysis, profile),
  };
};

export const buildApplicationPacketText = (plan: ApplicationPlan) =>
  [
    `${plan.applicationId} | ${plan.companyName} | ${plan.roleTitle}`,
    `Status: ${plan.status}`,
    `Readiness: ${plan.readinessScore}/100`,
    '',
    'CHECKLIST',
    ...plan.checklist.map((item) => `- [${item.done ? 'x' : ' '}] ${item.title}: ${item.detail}`),
    '',
    'COVER LETTER',
    plan.coverLetter,
    '',
    'RECRUITER MESSAGE',
    plan.recruiterMessage,
    '',
    'ANSWER BANK',
    ...plan.answerBank.map((item) => `Q: ${item.question}\nA: ${item.answer}`),
    '',
    'PORTAL STEPS',
    ...plan.portalSteps.map((step, index) => `${index + 1}. ${step}`),
  ].join('\n');
