import { Helmet } from "react-helmet-async";
import { useEffect } from "react";

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface SEOProps {
  title: string;
  description: string;
  canonical?: string;
  image?: string;
  type?: string;
  robots?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  breadcrumbs?: BreadcrumbItem[];
}

const SITE_NAME = "Дебрянск Авто";
const MAX_TITLE_LENGTH = 70;
const MAX_DESCRIPTION_LENGTH = 155;

function truncateAtWord(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  const prefix = value.slice(0, Math.max(1, maxLength - 1));
  const lastSpace = prefix.lastIndexOf(" ");
  const end = lastSpace > maxLength * 0.6 ? lastSpace : prefix.length;
  return `${prefix.slice(0, end).trimEnd()}…`;
}

function formatTitle(value: string): string {
  const title = value.trim();
  const siteSuffixMatch = title.match(/\s*[|—–-]\s*Дебрянск Авто$/i);
  if (siteSuffixMatch) {
    const prefix = title.slice(0, -siteSuffixMatch[0].length).trimEnd();
    const suffix = " — Дебрянск Авто";
    return title.length <= MAX_TITLE_LENGTH
      ? title
      : `${truncateAtWord(prefix, MAX_TITLE_LENGTH - suffix.length)}${suffix}`;
  }

  const fullTitle = title.includes(SITE_NAME) ? title : `${title} — ${SITE_NAME}`;
  return truncateAtWord(fullTitle, MAX_TITLE_LENGTH);
}

function formatDescription(value: string): string {
  return truncateAtWord(value.trim(), MAX_DESCRIPTION_LENGTH);
}

export default function SEO({
  title,
  description,
  canonical,
  image = "/opengraph.jpg",
  type = "website",
  robots = "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1",
  jsonLd,
  breadcrumbs,
}: SEOProps) {
  const fullTitle = formatTitle(title);
  const metaDescription = formatDescription(description);
  const siteUrl = "https://debryansk-auto.ru";
  const fullUrl = canonical ? `${siteUrl}${canonical}` : siteUrl;
  const fullImage = image.startsWith("http") ? image : `${siteUrl}${image}`;

  useEffect(() => {
    const fallbackHeading = document.querySelector("[data-seo-h1-fallback]");
    if (fallbackHeading && document.querySelector("#root h1")) fallbackHeading.remove();
  }, [title, canonical]);

  const jsonLdString = jsonLd
    ? JSON.stringify(
        Array.isArray(jsonLd)
          ? { "@context": "https://schema.org", "@graph": jsonLd }
          : { "@context": "https://schema.org", ...jsonLd }
      )
    : null;

  const breadcrumbJsonLd = breadcrumbs && breadcrumbs.length > 0
    ? JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": breadcrumbs.map((item, index) => ({
          "@type": "ListItem",
          "position": index + 1,
          "name": item.name,
          "item": item.url.startsWith("http") ? item.url : `${siteUrl}${item.url}`,
        })),
      })
    : null;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={metaDescription} />
      <link rel="canonical" href={fullUrl} />
      <meta name="robots" content={robots} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:image" content={fullImage} />
      <meta property="og:site_name" content="Дебрянск Авто" />
      <meta property="og:locale" content="ru_RU" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={fullImage} />
      {jsonLdString && (
        <script type="application/ld+json">{jsonLdString}</script>
      )}
      {breadcrumbJsonLd && (
        <script type="application/ld+json">{breadcrumbJsonLd}</script>
      )}
    </Helmet>
  );
}
