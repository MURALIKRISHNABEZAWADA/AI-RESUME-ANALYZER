import type { ResumeAnalysis } from './resumeAgent';

export interface CandidateProfile {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  portfolio: string;
  workAuthorization: string;
  sponsorship: string;
  salaryExpectation: string;
  noticePeriod: string;
}

export interface ChecklistItem {
  task: string;
  status: 'ready' | 'needs-work' | 'blocked' | 'todo';
  detail: string;
}

export interface FollowUpItem {
  when: string;
  action: string;
}

export interface ApplicationPackage {
  readinessScore: number;
  recommendation: string;
  company: string;
  roleTitle: string;
  missingProfileFields: string[];
  checklist: ChecklistItem[];
  suggestedFormAnswers: Array<[string, string]>;
  coverLetter: string;
  recruiterMessage: string;
  followUpPlan: FollowUpItem[];
  tracker: {
    stage: string;
    nextAction: string;
    resumeVersion: string;
  };
}

const REQUIRED_PROFILE_FIELDS: Array<[keyof CandidateProfile, string]> = [
  ['fullName', 'Full legal or preferred name'],
  ['email', 'Professional email address'],
  ['phone', 'Phone number'],
  ['location', 'Current location'],
  ['linkedin', 'LinkedIn profile URL'],
  ['workAuthorization', 'Work authorization status'],
];

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

const getCompany = (jobDescription: string, companyName: string, jobUrl: string) => {
  if (companyName.trim()) {
    return companyName.trim().slice(0, 80);
  }

  const companyMatch = jobDescription.match(/(?:company|organization|employer)\s*:?\s*([^\n.]+)/i);
  if (companyMatch?.[1]) {
    return companyMatch[1].trim().slice(0, 80);
  }

  try {
    const hostname = new URL(jobUrl).hostname.replace(/^www\./, '');
    const domain = hostname.split('.')[0];
    if (domain) {
      return titleCase(domain.replace(/-/g, ' '));
    }
  } catch {
    // Invalid or empty URLs simply fall back to a generic company label.
  }

  return 'Target Company';
};

const getMissingProfileFields = (profile: CandidateProfile) =>
  REQUIRED_PROFILE_FIELDS.filter(([field]) => !profile[field].trim()).map(([, label]) => label);

const getReadinessScore = (analysis: ResumeAnalysis, missingProfileCount: number) => {
  const profilePenalty = missingProfileCount * 6;
  const keywordPenalty = Math.min(analysis.missingKeywords.length, 12);
  return Math.max(0, Math.min(100, Math.round(analysis.score * 0.78 + 22 - profilePenalty - keywordPenalty)));
};

const getRecommendation = (analysis: ResumeAnalysis, missingProfileCount: number) => {
  if (analysis.score >= 75 && missingProfileCount <= 1) {
    return 'Apply now';
  }

  if (analysis.score >= 55) {
    return 'Apply after quick edits';
  }

  if (analysis.missingKeywords.length >= 16) {
    return 'Research fit before applying';
  }

  return 'Apply after resume tailoring';
};

const fieldValue = (value: string, fallback: string) => value.trim() || fallback;

export const emptyCandidateProfile: CandidateProfile = {
  fullName: '',
  email: '',
  phone: '',
  location: '',
  linkedin: '',
  portfolio: '',
  workAuthorization: '',
  sponsorship: '',
  salaryExpectation: '',
  noticePeriod: '',
};

export const sampleCandidateProfile: CandidateProfile = {
  fullName: 'Alex Morgan',
  email: 'alex.morgan@email.com',
  phone: '555-0184',
  location: 'Austin, TX',
  linkedin: 'https://linkedin.com/in/alexmorgan',
  portfolio: 'https://github.com/alexmorgan',
  workAuthorization: 'Authorized to work in the United States',
  sponsorship: 'No sponsorship required',
  salaryExpectation: 'Flexible based on role scope and total compensation',
  noticePeriod: 'Two weeks',
};

export const buildApplicationPackage = ({
  analysis,
  candidateProfile,
  companyName,
  jobDescription,
  jobUrl,
}: {
  analysis: ResumeAnalysis;
  candidateProfile: CandidateProfile;
  companyName: string;
  jobDescription: string;
  jobUrl: string;
}): ApplicationPackage => {
  const roleTitle = getRoleTitle(jobDescription);
  const company = getCompany(jobDescription, companyName, jobUrl);
  const missingProfileFields = getMissingProfileFields(candidateProfile);
  const readinessScore = getReadinessScore(analysis, missingProfileFields.length);
  const matchedSkills = analysis.matchedKeywords.slice(0, 8).map(titleCase);
  const missingSkills = analysis.missingKeywords.slice(0, 5).map(titleCase);
  const firstStrength = analysis.strengths[0] ?? 'You bring practical experience, clear communication, and a focus on measurable outcomes.';
  const secondStrength = analysis.strengths[1] ?? 'You can connect your experience to team priorities in an interview.';
  const firstImprovement =
    analysis.improvements[0] ?? 'review the resume for accuracy and role-specific evidence before submitting.';

  return {
    readinessScore,
    recommendation: getRecommendation(analysis, missingProfileFields.length),
    company,
    roleTitle,
    missingProfileFields,
    checklist: [
      {
        task: 'Review the ATS-optimized resume',
        status: analysis.score >= 70 ? 'ready' : 'needs-work',
        detail: 'Replace placeholders with verified experience before uploading.',
      },
      {
        task: 'Add missing job keywords truthfully',
        status: missingSkills.length ? 'needs-work' : 'ready',
        detail: missingSkills.join(', ') || 'Keyword coverage looks strong.',
      },
      {
        task: 'Complete candidate profile fields',
        status: missingProfileFields.length ? 'blocked' : 'ready',
        detail: missingProfileFields.join(', ') || 'Core profile fields are present.',
      },
      {
        task: 'Open the application page',
        status: jobUrl.trim() ? 'ready' : 'needs-work',
        detail: jobUrl.trim() || 'Add the job posting URL so the tracker points to the right application.',
      },
      {
        task: 'Save evidence after submitting',
        status: 'todo',
        detail: 'Capture confirmation number, application date, and recruiter contact if available.',
      },
    ],
    suggestedFormAnswers: [
      ['Full name', fieldValue(candidateProfile.fullName, 'Add your full name')],
      ['Email', fieldValue(candidateProfile.email, 'Add your professional email')],
      ['Phone', fieldValue(candidateProfile.phone, 'Add your phone number')],
      ['Location', fieldValue(candidateProfile.location, 'Add your current city and state/country')],
      ['LinkedIn', fieldValue(candidateProfile.linkedin, 'Add your LinkedIn profile URL')],
      ['Portfolio', fieldValue(candidateProfile.portfolio, 'Add portfolio or GitHub URL if relevant')],
      ['Work authorization', fieldValue(candidateProfile.workAuthorization, 'Add your work authorization status')],
      ['Sponsorship', fieldValue(candidateProfile.sponsorship, 'Add whether you require sponsorship')],
      [
        'Salary expectations',
        fieldValue(candidateProfile.salaryExpectation, 'Flexible based on role scope and total compensation.'),
      ],
      ['Notice period', fieldValue(candidateProfile.noticePeriod, 'Add your earliest available start date or notice period.')],
      [
        'Why are you interested?',
        `I am interested in the ${roleTitle} role at ${company} because it aligns with my experience in ${
          matchedSkills.slice(0, 4).join(', ') || 'the responsibilities described in the posting'
        }.`,
      ],
      ['Top relevant skills', matchedSkills.join(', ') || 'Add the skills that honestly match your experience.'],
      ['Keywords to address before submitting', missingSkills.join(', ') || 'No high-priority gaps detected.'],
    ],
    coverLetter: [
      `Dear ${company} Hiring Team,`,
      '',
      `I am excited to apply for the ${roleTitle} role at ${company}. My background aligns with ${
        matchedSkills.slice(0, 5).join(', ') || 'the responsibilities in the job description'
      }, and I am motivated by the opportunity to contribute quickly.`,
      '',
      firstStrength,
      secondStrength,
      '',
      `Before submitting, I will ${firstImprovement.toLowerCase()}`,
      '',
      'Thank you for your time and consideration.',
      '',
      `Sincerely,\n${fieldValue(candidateProfile.fullName, 'Your Name')}`,
    ].join('\n'),
    recruiterMessage: `Hi, I am ${fieldValue(candidateProfile.fullName, 'Your Name')}. I am applying for the ${roleTitle} role at ${company} and noticed a strong fit with ${
      matchedSkills.slice(0, 3).join(', ') || 'the role requirements'
    }. I would appreciate the opportunity to share how my experience maps to the team needs. Thank you for considering my application.`,
    followUpPlan: [
      {
        when: 'Submission day',
        action: 'Save the confirmation email, application ID, role title, resume version, and job URL.',
      },
      {
        when: '3 business days after applying',
        action: `Send a short LinkedIn or email note to a recruiter or hiring contact at ${company}.`,
      },
      {
        when: '7 business days after applying',
        action: 'Follow up once with the recruiter message if there has been no response.',
      },
      {
        when: '14 business days after applying',
        action: 'Move the application to nurture or closed unless there is active communication.',
      },
    ],
    tracker: {
      stage: readinessScore >= 75 && !missingProfileFields.length ? 'ready-to-apply' : 'prep-needed',
      nextAction: readinessScore >= 75 && !missingProfileFields.length ? 'Submit application' : 'Resolve checklist blockers',
      resumeVersion: `${company} - ${roleTitle} ATS resume`,
    },
  };
};
