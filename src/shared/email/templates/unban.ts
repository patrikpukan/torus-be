import {
  renderEmailLayout,
  renderMjText,
  renderMutedMjText,
  escapeHtml,
} from "./layout";

export function buildUnbanEmail(
  params: { siteUrl?: string; greeting?: string } = {}
) {
  const title = "Access to Torus restored";
  const greetingBlock = params.greeting
    ? renderMjText(escapeHtml(params.greeting))
    : "";
  const inner = `
    ${greetingBlock}
    ${renderMjText(
      "Good news! Your access to <strong>Torus</strong> has been restored and you can sign in again."
    )}
    ${renderMutedMjText(
      "If you run into any issues, please reach out to your administrator."
    )}
  `;
  const textParts = [
    params.greeting ?? null,
    "Good news! Your Torus access has been restored and you can sign in again.",
    "",
    "If you run into any issues, please reach out to your administrator.",
  ].filter((part): part is string => Boolean(part && part.length));

  return {
    subject: "Your Torus access has been restored",
    html: renderEmailLayout({
      title,
      body: inner,
      siteUrl: params.siteUrl,
    }),
    text: textParts.join("\n"),
  };
}
