import { ChangeEvent, useMemo, useState } from 'react';
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
          and application agents then create an ATS-friendly draft, application checklist, outreach, and follow-up plan.
        </p>
      </div>
    </section>
  );
}

const copyTextWithFallback = (text: string) => {
  const fallbackInput = document.createElement('textarea');
  fallbackInput.value = text;
  fallbackInput.setAttribute('readonly', '');
  fallbackInput.style.left = '-9999px';
  fallbackInput.style.position = 'fixed';
  document.body.appendChild(fallbackInput);
  fallbackInput.select();
  document.execCommand('copy');
  document.body.removeChild(fallbackInput);
};

const copyTextToClipboard = (text: string) => {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => copyTextWithFallback(text));
    return;
  }

  copyTextWithFallback(text);
};

const buildApplicationKitText = (analysis: ReturnType<typeof analyzeResume>) => {
  const plan = analysis.applicationPlan;

  return [
    'JOB APPLICATION AUTOMATION KIT',
    '',
    `Status: ${plan.status}`,
    plan.fitSummary,
    '',
    'QUICK ACTIONS',
    ...plan.quickActions.map((action) => `- ${action}`),
    '',
    'CHECKLIST',
    ...plan.checklist.map((task) => `- [${task.priority}] ${task.title}: ${task.detail}`),
    '',
    'DOCUMENTS',
    ...plan.documents.map((document) => `- ${document}`),
    '',
    'COVER LETTER',
    plan.coverLetter,
    '',
    'RECRUITER MESSAGE',
    plan.recruiterMessage,
    '',
    'FOLLOW-UP SCHEDULE',
    ...plan.followUpSchedule.map((step) => `- ${step.timing}: ${step.action}. ${step.detail}`),
    '',
    'TRACKER FIELDS',
    plan.trackerFields.join(', '),
    '',
    'RISK FLAGS',
    ...(plan.riskFlags.length ? plan.riskFlags.map((risk) => `- ${risk}`) : ['- No major application risks detected.']),
  ].join('\n');
};

function App() {
  const [resume, setResume] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [copyStatus, setCopyStatus] = useState('Copy resume');
  const [coverLetterCopyStatus, setCoverLetterCopyStatus] = useState('Copy cover letter');
  const [outreachCopyStatus, setOutreachCopyStatus] = useState('Copy outreach');
  const analysis = useMemo(() => analyzeResume(resume, jobDescription), [resume, jobDescription]);
  const hasAnalysis = Boolean(resume.trim() && jobDescription.trim());

  const loadSample = () => {
    setResume(sampleResume);
    setJobDescription(sampleJobDescription);
    setCopyStatus('Copy resume');
    setCoverLetterCopyStatus('Copy cover letter');
    setOutreachCopyStatus('Copy outreach');
  };

  const resetDashboard = () => {
    setResume('');
    setJobDescription('');
    setCopyStatus('Copy resume');
    setCoverLetterCopyStatus('Copy cover letter');
    setOutreachCopyStatus('Copy outreach');
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
      setCoverLetterCopyStatus('Copy cover letter');
      setOutreachCopyStatus('Copy outreach');
    };
    reader.readAsText(file);
  };

  const copyRewrite = () => {
    if (!analysis.rewrittenResume) {
      return;
    }

    copyTextToClipboard(analysis.rewrittenResume);
    setCopyStatus('Copied');
    window.setTimeout(() => setCopyStatus('Copy resume'), 1800);
  };

  const copyCoverLetter = () => {
    if (!analysis.applicationPlan.coverLetter) {
      return;
    }

    copyTextToClipboard(analysis.applicationPlan.coverLetter);
    setCoverLetterCopyStatus('Copied');
    window.setTimeout(() => setCoverLetterCopyStatus('Copy cover letter'), 1800);
  };

  const copyOutreach = () => {
    if (!analysis.applicationPlan.recruiterMessage) {
      return;
    }

    copyTextToClipboard(analysis.applicationPlan.recruiterMessage);
    setOutreachCopyStatus('Copied');
    window.setTimeout(() => setOutreachCopyStatus('Copy outreach'), 1800);
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

  const downloadApplicationKit = () => {
    if (!hasAnalysis) {
      return;
    }

    const blob = new Blob([buildApplicationKitText(analysis)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'job-application-automation-kit.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="app-shell">
      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">AI Resume + Application Agent</p>
          <h1>Automate your job application prep.</h1>
          <p>
            Upload or paste your resume, add the JD, and get an instant match score, ATS readiness report, tailored
            resume draft, cover letter, recruiter outreach, follow-up cadence, and application tracker plan.
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
            <article className="analysis-card wide-card application-agent-card">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Application automation agent</p>
                  <h2>Submission readiness and next actions</h2>
                </div>
                <div className="button-row">
                  <span className="status-pill">{analysis.applicationPlan.status}</span>
                  <button className="primary-button compact" onClick={downloadApplicationKit} type="button">
                    Download kit
                  </button>
                </div>
              </div>
              <p className="lead-text">{analysis.applicationPlan.fitSummary}</p>
              <div className="quick-action-grid">
                {analysis.applicationPlan.quickActions.map((action) => (
                  <div className="quick-action" key={action}>
                    <span>Next</span>
                    <strong>{action}</strong>
                  </div>
                ))}
              </div>
              <div className="application-columns">
                <div>
                  <h3>Application checklist</h3>
                  <div className="task-list">
                    {analysis.applicationPlan.checklist.map((task) => (
                      <div className="task-item" key={task.title}>
                        <span>{task.priority}</span>
                        <strong>{task.title}</strong>
                        <p>{task.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3>Package to prepare</h3>
                  <ul className="insight-list">
                    {analysis.applicationPlan.documents.map((document) => (
                      <li key={document}>{document}</li>
                    ))}
                  </ul>
                  <h3 className="subsection-title">Risk flags</h3>
                  {analysis.applicationPlan.riskFlags.length ? (
                    <ul className="insight-list">
                      {analysis.applicationPlan.riskFlags.map((risk) => (
                        <li key={risk}>{risk}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">No major application risks detected.</p>
                  )}
                </div>
              </div>
            </article>
          </section>

          <section className="dashboard-grid">
            <article className="analysis-card message-card">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Application kit</p>
                  <h2>Cover letter draft</h2>
                </div>
                <button className="ghost-button compact" onClick={copyCoverLetter} type="button">
                  {coverLetterCopyStatus}
                </button>
              </div>
              <textarea aria-label="Generated cover letter" readOnly value={analysis.applicationPlan.coverLetter} />
            </article>

            <article className="analysis-card message-card">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Networking</p>
                  <h2>Recruiter outreach</h2>
                </div>
                <button className="ghost-button compact" onClick={copyOutreach} type="button">
                  {outreachCopyStatus}
                </button>
              </div>
              <textarea aria-label="Generated recruiter outreach message" readOnly value={analysis.applicationPlan.recruiterMessage} />
            </article>
          </section>

          <section className="dashboard-grid">
            <article className="analysis-card">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Follow-up agent</p>
                  <h2>Cadence after applying</h2>
                </div>
              </div>
              <div className="timeline-list">
                {analysis.applicationPlan.followUpSchedule.map((step) => (
                  <div className="timeline-step" key={step.timing}>
                    <span>{step.timing}</span>
                    <strong>{step.action}</strong>
                    <p>{step.detail}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="analysis-card">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Application tracker</p>
                  <h2>Fields to automate</h2>
                </div>
              </div>
              <div className="tracker-field-grid">
                {analysis.applicationPlan.trackerFields.map((field) => (
                  <span className="section-pill found" key={field}>
                    {field}
                  </span>
                ))}
              </div>
            </article>
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
        </>
      )}
    </main>
  );
}

export default App;
