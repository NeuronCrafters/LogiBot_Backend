export const mailOptions = (
    from: string,
    to: string,
    subject: string,
    html: string,
    text?: string
) => ({
  from,
  to,
  subject,
  html,
  text,
});
