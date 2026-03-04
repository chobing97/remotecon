async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (res.status === 401 && !options.noRedirect) {
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || res.statusText);
  }
  return res.json();
}

export const api = {
  getMe: () => request('/api/me', { noRedirect: true }),
  logout: () => request('/auth/logout', { method: 'POST' }),

  // Sessions
  getSessions: () => request('/api/sessions'),
  deleteSession: (id) => request(`/api/sessions/${id}`, { method: 'DELETE' }),
  getWsToken: () => request('/api/ws-token', { method: 'POST' }),

  // Recordings
  getRecordings: () => request('/api/recordings'),
  getRecordingData: (id) =>
    fetch(`/api/recordings/${id}/data`).then((r) => {
      if (!r.ok) throw new Error('Failed to fetch recording');
      return r.arrayBuffer();
    }),
  deleteRecording: (id) => request(`/api/recordings/${id}`, { method: 'DELETE' }),

  // Webhooks
  getWebhooks: () => request('/api/webhooks'),
  createWebhook: (data) => request('/api/webhooks', { method: 'POST', body: JSON.stringify(data) }),
  updateWebhook: (id, data) => request(`/api/webhooks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteWebhook: (id) => request(`/api/webhooks/${id}`, { method: 'DELETE' }),
};
