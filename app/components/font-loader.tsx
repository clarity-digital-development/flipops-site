'use client';

/**
 * Async (non-render-blocking) Google Font loader.
 * Uses media="print" → onLoad swap pattern so the font stylesheet
 * does not block the initial paint.
 */
export function FontLoader() {
  return (
    <link
      href="https://fonts.googleapis.com/css2?family=Questrial&display=swap"
      rel="stylesheet"
      media="print"
      onLoad={(e) => {
        (e.currentTarget as HTMLLinkElement).media = 'all';
      }}
    />
  );
}
