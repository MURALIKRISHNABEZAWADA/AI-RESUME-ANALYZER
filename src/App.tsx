import { ChangeEvent, useMemo, useState } from 'react';
import { buildJobApplicationPlan } from './jobApplicationAgent';
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

const writeToClipboard = async (content: string) => {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(content);
      return true;
    }
  } catch {
    // Fall through to the textarea copy path for browsers that block Clipboard API calls.
  }

  const textarea = document.createElement('textarea');
  textarea.value = content;
  textarea.setAttribute('readonly', '');
  textarea.style.left = '-9999px';
  textarea.style.position = 'fixed';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    return document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
  }
};

function App() {
  const [resume, setResume] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [copyStatus, setCopyStatus] = useState('Copy resume');
  const [applicationCopyStatus, setApplicationCopyStatus] = useState('Copy kit');
  const analysis = useMemo(() => analyzeResume(resume, jobDescription), [resume, jobDescription]);
  const applicationPlan = useMemo(
    () => buildJobApplicationPlan(resume, jobDescription, analysis),
    [analysis, jobDescription, resume],
  );
  const hasAnalysis = Boolean(resume.trim() && jobDescription.trim());

  const loadSample = () => {
    setResume(sampleResume);
    setJobDescription(sampleJobDescription);
    setCopyStatus('Copy resume');
    setApplicationCopyStatus('Copy kit');
  };

  const resetDashboard = () => {
    setResume('');
    setJobDescription('');
    setCopyStatus('Copy resume');
    setApplicationCopyStatus('Copy kit');
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
      setApplicationCopyStatus('Copy kit');
    };
    reader.readAsText(file);
  };

  const copyRewrite = async () => {
    if (!analysis.rewrittenResume) {
      return;
    }

    const copied = await writeToClipboard(analysis.rewrittenResume);
    setCopyStatus(copied ? 'Copied' : 'Copy unavailable');
    window.setTimeout(() => setCopyStatus('Copy resume'), 1800);
  };

  const copyApplicationKit = async () => {
    if (!applicationPlan.applicationKit) {
      return;
    }

    const copied = await writeToClipboard(applicationPlan.applicationKit);
    setApplicationCopyStatus(copied ? 'Copied' : 'Copy unavailable');
    window.setTimeout(() => setApplicationCopyStatus('Copy kit'), 1800);
  };

  const downloadText = (content: string, filename: string, type = 'text/plain;charset=utf-8') => {
    if (!content) {
      return;
    }

    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadRewrite = () => downloadText(analysis.rewrittenResume, 'ats-friendly-resume.txt');
  const downloadApplicationKit = () => downloadText(applicationPlan.applicationKit, 'job-application-automation-kit.md', 'text/markdown;charset=utf-8');
  const downloadTracker = () => downloadText(applicationPlan.trackerCsv, 'job-application-tracker.csv', 'text/csv;charset=utf-8');

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
            onChange={(event) => {
              setResume(event.target.value);
              setApplicationCopyStatus('Copy kit');
            }}
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
            onChange={(event) => {
              setJobDescription(event.target.value);
              setApplicationCopyStatus('Copy kit');
            }}
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

          <section className="analysis-card automation-card wide-card" aria-label="Job application automation agent">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Job application automation agent</p>
                <h2>Application workflow and outreach kit</h2>
              </div>
              <div className="button-row">
                <button className="ghost-button compact" onClick={copyApplicationKit} type="button">
                  {applicationCopyStatus}
                </button>
                <button className="primary-button compact" onClick={downloadApplicationKit} type="button">
                  Download kit
                </button>
                <button className="ghost-button compact" onClick={downloadTracker} type="button">
                  Tracker CSV
                </button>
              </div>
            </div>

            <div className="automation-summary">
              <div className="readiness-card">
                <span>Application readiness</span>
                <strong>{applicationPlan.readinessScore}/100</strong>
                <p>{applicationPlan.fitLabel}</p>
              </div>
              <div>
                <p className="lead-text">{applicationPlan.summary}</p>
                <div className="target-role-grid">
                  <span>
                    <strong>Role</strong>
                    {applicationPlan.targetRole}
                  </span>
                  <span>
                    <strong>Company</strong>
                    {applicationPlan.targetCompany}
                  </span>
                </div>
              </div>
            </div>

            <div className="workflow-list">
              {applicationPlan.workflow.map((task) => (
                <article className={`workflow-step ${task.priority}`} key={`${task.stage}-${task.title}`}>
                  <div>
                    <span>{task.stage}</span>
                    <strong>{task.title}</strong>
                  </div>
                  <p>{task.detail}</p>
                  <p className="automation-prompt">{task.automationPrompt}</p>
                  <small>Done when: {task.doneWhen}</small>
                </article>
              ))}
            </div>

            <div className="kit-grid">
              <article className="artifact-preview">
                <div className="panel-heading">
                  <h3>Cover letter draft</h3>
                </div>
                <textarea aria-label="Generated cover letter draft" readOnly value={applicationPlan.coverLetter} />
              </article>

              <article className="artifact-preview">
                <div className="panel-heading">
                  <h3>Outreach and follow-up</h3>
                </div>
                <div className="text-preview">
                  <strong>Recruiter message</strong>
                  <p>{applicationPlan.recruiterMessage}</p>
                  <strong>Follow-up email</strong>
                  <pre>{applicationPlan.followUpEmail}</pre>
                </div>
              </article>
            </div>

            <div className="kit-grid">
              <article className="artifact-preview">
                <div className="panel-heading">
                  <h3>Screening answer starters</h3>
                </div>
                <ul className="insight-list">
                  {applicationPlan.screeningAnswers.map((answer) => (
                    <li key={answer}>{answer}</li>
                  ))}
                </ul>
              </article>

              <article className="artifact-preview">
                <div className="panel-heading">
                  <h3>Application tracker row</h3>
                </div>
                <div className="tracker-table">
                  {applicationPlan.trackerRows.map((row) => (
                    <div key={row.field}>
                      <strong>{row.field}</strong>
                      <span>{row.value}</span>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

export default App;
