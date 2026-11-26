import nodemailer from "nodemailer";
import { smtpSettings } from "./env.ts";

export function createSmtpTransport(config: NonNullable<ReturnType<typeof smtpSettings>>) {
  const { from: _from, ...connection } = config;
  return nodemailer.createTransport({
    ...connection,
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
  });
}
