import mjml2html from "mjml";

export type LayoutOptions = {
  title: string;
  body: string;
  siteUrl?: string;
};

export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const LOGO_URL =
  "https://rlbvvbartyiakhiosxrx.supabase.co/storage/v1/object/public/public-files/torus-logo.png";

export const renderEmailLayout = ({
  title,
  body,
  siteUrl,
}: LayoutOptions): string => {
  const safeTitle = escapeHtml(title);
  const href = escapeHtml(siteUrl ?? "https://torus.app");
  const mjml = `
    <mjml>
      <mj-head>
        <mj-attributes>
          <mj-text font-family="Roboto, Arial, sans-serif" color="#374151" font-size="16px" line-height="24px" />
          <mj-button background-color="#3B82F6" color="#ffffff" border-radius="10px" font-size="15px" font-weight="600" padding="0" />
        </mj-attributes>
      </mj-head>
      <mj-body background-color="#FAFAFA">
        <mj-section padding="32px 16px 0 16px">
          <mj-column width="100%">
            <mj-image align="left" width="200px" src="${LOGO_URL}" href="${href}" alt="Torus" />
          </mj-column>
        </mj-section>
        <mj-section padding="16px">
          <mj-column background-color="#FFFFFF" border="1px solid #E5E7EB" border-radius="12px" padding="32px">
            <mj-text font-size="24px" line-height="32px" font-weight="700" color="#223241" padding-bottom="12px">
              ${safeTitle}
            </mj-text>
            ${body}
          </mj-column>
        </mj-section>
        <mj-section padding="16px">
          <mj-column>
            <mj-text color="#6B7280" font-size="12px" line-height="18px" align="center">
              &copy; Torus. All rights reserved.
            </mj-text>
          </mj-column>
        </mj-section>
      </mj-body>
    </mjml>`;

  const { html } = mjml2html(mjml, { validationLevel: "soft" });
  return html;
};

export const renderMjText = (content: string): string =>
  `<mj-text font-size="16px" line-height="24px" color="#374151">${content}</mj-text>`;

export const renderMutedMjText = (content: string): string =>
  `<mj-text font-size="13px" line-height="20px" color="#6B7280">${content}</mj-text>`;
