import { ChangeEvent, useMemo, useState } from 'react';
import { buildJobApplicationPlan } from './applicationAgent';
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

const applicationStatusLabel = {
  ready: 'Ready',
  review: 'Review',
  missing: 'Missing',
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

function App() {
  const [resume, setResume] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [applicantNotes, setApplicantNotes] = useState('');
  const [copyStatus, setCopyStatus] = useState('Copy resume');
  const [applicationCopyStatus, setApplicationCopyStatus] = useState('Copy packet');
  const analysis = useMemo(() => analyzeResume(resume, jobDescription), [resume, jobDescription]);
  const hasAnalysis = Boolean(resume.trim() && jobDescription.trim());
  const applicationPlan = useMemo(
    () =>
      hasAnalysis
        ? buildJobApplicationPlan({
            resume,
            jobDescription,
            jobUrl,
            companyName,
            applicantNotes,
            analysis,
          })
        : null,
    [analysis, applicantNotes, companyName, hasAnalysis, jobDescription, jobUrl, resume],
  );

  const loadSample = () => {
    setResume(sampleResume);
    setJobDescription(sampleJobDescription);
    setJobUrl('https://careers.example.com/frontend-engineer');
    setCompanyName('Example Apps');
    setApplicantNotes('Available for frontend roles focused on accessibility, performance, and product collaboration.');
    setCopyStatus('Copy resume');
    setApplicationCopyStatus('Copy packet');
  };

  const resetDashboard = () => {
    setResume('');
    setJobDescription('');
    setJobUrl('');
    setCompanyName('');
    setApplicantNotes('');
    setCopyStatus('Copy resume');
    setApplicationCopyStatus('Copy packet');
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

    await navigator.clipboard.writeText(analysis.rewrittenResume);
    setCopyStatus('Copied');
    window.setTimeout(() => setCopyStatus('Copy resume'), 1800);
  };

  const copyApplicationPacket = async () => {
    if (!applicationPlan) {
      return;
    }

    await navigator.clipboard.writeText(applicationPlan.applicationPacket);
    setApplicationCopyStatus('Copied');
    window.setTimeout(() => setApplicationCopyStatus('Copy packet'), 1800);
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

  const downloadApplicationPacket = () => {
    if (!applicationPlan) {
      return;
    }

    const blob = new Blob([applicationPlan.applicationPacket], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'job-application-packet.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="app-shell">
      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">AI Resume Analyzer</p>
          <h1>Score your resume against any job description.</h1>
          <p>
            Upload or paste your resume, add the JD, and get an instant match score, ATS readiness report, missing
            keywords, and a clean resume rewrite draft tailored to the role.
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
          <div className="score-ring" style={{ '--score': `${analysis.score * 3.6}deg` } as React.CSSProperties}>
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

          {applicationPlan ? (
            <section className="analysis-card application-agent-card" aria-label="Job application automation agent">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Step 3</p>
                  <h2>Job application automation agent</h2>
                </div>
                <span className="status-pill">
                  {applicationPlan.readinessScore}/100 - {applicationPlan.status}
                </span>
              </div>

              <p className="lead-text">{applicationPlan.summary}</p>

              <div className="application-input-grid">
                <label>
                  <span>Job posting URL</span>
                  <input
                    className="text-input"
                    onChange={(event) => setJobUrl(event.target.value)}
                    placeholder="https://company.com/jobs/role"
                    type="url"
                    value={jobUrl}
                  />
                </label>
                <label>
                  <span>Company or portal</span>
                  <input
                    className="text-input"
                    onChange={(event) => setCompanyName(event.target.value)}
                    placeholder="Company name"
                    type="text"
                    value={companyName}
                  />
                </label>
                <label className="notes-field">
                  <span>Application notes</span>
                  <textarea
                    className="compact-textarea"
                    onChange={(event) => setApplicantNotes(event.target.value)}
                    placeholder="Add preferences, work authorization notes, salary range, availability, or recruiter context to include in drafts."
                    value={applicantNotes}
                  />
                </label>
              </div>

              <div className="application-grid">
                <article className="application-panel">
                  <div className="panel-heading compact-heading">
                    <h3>Readiness blockers</h3>
                    <span>{applicationPlan.blockers.length}</span>
                  </div>
                  {applicationPlan.blockers.length ? (
                    <div className="issue-list">
                      {applicationPlan.blockers.map((blocker) => (
                        <div className={`issue ${blocker.severity === 'high' ? 'major' : 'moderate'}`} key={blocker.title}>
                          <span>{blocker.severity} priority</span>
                          <strong>{blocker.title}</strong>
                          <p>{blocker.detail}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">No major blockers detected. Review everything once before submitting manually.</p>
                  )}
                </article>

                <article className="application-panel">
                  <div className="panel-heading compact-heading">
                    <h3>Agent checklist</h3>
                  </div>
                  <ol className="insight-list numbered">
                    {applicationPlan.steps.map((step) => (
                      <li key={step.title}>
                        <strong>{step.title}</strong>
                        <p>{step.detail}</p>
                      </li>
                    ))}
                  </ol>
                </article>

                <article className="application-panel wide-card">
                  <div className="panel-heading compact-heading">
                    <h3>Suggested application fields</h3>
                  </div>
                  <div className="field-suggestion-grid">
                    {applicationPlan.fieldChecklist.map((field) => (
                      <div className={`field-suggestion ${field.status}`} key={field.label}>
                        <span>{applicationStatusLabel[field.status]}</span>
                        <strong>{field.label}</strong>
                        <p>{field.suggestedValue}</p>
                        <small>Source: {field.source}</small>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="application-panel packet-panel">
                  <div className="panel-heading compact-heading">
                    <div>
                      <h3>Cover letter draft</h3>
                      <p className="muted">Review and personalize before sending.</p>
                    </div>
                    <div className="button-row">
                      <button className="ghost-button compact" onClick={copyApplicationPacket} type="button">
                        {applicationCopyStatus}
                      </button>
                      <button className="primary-button compact" onClick={downloadApplicationPacket} type="button">
                        Download packet
                      </button>
                    </div>
                  </div>
                  <textarea aria-label="Generated cover letter" readOnly value={applicationPlan.coverLetter} />
                </article>

                <article className="application-panel">
                  <div className="panel-heading compact-heading">
                    <h3>Recruiter message</h3>
                  </div>
                  <p className="lead-text">{applicationPlan.recruiterMessage}</p>
                  <p className="muted">
                    The agent prepares materials and checkpoints only. Keep final submission under your control.
                  </p>
                </article>
              </div>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}

export default App;
