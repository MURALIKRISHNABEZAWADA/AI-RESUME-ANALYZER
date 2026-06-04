import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ApplicantProfile,
  Job,
  applyToJob,
  generateResume,
  listJobs,
  scoreJob,
  scrapeJobs,
} from './jobApi';

const defaultResume = `Taylor Rivera
taylor.rivera@email.com | 555-0142 | linkedin.com/in/taylorrivera

Professional Summary
Data Scientist with 5+ years of experience building machine learning models, experimentation frameworks, and executive dashboards.

Skills
Python, SQL, machine learning, statistics, experimentation, forecasting, Tableau, AWS, stakeholder communication

Professional Experience
Senior Data Scientist | Northstar Analytics | 2021 - Present
- Built churn prediction models that improved retention outreach precision by 28%.
- Designed A/B testing framework used by product teams across 12 launches.
- Partnered with engineering to productionize Python feature pipelines and model monitoring.

Education
M.S. Applied Statistics | State University`;

const defaultProfile: ApplicantProfile = {
  first_name: 'Taylor',
  last_name: 'Rivera',
  email: 'taylor.rivera@email.com',
  phone: '555-0142',
  linkedin_url: 'https://linkedin.com/in/taylorrivera',
  portfolio_url: 'https://github.com/taylorrivera',
  location: 'Remote',
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

function PortalBadge({ portal }: { portal: Job['portal'] }) {
  return <span className={`portal-badge ${portal}`}>{portal}</span>;
}

function App() {
  const [resumeText, setResumeText] = useState(defaultResume);
  const [searchTerms, setSearchTerms] = useState('data scientist');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ApplicantProfile>(defaultProfile);
  const [status, setStatus] = useState('Ready to scrape remote Data Scientist jobs posted in the last 72 hours.');
  const [isBusy, setIsBusy] = useState(false);

  const selectedJob = useMemo(() => jobs.find((job) => job.id === selectedJobId) ?? jobs[0], [jobs, selectedJobId]);
  const scoredJobs = jobs.filter((job) => job.match_score !== null);
  const avgScore = scoredJobs.length
    ? Math.round(scoredJobs.reduce((sum, job) => sum + (job.match_score ?? 0), 0) / scoredJobs.length)
    : 0;
  const supportedPortals = jobs.filter((job) => ['greenhouse', 'lever', 'workday'].includes(job.portal)).length;

  useEffect(() => {
    listJobs()
      .then((loadedJobs) => {
        setJobs(loadedJobs);
        setSelectedJobId(loadedJobs[0]?.id ?? null);
      })
      .catch(() => {
        setStatus('Backend not connected yet. Start FastAPI on port 8000, then scrape jobs.');
      });
  }, []);

  const refreshJob = (jobId: string, patch: Partial<Job>) => {
    setJobs((currentJobs) => currentJobs.map((job) => (job.id === jobId ? { ...job, ...patch } : job)));
  };

  const runScrape = async (event: FormEvent) => {
    event.preventDefault();
    setIsBusy(true);
    setStatus('Scraping remote job feeds and storing fresh jobs...');
    try {
      const terms = searchTerms
        .split(',')
        .map((term) => term.trim())
        .filter(Boolean);
      const response = await scrapeJobs(resumeText, terms.length ? terms : ['data scientist']);
      setJobs(response.jobs);
      setSelectedJobId(response.jobs[0]?.id ?? null);
      setStatus(`Stored ${response.stored} fresh remote jobs from the last 72 hours.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Scrape failed.');
    } finally {
      setIsBusy(false);
    }
  };

  const runScore = async (job: Job) => {
    setIsBusy(true);
    setStatus(`Scoring ${job.title} at ${job.company}...`);
    try {
      const result = await scoreJob(job.id, resumeText);
      refreshJob(job.id, {
        match_score: result.match_score,
        score_reason: result.reason,
        missing_keywords: result.missing_keywords,
      });
      setStatus(`Score updated: ${result.match_score}/100.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Scoring failed.');
    } finally {
      setIsBusy(false);
    }
  };

  const runGenerateResume = async (job: Job) => {
    setIsBusy(true);
    setStatus(`Generating ATS resume for ${job.company}...`);
    try {
      const result = await generateResume(job.id, resumeText);
      refreshJob(job.id, { generated_resume: result.generated_resume });
      setSelectedJobId(job.id);
      setStatus('ATS optimized resume saved on the job.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Resume generation failed.');
    } finally {
      setIsBusy(false);
    }
  };

  const runApplyDryRun = async (job: Job) => {
    setIsBusy(true);
    setStatus(`Checking ${job.portal} application automation for ${job.company}...`);
    try {
      const result = await applyToJob(job.id, profile);
      refreshJob(job.id, { apply_status: result.status, apply_notes: result.notes });
      setStatus(`${result.portal} status: ${result.notes}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Application dry run failed.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleResumeUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setResumeText(String(reader.result ?? ''));
    reader.readAsText(file);
  };

  const updateProfile = (field: keyof ApplicantProfile, value: string) => {
    setProfile((currentProfile) => ({ ...currentProfile, [field]: value }));
  };

  return (
    <main className="app-shell">
      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">Remote Data Scientist Job Agent</p>
          <h1>Scrape, score, tailor, and apply from one dashboard.</h1>
          <p>
            Pull fresh remote Data Scientist postings, persist them in PostgreSQL, score each role with OpenAI, generate
            ATS-ready resumes, and dry-run Greenhouse, Lever, and Workday application automation.
          </p>
          <form className="search-row" onSubmit={runScrape}>
            <input
              aria-label="Search terms"
              onChange={(event) => setSearchTerms(event.target.value)}
              placeholder="data scientist, machine learning"
              value={searchTerms}
            />
            <button className="primary-button" disabled={isBusy} type="submit">
              {isBusy ? 'Working...' : 'Scrape fresh jobs'}
            </button>
          </form>
        </div>
        <div className="status-card">
          <span>Pipeline status</span>
          <strong>{jobs.length} jobs</strong>
          <p>{status}</p>
        </div>
      </section>

      <section className="metrics-grid" aria-label="Pipeline metrics">
        <MetricCard label="Fresh jobs" value={`${jobs.length}`} helper="Posted within 72 hours" />
        <MetricCard label="Average match" value={`${avgScore}/100`} helper="OpenAI or local scoring" />
        <MetricCard label="Scored jobs" value={`${scoredJobs.length}`} helper="Resume match completed" />
        <MetricCard label="Auto portals" value={`${supportedPortals}`} helper="Greenhouse, Lever, Workday" />
      </section>

      <section className="workspace-grid">
        <article className="control-card">
          <div className="card-title-row">
            <div>
              <p className="eyebrow">Resume source</p>
              <h2>Candidate resume</h2>
            </div>
            <label className="upload-button">
              Upload .txt
              <input accept=".txt,.md,.text" onChange={handleResumeUpload} type="file" />
            </label>
          </div>
          <textarea
            aria-label="Resume text"
            onChange={(event) => setResumeText(event.target.value)}
            value={resumeText}
          />
        </article>

        <article className="control-card">
          <p className="eyebrow">Application profile</p>
          <h2>Dry-run applicant details</h2>
          <div className="profile-grid">
            {(
              [
                ['first_name', 'First name'],
                ['last_name', 'Last name'],
                ['email', 'Email'],
                ['phone', 'Phone'],
                ['linkedin_url', 'LinkedIn'],
                ['portfolio_url', 'Portfolio'],
                ['location', 'Location'],
              ] as const
            ).map(([field, label]) => (
              <label key={field}>
                {label}
                <input
                  onChange={(event) => updateProfile(field, event.target.value)}
                  value={String(profile[field] ?? '')}
                />
              </label>
            ))}
          </div>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="jobs-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Fresh remote jobs</p>
              <h2>Scraped roles</h2>
            </div>
            <span className="status-pill">Last 72 hours</span>
          </div>
          <div className="job-list">
            {jobs.length ? (
              jobs.map((job) => (
                <button
                  className={`job-card ${selectedJob?.id === job.id ? 'selected' : ''}`}
                  key={job.id}
                  onClick={() => setSelectedJobId(job.id)}
                  type="button"
                >
                  <div>
                    <strong>{job.title}</strong>
                    <span>{job.company}</span>
                  </div>
                  <PortalBadge portal={job.portal} />
                  <p>{job.location} | {new Date(job.posted_at).toLocaleString()}</p>
                  <small>{job.match_score === null ? 'Not scored' : `${job.match_score}/100 match`}</small>
                </button>
              ))
            ) : (
              <p className="muted">No jobs loaded. Start the backend, then scrape fresh roles.</p>
            )}
          </div>
        </article>

        <article className="detail-panel">
          {selectedJob ? (
            <>
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">{selectedJob.company}</p>
                  <h2>{selectedJob.title}</h2>
                </div>
                <PortalBadge portal={selectedJob.portal} />
              </div>
              <div className="button-row">
                <button className="ghost-button compact" disabled={isBusy} onClick={() => runScore(selectedJob)} type="button">
                  Score match
                </button>
                <button
                  className="ghost-button compact"
                  disabled={isBusy}
                  onClick={() => runGenerateResume(selectedJob)}
                  type="button"
                >
                  Generate resume
                </button>
                <button
                  className="primary-button compact"
                  disabled={isBusy}
                  onClick={() => runApplyDryRun(selectedJob)}
                  type="button"
                >
                  Dry-run apply
                </button>
              </div>
              <dl className="job-facts">
                <div>
                  <dt>Match score</dt>
                  <dd>{selectedJob.match_score === null ? 'Pending' : `${selectedJob.match_score}/100`}</dd>
                </div>
                <div>
                  <dt>Apply status</dt>
                  <dd>{selectedJob.apply_status.replace(/_/g, ' ')}</dd>
                </div>
              </dl>
              <p className="lead-text">{selectedJob.score_reason ?? 'Run scoring to get an OpenAI resume match summary.'}</p>
              <div className="keyword-cloud">
                {(selectedJob.missing_keywords.length ? selectedJob.missing_keywords : ['No missing keywords yet']).map((keyword) => (
                  <span className="chip warning" key={keyword}>
                    {keyword}
                  </span>
                ))}
              </div>
              <h3>Job description</h3>
              <p className="description-box">{selectedJob.description}</p>
              <h3>Generated ATS resume</h3>
              <textarea
                aria-label="Generated ATS resume"
                readOnly
                value={selectedJob.generated_resume ?? 'Generate an ATS optimized resume for this job.'}
              />
            </>
          ) : (
            <div className="empty-state">
              <p className="eyebrow">No job selected</p>
              <h2>Scrape jobs to start the application workflow.</h2>
            </div>
          )}
        </article>
      </section>
    </main>
  );
}

export default App;
