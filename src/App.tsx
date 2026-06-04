import { type CSSProperties, type ChangeEvent, useMemo, useState } from 'react';
import { generateApplicationPackage } from './applicationAgent';
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
          The dashboard compares JD keywords, ATS formatting, resume structure, and measurable impact. The agents then
          create an ATS-friendly resume draft and a job application packet you can refine before applying.
        </p>
      </div>
    </section>
  );
}

function App() {
  const [resume, setResume] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [copyStatus, setCopyStatus] = useState('Copy resume');
  const [copyPackageStatus, setCopyPackageStatus] = useState('Copy packet');
  const analysis = useMemo(() => analyzeResume(resume, jobDescription), [resume, jobDescription]);
  const applicationPackage = useMemo(
    () => generateApplicationPackage(resume, jobDescription, analysis),
    [analysis, jobDescription, resume],
  );
  const hasAnalysis = Boolean(resume.trim() && jobDescription.trim());

  const loadSample = () => {
    setResume(sampleResume);
    setJobDescription(sampleJobDescription);
    setCopyStatus('Copy resume');
    setCopyPackageStatus('Copy packet');
  };

  const resetDashboard = () => {
    setResume('');
    setJobDescription('');
    setCopyStatus('Copy resume');
    setCopyPackageStatus('Copy packet');
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
      setCopyPackageStatus('Copy packet');
    };
    reader.readAsText(file);
  };

  const downloadTextFile = (content: string, filename: string) => {
    if (!content) {
      return;
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const copyWithFallback = async (content: string) => {
    if (navigator.clipboard?.writeText) {
      try {
        await Promise.race([
          navigator.clipboard.writeText(content),
          new Promise<never>((_, reject) =>
            window.setTimeout(() => reject(new Error('Clipboard write timed out')), 600),
          ),
        ]);
        return;
      } catch {
        // Fall through to the text selection copy path.
      }
    }

    const textarea = document.createElement('textarea');
    textarea.value = content;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();

    try {
      if (document.execCommand('copy')) {
        return;
      }
    } finally {
      document.body.removeChild(textarea);
    }

    throw new Error('Clipboard is unavailable');
  };

  const copyText = async (content: string, setStatus: (status: string) => void, resetLabel: string) => {
    if (!content) {
      return;
    }

    setStatus('Copying...');

    try {
      await copyWithFallback(content);
      setStatus('Copied');
    } catch {
      setStatus('Copy failed');
    }

    window.setTimeout(() => setStatus(resetLabel), 4000);
  };

  const copyRewrite = () => copyText(analysis.rewrittenResume, setCopyStatus, 'Copy resume');

  const downloadRewrite = () => {
    downloadTextFile(analysis.rewrittenResume, 'ats-friendly-resume.txt');
  };

  const copyApplicationPackage = () =>
    copyText(applicationPackage.exportText, setCopyPackageStatus, 'Copy packet');

  const downloadApplicationPackage = () => {
    downloadTextFile(applicationPackage.exportText, 'job-application-package.txt');
  };

  return (
    <main className="app-shell">
      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">Job Application Agent</p>
          <h1>Automate your job application prep.</h1>
          <p>
            Upload or paste your resume, add the JD, and get an instant match score, ATS readiness report, missing
            keywords, a tailored resume draft, cover letter, recruiter message, and application workflow.
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
      </section>

      {!hasAnalysis ? (
        <EmptyState />
      ) : (
        <>
          <section className="metrics-grid" aria-label="Resume analysis metrics">
            <MetricCard label="Overall score" value={`${analysis.score}/100`} helper="Weighted resume-to-JD match" />
            <MetricCard label="Keyword coverage" value={`${analysis.keywordCoverage}%`} helper="JD terms found in resume" />
            <MetricCard label="ATS readiness" value={`${analysis.atsReadiness}%`} helper="Formatting and parser safety" />
            <MetricCard
              label="Apply readiness"
              value={`${applicationPackage.readinessScore}/100`}
              helper={applicationPackage.readinessLabel}
            />
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

          <section className="dashboard-grid application-agent-grid" aria-label="Job application automation agent">
            <article className="analysis-card wide-card agent-card">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Application automation agent</p>
                  <h2>{applicationPackage.roleTitle}</h2>
                </div>
                <div className="button-row">
                  <button className="ghost-button compact" onClick={copyApplicationPackage} type="button">
                    {copyPackageStatus}
                  </button>
                  <button className="primary-button compact" onClick={downloadApplicationPackage} type="button">
                    Download packet
                  </button>
                </div>
              </div>
              <p className="lead-text">
                The agent turns your resume analysis into a human-reviewed application workflow for{' '}
                {applicationPackage.companyName}. Use it to tailor materials, prepare answers, track submissions, and
                follow up without losing context.
              </p>
              <div className="agent-summary-grid">
                <div className="readiness-meter">
                  <span>Apply readiness</span>
                  <strong>{applicationPackage.readinessScore}/100</strong>
                  <p>{applicationPackage.readinessLabel}</p>
                </div>
                <div>
                  <h3>Risks to fix first</h3>
                  <ul className="insight-list compact-list">
                    {applicationPackage.riskFlags.map((risk) => (
                      <li key={risk}>{risk}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3>Tracker setup</h3>
                  <div className="tracker-grid">
                    {applicationPackage.trackerFields.slice(0, 6).map((field) => (
                      <div className="tracker-field" key={field.label}>
                        <span>{field.label}</span>
                        <strong>{field.value}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </article>

            <article className="analysis-card">
              <div className="panel-heading">
                <h2>Workflow checklist</h2>
              </div>
              <div className="workflow-list">
                {applicationPackage.workflow.map((step) => (
                  <div className="workflow-step" key={step.title}>
                    <span>{step.priority}</span>
                    <strong>{step.title}</strong>
                    <p>{step.detail}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="analysis-card">
              <div className="panel-heading">
                <h2>Application answer bank</h2>
              </div>
              <div className="answer-list">
                {applicationPackage.applicationAnswers.map((answer) => (
                  <div className="answer-card" key={answer.question}>
                    <strong>{answer.question}</strong>
                    <p>{answer.answer}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="analysis-card wide-card">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Outreach</p>
                  <h2>Cover letter and follow-up copy</h2>
                </div>
              </div>
              <div className="message-grid">
                <label className="message-card">
                  Cover letter draft
                  <textarea aria-label="Generated cover letter" readOnly value={applicationPackage.coverLetter} />
                </label>
                <label className="message-card">
                  Recruiter message
                  <textarea
                    aria-label="Generated recruiter message"
                    className="small-textarea"
                    readOnly
                    value={applicationPackage.recruiterMessage}
                  />
                </label>
              </div>
              <div className="follow-up-grid">
                {applicationPackage.followUpPlan.map((touchpoint) => (
                  <div className="follow-up-card" key={touchpoint.timing}>
                    <span>{touchpoint.timing}</span>
                    <p>{touchpoint.message}</p>
                  </div>
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
