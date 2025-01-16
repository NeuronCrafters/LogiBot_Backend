import nodemailer from "nodemailer";

export const createTransporter = (email: string, password: string, domain: string) => {
  return nodemailer.createTransport({
    host: `smtp.${domain}`,
    port: 587,
    secure: false,
    auth: {
      user: email,
      pass: password,
    },
  });
};
