import { describe, expect, it } from 'vitest';
import { generateApplicationPackage } from './applicationAgent';
import { analyzeResume, sampleJobDescription, sampleResume } from './resumeAgent';

describe('generateApplicationPackage', () => {
  it('returns an empty package until both resume and job description are present', () => {
    const analysis = analyzeResume('', '');
    const applicationPackage = generateApplicationPackage('', '', analysis);

    expect(applicationPackage.readinessScore).toBe(0);
    expect(applicationPackage.workflow).toEqual([]);
    expect(applicationPackage.exportText).toBe('');
  });

  it('creates an actionable application packet from a resume analysis', () => {
    const analysis = analyzeResume(sampleResume, sampleJobDescription);
    const applicationPackage = generateApplicationPackage(sampleResume, sampleJobDescription, analysis);

    expect(applicationPackage.candidateName).toBe('Alex Morgan');
    expect(applicationPackage.roleTitle).toBe('Frontend Engineer');
    expect(applicationPackage.readinessScore).toBeGreaterThan(0);
    expect(applicationPackage.workflow).toHaveLength(5);
    expect(applicationPackage.applicationAnswers).toHaveLength(4);
    expect(applicationPackage.coverLetter).toContain('Frontend Engineer');
    expect(applicationPackage.recruiterMessage).toContain('Alex Morgan');
    expect(applicationPackage.exportText).toContain('JOB APPLICATION PACKAGE');
    expect(applicationPackage.exportText).toContain('APPLICATION WORKFLOW');
  });

  it('surfaces missing keywords as risks and tailoring steps', () => {
    const resume = `Jordan Lee
jordan.lee@email.com | 555-0133

Professional Summary
Developer with JavaScript experience.

Skills
JavaScript, HTML, CSS

Professional Experience
Developer | Example Co | 2022 - Present
- Built UI features for internal teams.

Education
B.S. Computer Science`;
    const jobDescription = `Role: Full Stack Engineer
Company: Acme Health
We need a Full Stack Engineer with React, TypeScript, Node, AWS, automation, testing, and data visualization experience.`;
    const analysis = analyzeResume(resume, jobDescription);
    const applicationPackage = generateApplicationPackage(resume, jobDescription, analysis);

    expect(applicationPackage.companyName).toBe('Acme Health');
    expect(applicationPackage.riskFlags.join(' ')).toContain('Automation');
    expect(applicationPackage.workflow[0].detail).toContain('Automation');
    expect(applicationPackage.trackerFields).toContainEqual({
      label: 'Company',
      value: 'Acme Health',
    });
  });
});
