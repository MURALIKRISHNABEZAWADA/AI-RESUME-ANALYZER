export interface Job {
  id: string;
  source: string;
  external_id: string;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  url: string;
  portal: 'greenhouse' | 'lever' | 'workday' | 'other';
  posted_at: string;
  scraped_at: string;
  description: string;
  match_score: number | null;
  score_reason: string | null;
  missing_keywords: string[];
  generated_resume: string | null;
  apply_status: string;
  apply_notes: string | null;
  applied_at: string | null;
}

export interface ApplicantProfile {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  linkedin_url?: string;
  portfolio_url?: string;
  location?: string;
  resume_file_path?: string;
  cover_letter?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const listJobs = () => request<Job[]>('/jobs');

export const scrapeJobs = (resumeText: string, searchTerms: string[]) =>
  request<{ stored: number; jobs: Job[] }>('/jobs/scrape', {
    method: 'POST',
    body: JSON.stringify({
      search_terms: searchTerms,
      resume_text: resumeText || null,
      generate_resumes: Boolean(resumeText.trim()),
      limit: 50,
    }),
  });

export const scoreJob = (jobId: string, resumeText: string) =>
  request<{ match_score: number; reason: string; missing_keywords: string[] }>(`/jobs/${jobId}/score`, {
    method: 'POST',
    body: JSON.stringify({ resume_text: resumeText }),
  });

export const generateResume = (jobId: string, resumeText: string) =>
  request<{ generated_resume: string }>(`/jobs/${jobId}/resume`, {
    method: 'POST',
    body: JSON.stringify({ resume_text: resumeText }),
  });

export const applyToJob = (jobId: string, profile: ApplicantProfile) =>
  request<{ status: string; portal: string; notes: string }>(`/jobs/${jobId}/apply`, {
    method: 'POST',
    body: JSON.stringify({ profile, dry_run: true }),
  });
