import { ChangeEvent, useMemo, useState } from 'react';
import { createJobApplicationPlan, type JobApplicationPlan } from './applicationAgent';
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

function ConfidenceBadge({ confidence }: { confidence: 'ready' | 'review' | 'missing' }) {
  const label = confidence === 'ready' ? 'Ready' : confidence === 'review' ? 'Review' : 'Missing';

  return <span className={`confidence-badge ${confidence}`}>{label}</span>;
}

function JobApplicationAgentPanel({
  kitCopyStatus,
  onCopyKit,
  onDownloadKit,
  onDownloadTracker,
  plan,
}: {
  kitCopyStatus: string;
  onCopyKit: () => void;
  onDownloadKit: () => void;
  onDownloadTracker: () => void;
  plan: JobApplicationPlan;
}) {
  return (
    <section className="application-agent" aria-label="Job application automation agent">
      <article className="analysis-card agent-summary-card">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Job application automation agent</p>
            <h2>{plan.roleTitle}</h2>
          </div>
          <span className={`readiness-pill ${plan.readiness.toLowerCase().replace(/\s+/g, '-')}`}>
            {plan.readiness}
          </span>
        </div>
        <div className="agent-score-row">
          <div className="priority-score">
            <span>{plan.priorityScore}</span>
            <small>priority score</small>
          </div>
          <div>
            <strong>{plan.companyName}</strong>
            <p>{plan.summary}</p>
          </div>
        </div>
        <div className="button-row">
          <button className="primary-button compact" onClick={onCopyKit} type="button">
            {kitCopyStatus}
          </button>
          <button className="ghost-button compact" onClick={onDownloadKit} type="button">
            Download kit
          </button>
          <button className="ghost-button compact" onClick={onDownloadTracker} type="button">
            Download tracker CSV
          </button>
        </div>
      </article>

      <article className="analysis-card">
        <div className="panel-heading">
          <h2>Application workflow</h2>
          <span className="status-pill">{plan.steps.length} steps</span>
        </div>
        <ol className="agent-step-list">
          {plan.steps.map((step) => (
            <li key={step.title}>
              <strong>{step.title}</strong>
              <p>{step.detail}</p>
              <span>{step.automationTip}</span>
            </li>
          ))}
        </ol>
      </article>

      <article className="analysis-card">
        <div className="panel-heading">
          <h2>Autofill profile</h2>
          <span className="status-pill">Verify before use</span>
        </div>
        <div className="profile-field-grid">
          {plan.profileFields.map((field) => (
            <div className="profile-field" key={field.label}>
              <div>
                <span>{field.label}</span>
                <strong>{field.value}</strong>
              </div>
              <ConfidenceBadge confidence={field.confidence} />
            </div>
          ))}
        </div>
      </article>

      <article className="analysis-card">
        <div className="panel-heading">
          <h2>Document checklist</h2>
        </div>
        <ul className="insight-list">
          {plan.documents.map((document) => (
            <li key={document}>{document}</li>
          ))}
        </ul>
      </article>

      <article className="analysis-card draft-card">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Generated draft</p>
            <h2>Cover letter</h2>
          </div>
        </div>
        <textarea aria-label="Generated cover letter" readOnly value={plan.drafts.coverLetter} />
      </article>

      <article className="analysis-card draft-card">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Generated draft</p>
            <h2>Outreach messages</h2>
          </div>
        </div>
        <label>
          Recruiter message
          <textarea aria-label="Recruiter outreach message" readOnly value={plan.drafts.recruiterMessage} />
        </label>
        <label>
          Follow-up message
          <textarea aria-label="Application follow-up message" readOnly value={plan.drafts.followUpMessage} />
        </label>
      </article>
    </section>
  );
}

function App() {
  const [resume, setResume] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [copyStatus, setCopyStatus] = useState('Copy resume');
  const [kitCopyStatus, setKitCopyStatus] = useState('Copy kit');
  const analysis = useMemo(() => analyzeResume(resume, jobDescription), [resume, jobDescription]);
  const hasAnalysis = Boolean(resume.trim() && jobDescription.trim());
  const applicationPlan = useMemo(
    () => (hasAnalysis ? createJobApplicationPlan(resume, jobDescription, analysis) : null),
    [analysis, hasAnalysis, jobDescription, resume],
  );

  const loadSample = () => {
    setResume(sampleResume);
    setJobDescription(sampleJobDescription);
    setCopyStatus('Copy resume');
    setKitCopyStatus('Copy kit');
  };

  const resetDashboard = () => {
    setResume('');
    setJobDescription('');
    setCopyStatus('Copy resume');
    setKitCopyStatus('Copy kit');
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
      setKitCopyStatus('Copy kit');
    };
    reader.readAsText(file);
  };

  const downloadTextFile = (filename: string, content: string, type = 'text/plain;charset=utf-8') => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const writeClipboardText = async (content: string) => {
    const clipboardTimeout = new Promise<false>((resolve) => {
      window.setTimeout(() => resolve(false), 600);
    });

    if (navigator.clipboard?.writeText && window.isSecureContext) {
      try {
        const copied = await Promise.race([
          navigator.clipboard.writeText(content).then(() => true),
          clipboardTimeout,
        ]);
        if (copied) {
          return true;
        }
      } catch {
        // Fall back to the legacy copy command below when browser permissions block the Clipboard API.
      }
    }

    const textArea = document.createElement('textarea');
    textArea.value = content;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const copied = document.execCommand('copy');
      if (copied) {
        return true;
      }
    } catch {
      // Return false below so the button can show an explicit failure state.
    } finally {
      document.body.removeChild(textArea);
    }

    return false;
  };

  const copyRewrite = async () => {
    if (!analysis.rewrittenResume) {
      return;
    }

    setCopyStatus('Copying...');
    const copied = await writeClipboardText(analysis.rewrittenResume);
    setCopyStatus(copied ? 'Copied' : 'Copy failed');
    window.setTimeout(() => setCopyStatus('Copy resume'), 1800);
  };

  const downloadRewrite = () => {
    if (!analysis.rewrittenResume) {
      return;
    }

    downloadTextFile('ats-friendly-resume.txt', analysis.rewrittenResume);
  };

  const copyApplicationKit = async () => {
    if (!applicationPlan) {
      return;
    }

    setKitCopyStatus('Copying...');
    const copied = await writeClipboardText(applicationPlan.applicationKit);
    setKitCopyStatus(copied ? 'Copied' : 'Copy failed');
    window.setTimeout(() => setKitCopyStatus('Copy kit'), 1800);
  };

  const downloadApplicationKit = () => {
    if (!applicationPlan) {
      return;
    }

    downloadTextFile('job-application-kit.txt', applicationPlan.applicationKit);
  };

  const downloadTracker = () => {
    if (!applicationPlan) {
      return;
    }

    downloadTextFile('job-application-tracker.csv', applicationPlan.tracker.csv, 'text/csv;charset=utf-8');
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
            onChange={(event) => {
              setResume(event.target.value);
              setKitCopyStatus('Copy kit');
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
              setKitCopyStatus('Copy kit');
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

          {applicationPlan ? (
            <JobApplicationAgentPanel
              kitCopyStatus={kitCopyStatus}
              onCopyKit={copyApplicationKit}
              onDownloadKit={downloadApplicationKit}
              onDownloadTracker={downloadTracker}
              plan={applicationPlan}
            />
          ) : null}
        </>
      )}
    </main>
  );
}

export default App;
