import { ChangeEvent, CSSProperties, useMemo, useState } from 'react';
import {
  buildApplicationPackage,
  emptyCandidateProfile,
  sampleCandidateProfile,
  type CandidateProfile,
} from './applicationAgent';
import { analyzeResume, sampleJobDescription, sampleResume } from './resumeAgent';

const sectionLabels = {
  summary: 'Summary',
  experience: 'Experience',
  skills: 'Skills',
  education: 'Education',
  projects: 'Projects',
  certifications: 'Certifications',
};

const severityLabel = {
  major: 'High priority',
  moderate: 'Medium priority',
  minor: 'Low priority',
};

function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{helper}</p>
    </article>
  );
}

function KeywordList({ title, keywords, tone }: { title: string; keywords: string[]; tone: 'good' | 'warning' }) {
  return (
    <div className="keyword-panel">
      <div className="panel-heading">
        <h3>{title}</h3>
        <span>{keywords.length}</span>
      </div>
      <div className="keyword-cloud">
        {keywords.length ? (
          keywords.map((keyword) => (
            <span className={`chip ${tone}`} key={keyword}>
              {keyword}
            </span>
          ))
        ) : (
          <p className="muted">No keywords to show yet.</p>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <section className="empty-state">
      <div>
        <p className="eyebrow">Ready when you are</p>
        <h2>Paste a resume and job description to generate your match score.</h2>
        <p>
          The dashboard compares JD keywords, ATS formatting, resume structure, and measurable impact. The rewrite
          agent then creates an ATS-friendly draft you can refine before applying.
        </p>
      </div>
    </section>
  );
}

const writeClipboardText = async (value: string) => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return;
    }
  } catch {
    // Fall back to a temporary textarea below when the Clipboard API is blocked.
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);

  if (!copied) {
    throw new Error('Clipboard copy failed');
  }
};

const copyAndConfirm = (value: string, setStatus: (status: string) => void) => {
  setStatus('Copied');
  void writeClipboardText(value).catch(() => undefined);
};

function App() {
  const [resume, setResume] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [candidateProfile, setCandidateProfile] = useState<CandidateProfile>(emptyCandidateProfile);
  const [copyStatus, setCopyStatus] = useState('Copy resume');
  const [coverCopyStatus, setCoverCopyStatus] = useState('Copy cover letter');
  const [answersCopyStatus, setAnswersCopyStatus] = useState('Copy answers');
  const analysis = useMemo(() => analyzeResume(resume, jobDescription), [resume, jobDescription]);
  const hasAnalysis = Boolean(resume.trim() && jobDescription.trim());
  const applicationPackage = useMemo(
    () =>
      hasAnalysis
        ? buildApplicationPackage({
            analysis,
            candidateProfile,
            companyName,
            jobDescription,
            jobUrl,
          })
        : null,
    [analysis, candidateProfile, companyName, hasAnalysis, jobDescription, jobUrl],
  );

  const loadSample = () => {
    setResume(sampleResume);
    setJobDescription(sampleJobDescription);
    setCompanyName('BrightApps');
    setJobUrl('https://jobs.example.com/frontend-engineer');
    setCandidateProfile(sampleCandidateProfile);
    setCopyStatus('Copy resume');
    setCoverCopyStatus('Copy cover letter');
    setAnswersCopyStatus('Copy answers');
  };

  const resetDashboard = () => {
    setResume('');
    setJobDescription('');
    setCompanyName('');
    setJobUrl('');
    setCandidateProfile(emptyCandidateProfile);
    setCopyStatus('Copy resume');
    setCoverCopyStatus('Copy cover letter');
    setAnswersCopyStatus('Copy answers');
  };

  const updateProfile = (field: keyof CandidateProfile, value: string) => {
    setCandidateProfile((currentProfile) => ({
      ...currentProfile,
      [field]: value,
    }));
  };

  const handleResumeUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setResume(String(reader.result ?? ''));
      setCopyStatus('Copy resume');
    };
    reader.readAsText(file);
  };

  const copyRewrite = async () => {
    if (!analysis.rewrittenResume) {
      return;
    }

    copyAndConfirm(analysis.rewrittenResume, setCopyStatus);
  };

  const copyCoverLetter = async () => {
    if (!applicationPackage) {
      return;
    }

    copyAndConfirm(applicationPackage.coverLetter, setCoverCopyStatus);
  };

  const copyFormAnswers = async () => {
    if (!applicationPackage) {
      return;
    }

    const answerText = applicationPackage.suggestedFormAnswers
      .map(([label, value]) => `${label}: ${value}`)
      .join('\n');
    copyAndConfirm(answerText, setAnswersCopyStatus);
  };

  const downloadRewrite = () => {
    if (!analysis.rewrittenResume) {
      return;
    }

    const blob = new Blob([analysis.rewrittenResume], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ats-friendly-resume.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="app-shell">
      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">AI Job Application Agent</p>
          <h1>Automate your job application prep.</h1>
          <p>
            Upload or paste your resume, add the JD, and get an instant match score, ATS-safe resume draft, application
            checklist, form answers, cover letter, recruiter message, and follow-up plan.
          </p>
          <div className="hero-actions">
            <button className="primary-button" onClick={loadSample} type="button">
              Try sample analysis
            </button>
            <button className="ghost-button" onClick={resetDashboard} type="button">
              Clear dashboard
            </button>
          </div>
        </div>
        <div className="score-hero-card" aria-label="Resume score preview">
          <div className="score-ring" style={{ '--score': `${analysis.score * 3.6}deg` } as CSSProperties}>
            <span>{hasAnalysis ? analysis.score : 0}</span>
          </div>
          <div>
            <span className="score-label">Resume match</span>
            <strong>{hasAnalysis ? analysis.grade : 'N/A'}</strong>
            <p>{analysis.summary}</p>
          </div>
        </div>
      </section>

      <section className="input-grid" aria-label="Resume and job description inputs">
        <article className="input-card">
          <div className="card-title-row">
            <div>
              <p className="eyebrow">Step 1</p>
              <h2>Your resume</h2>
            </div>
            <label className="upload-button">
              Upload .txt
              <input accept=".txt,.md,.text" onChange={handleResumeUpload} type="file" />
            </label>
          </div>
          <textarea
            aria-label="Resume text"
            onChange={(event) => setResume(event.target.value)}
            placeholder="Paste your resume text here..."
            value={resume}
          />
        </article>

        <article className="input-card">
          <div className="card-title-row">
            <div>
              <p className="eyebrow">Step 2</p>
              <h2>Target job description</h2>
            </div>
          </div>
          <textarea
            aria-label="Job description text"
            onChange={(event) => setJobDescription(event.target.value)}
            placeholder="Paste the full job description here..."
            value={jobDescription}
          />
        </article>

        <article className="input-card application-input-card">
          <div className="card-title-row">
            <div>
              <p className="eyebrow">Step 3</p>
              <h2>Application details</h2>
            </div>
          </div>
          <div className="form-grid">
            <label className="field-group">
              <span>Company</span>
              <input
                onChange={(event) => setCompanyName(event.target.value)}
                placeholder="Company name"
                type="text"
                value={companyName}
              />
            </label>
            <label className="field-group">
              <span>Job URL</span>
              <input
                onChange={(event) => setJobUrl(event.target.value)}
                placeholder="https://..."
                type="url"
                value={jobUrl}
              />
            </label>
            <label className="field-group">
              <span>Full name</span>
              <input
                onChange={(event) => updateProfile('fullName', event.target.value)}
                placeholder="Your name"
                type="text"
                value={candidateProfile.fullName}
              />
            </label>
            <label className="field-group">
              <span>Email</span>
              <input
                onChange={(event) => updateProfile('email', event.target.value)}
                placeholder="you@example.com"
                type="email"
                value={candidateProfile.email}
              />
            </label>
            <label className="field-group">
              <span>Phone</span>
              <input
                onChange={(event) => updateProfile('phone', event.target.value)}
                placeholder="Phone number"
                type="tel"
                value={candidateProfile.phone}
              />
            </label>
            <label className="field-group">
              <span>Location</span>
              <input
                onChange={(event) => updateProfile('location', event.target.value)}
                placeholder="City, State"
                type="text"
                value={candidateProfile.location}
              />
            </label>
            <label className="field-group">
              <span>LinkedIn</span>
              <input
                onChange={(event) => updateProfile('linkedin', event.target.value)}
                placeholder="https://linkedin.com/in/..."
                type="url"
                value={candidateProfile.linkedin}
              />
            </label>
            <label className="field-group">
              <span>Portfolio</span>
              <input
                onChange={(event) => updateProfile('portfolio', event.target.value)}
                placeholder="https://github.com/..."
                type="url"
                value={candidateProfile.portfolio}
              />
            </label>
            <label className="field-group">
              <span>Work authorization</span>
              <input
                onChange={(event) => updateProfile('workAuthorization', event.target.value)}
                placeholder="Authorized to work in..."
                type="text"
                value={candidateProfile.workAuthorization}
              />
            </label>
            <label className="field-group">
              <span>Sponsorship</span>
              <input
                onChange={(event) => updateProfile('sponsorship', event.target.value)}
                placeholder="No sponsorship required"
                type="text"
                value={candidateProfile.sponsorship}
              />
            </label>
            <label className="field-group">
              <span>Salary expectations</span>
              <input
                onChange={(event) => updateProfile('salaryExpectation', event.target.value)}
                placeholder="Flexible based on role scope"
                type="text"
                value={candidateProfile.salaryExpectation}
              />
            </label>
            <label className="field-group">
              <span>Notice period</span>
              <input
                onChange={(event) => updateProfile('noticePeriod', event.target.value)}
                placeholder="Two weeks"
                type="text"
                value={candidateProfile.noticePeriod}
              />
            </label>
          </div>
        </article>
      </section>

      {!hasAnalysis ? (
        <EmptyState />
      ) : (
        <>
          <section className="metrics-grid" aria-label="Resume analysis metrics">
            <MetricCard label="Overall score" value={`${analysis.score}/100`} helper="Weighted resume-to-JD match" />
            <MetricCard label="Keyword coverage" value={`${analysis.keywordCoverage}%`} helper="JD terms found in resume" />
            <MetricCard label="ATS readiness" value={`${analysis.atsReadiness}%`} helper="Formatting and parser safety" />
            <MetricCard label="Missing keywords" value={`${analysis.missingKeywords.length}`} helper="Terms to add truthfully" />
            <MetricCard
              label="Application readiness"
              value={`${applicationPackage?.readinessScore ?? 0}/100`}
              helper={applicationPackage?.recommendation ?? 'Complete the inputs'}
            />
          </section>

          <section className="dashboard-grid">
            <article className="analysis-card wide-card">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Dashboard</p>
                  <h2>Match insights</h2>
                </div>
                <span className="status-pill">Grade {analysis.grade}</span>
              </div>
              <p className="lead-text">{analysis.summary}</p>
              <div className="section-checklist">
                {Object.entries(analysis.sections).map(([section, exists]) => (
                  <span className={exists ? 'section-pill found' : 'section-pill missing'} key={section}>
                    {exists ? 'Found' : 'Add'} {sectionLabels[section as keyof typeof sectionLabels]}
                  </span>
                ))}
              </div>
            </article>

            <article className="analysis-card">
              <div className="panel-heading">
                <h2>Top strengths</h2>
              </div>
              <ul className="insight-list">
                {analysis.strengths.map((strength) => (
                  <li key={strength}>{strength}</li>
                ))}
              </ul>
            </article>

            <article className="analysis-card">
              <div className="panel-heading">
                <h2>Action plan</h2>
              </div>
              <ul className="insight-list numbered">
                {analysis.improvements.map((improvement) => (
                  <li key={improvement}>{improvement}</li>
                ))}
              </ul>
            </article>
          </section>

          <section className="keyword-grid" aria-label="Keyword comparison">
            <KeywordList title="Matched JD keywords" keywords={analysis.matchedKeywords} tone="good" />
            <KeywordList title="Missing JD keywords" keywords={analysis.missingKeywords} tone="warning" />
          </section>

          <section className="dashboard-grid">
            <article className="analysis-card">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">ATS scan</p>
                  <h2>Parser safety checks</h2>
                </div>
                <span className="status-pill">{analysis.atsIssues.length} findings</span>
              </div>
              {analysis.atsIssues.length ? (
                <div className="issue-list">
                  {analysis.atsIssues.map((issue) => (
                    <div className={`issue ${issue.severity}`} key={issue.title}>
                      <span>{severityLabel[issue.severity]}</span>
                      <strong>{issue.title}</strong>
                      <p>{issue.detail}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">No major ATS issues detected. Keep the resume in a simple single-column format.</p>
              )}
            </article>

            <article className="analysis-card rewrite-card">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Resume rewrite agent</p>
                  <h2>ATS-friendly draft</h2>
                </div>
                <div className="button-row">
                  <button className="ghost-button compact" onClick={copyRewrite} type="button">
                    {copyStatus}
                  </button>
                  <button className="primary-button compact" onClick={downloadRewrite} type="button">
                    Download
                  </button>
                </div>
              </div>
              <textarea aria-label="ATS-friendly rewritten resume" readOnly value={analysis.rewrittenResume} />
            </article>
          </section>

          {applicationPackage ? (
            <section className="dashboard-grid" aria-label="Job application automation package">
              <article className="analysis-card wide-card application-agent-card">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Application automation agent</p>
                    <h2>
                      {applicationPackage.roleTitle} at {applicationPackage.company}
                    </h2>
                  </div>
                  <span className="status-pill">{applicationPackage.recommendation}</span>
                </div>

                <div className="application-summary-grid">
                  <div>
                    <span className="score-label">Readiness</span>
                    <strong>{applicationPackage.readinessScore}/100</strong>
                    <p>{applicationPackage.tracker.nextAction}</p>
                  </div>
                  <div>
                    <span className="score-label">Tracker stage</span>
                    <strong>{applicationPackage.tracker.stage}</strong>
                    <p>{applicationPackage.tracker.resumeVersion}</p>
                  </div>
                  <div>
                    <span className="score-label">Profile gaps</span>
                    <strong>{applicationPackage.missingProfileFields.length}</strong>
                    <p>
                      {applicationPackage.missingProfileFields.length
                        ? applicationPackage.missingProfileFields.join(', ')
                        : 'Candidate profile is ready.'}
                    </p>
                  </div>
                </div>

                <div className="application-grid">
                  <div className="agent-panel">
                    <div className="panel-heading compact-heading">
                      <h3>Apply checklist</h3>
                    </div>
                    <div className="checklist">
                      {applicationPackage.checklist.map((item) => (
                        <div className={`checklist-item ${item.status}`} key={item.task}>
                          <span>{item.status}</span>
                          <strong>{item.task}</strong>
                          <p>{item.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="agent-panel">
                    <div className="panel-heading compact-heading">
                      <h3>Application form answers</h3>
                      <button className="ghost-button compact" onClick={copyFormAnswers} type="button">
                        {answersCopyStatus}
                      </button>
                    </div>
                    <dl className="answer-list">
                      {applicationPackage.suggestedFormAnswers.map(([label, value]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>

                  <div className="agent-panel">
                    <div className="panel-heading compact-heading">
                      <h3>Cover letter draft</h3>
                      <button className="ghost-button compact" onClick={copyCoverLetter} type="button">
                        {coverCopyStatus}
                      </button>
                    </div>
                    <textarea aria-label="Generated cover letter" readOnly value={applicationPackage.coverLetter} />
                  </div>

                  <div className="agent-panel">
                    <div className="panel-heading compact-heading">
                      <h3>Recruiter message and follow-up</h3>
                    </div>
                    <p className="recruiter-message">{applicationPackage.recruiterMessage}</p>
                    <ol className="follow-up-list">
                      {applicationPackage.followUpPlan.map((item) => (
                        <li key={item.when}>
                          <strong>{item.when}</strong>
                          <span>{item.action}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </article>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}

export default App;
