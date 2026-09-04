
export function setDocumentTitle(title: string) {
  document.title = title;
}

export function setMetaDescription(description: string) {
  let tag = document.querySelector('meta[name="description"]');
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', 'description');
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', description);
}

export function setJsonLd(data: Record<string, unknown>, id: string) {
  const existing = document.getElementById(id);
  if (existing) {
    existing.textContent = JSON.stringify(data);
    return;
  }
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.id = id;
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
}

export function removeJsonLd(id: string) {
  document.getElementById(id)?.remove();
}

export function resetDocumentTitle() {
  document.title = 'FanFaster';
}

export function resetMetaDescription() {
  const tag = document.querySelector('meta[name="description"]');
  if (tag) {
    tag.setAttribute('content', "FanFaster - Huquq sohasida bilimingizni sun'iy intellekt yordamida yuksaltiring. Kazus toplamlarini yarating, yeching va professional baholang.");
  }
}
