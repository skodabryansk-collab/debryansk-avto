import { Helmet } from "react-helmet-async";

interface SEOProps {
  title: string;
  description: string;
  canonical?: string;
  image?: string;
  type?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

export default function SEO({
  title,
  description,
  canonical,
  image = "/opengraph.jpg",
  type = "website",
  jsonLd,
}: SEOProps) {
  const fullTitle = title.includes("Дебрянск") ? title : `${title} — Дебрянск Авто`;
  const siteUrl = "https://debryansk-auto.ru";
  const fullUrl = canonical ? `${siteUrl}${canonical}` : siteUrl;
  const fullImage = image.startsWith("http") ? image : `${siteUrl}${image}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={fullUrl} />
      <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:image" content={fullImage} />
      <meta property="og:site_name" content="Дебрянск Авто" />
      <meta property="og:locale" content="ru_RU" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={fullImage} />
      <meta name="twitter:site" content="@debryanskavto" />
      <meta name="yandex-verification" content="" />
      <meta name="google-site-verification" content="" />
      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            ...jsonLd,
          })}
        </script>
      )}
    </Helmet>
  );
}
