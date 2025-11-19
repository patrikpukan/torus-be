import {
  renderEmailLayout,
  renderMjText,
  renderMutedMjText,
  escapeHtml,
} from "./layout";

export function buildBanEmail(params: {
  reason: string;
  expiresAt?: Date | null;
  siteUrl?: string;
  greeting?: string;
}) {
  const title = "Access to Torus suspended";
  const greetingBlock = params.greeting
    ? renderMjText(escapeHtml(params.greeting))
    : "";
  const expiry = params.expiresAt
    ? renderMjText(
        `The ban is currently set to expire on <strong>${params.expiresAt.toLocaleString()}</strong>.`
      )
    : "";
  const inner = `
    ${greetingBlock}
    ${renderMjText(
      `Your access to <strong>Torus</strong> has been suspended by your organization administrator.`
    )}
    ${renderMjText(
      `<strong>Reason:</strong> ${escapeHtml(params.reason)}`
    )}
    ${expiry}
    ${renderMutedMjText(
      "If you believe this was a mistake, please contact your administrator."
    )}
  `;
  const textParts = [
    params.greeting ?? null,
    "Your access to Torus has been suspended by your organization administrator.",
    `Reason: ${params.reason}`,
    params.expiresAt ? `The ban is currently set to expire on ${params.expiresAt.toLocaleString()}.` : null,
    "",
    "If you believe this was a mistake, please contact your administrator.",
  ].filter((part): part is string => Boolean(part && part.length));

  return {
    subject: "Your Torus access has been suspended",
    html: renderEmailLayout({
      title,
      body: inner,
      siteUrl: params.siteUrl,
    }),
    text: textParts.join("\n"),
  };
}
