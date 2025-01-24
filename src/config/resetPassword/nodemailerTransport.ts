import nodemailer from "nodemailer";

export const createTransporter = (
  email: string,
  password: string,
  domain: string,
  port: number = 587
) => {
  return nodemailer.createTransport({
    host: `smtp.${domain}`,
    port,
    secure: port === 465,
    auth: {
      user: email,
      pass: password,
    },
  });
};
